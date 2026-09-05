import { randomUUID } from "node:crypto";
import {
	assertPlanningStageCompleted,
	seedTaskBoard,
	readTaskCard,
	readTaskOutput,
} from "#benchmark/backlog";
import { executeBenchmark } from "#benchmark/benchmark-command";
import {
	captureStageCorpus,
	installStageCorpusSnapshot,
	materializeCheckpoint,
	recordCheckpoint,
	corpusLayoutRoots,
} from "#benchmark/checkpoint";
import {
	captureBaselineContext,
	captureCheckIntegrity,
	captureFileHashes,
	captureTreatmentChecks,
	runChecks,
	runSetup,
} from "#benchmark/checks";
import type { BenchmarkCase, LoadedCase, SessionCase } from "#benchmark/case";
import { withPipeline } from "#benchmark/case";
import type { BenchmarkConfig, SessionRunConfig } from "#benchmark/config";
import type { Immutable } from "#benchmark/contracts";
import {
	CONTROL_DIR,
	judgeSelfPreferenceWarning,
	parseArgs,
	parseCaseId,
	parseSessionArgs,
} from "#benchmark/config";
import { liveCorpusInstructions } from "#benchmark/corpus-file";
import { runJudge, validateRubricDefinition } from "#benchmark/judge";
import type { PipelineConfirmationRequest } from "#benchmark/pipeline-confirmation";
import { runPipelineConfirmation } from "#benchmark/pipeline-confirmation";
import {
	projectConfirmationCost,
	runRequestedExecution,
} from "#benchmark/confirmation";
import { runBenchmark } from "#benchmark/run";
import { benchmarkRunsDirectory } from "#benchmark/run-layout";
import { runStageJudge } from "#benchmark/stage-grading";
import {
	addWorktree,
	assertBuildCommitted,
	assertControlReady,
	assertSourceReady,
	captureBuildCandidate,
	changedPathsBetween,
	recordRetentionRef,
	removeWorktree,
} from "#benchmark/target";
import type { SourceBaseline } from "#benchmark/target";
import { createProductOwner, runWorkflowStage } from "#benchmark/workflow";
import { asUsageError } from "#cli/commands";
import {
	RefusedPreconditionError,
	refuseStageCorpus,
	requireInteractiveStdin,
	requireSpendAuthorization,
} from "#cli/interactive-stdin";
import type { CommandOutput } from "#cli/output";
import { writeDiagnostic, writeRecord } from "#cli/output";
import { terminalQuestioner } from "#cli/questioner";
import {
	defaultSessionRunRequest,
	reportSessionChecks,
	runSessionDebugAttempt,
} from "#cli/session-run-command";

const REVIEW_PAUSE_REASON =
	"--pause stops with the candidate in the target and waits for a reviewer, so it needs one; drop it and the run records its evidence, retains the candidate, and restores";

const COST_APPROVAL_REASON =
	"a confirmation group asks for its projected cost to be approved, so it needs one or --yes";

export interface RunCommandRequest {
	readonly args: readonly string[];
	readonly json: boolean;
	readonly stdinIsTerminal: boolean;
}

export type RunOutcome =
	| { readonly kind: "debug"; readonly recordFile: string }
	| { readonly kind: "confirmation"; readonly recordFile: string };

export interface RunCommandDependencies {
	readonly output: CommandOutput;
	readonly requireCase: (caseId: string) => Promise<LoadedCase>;
	readonly execute: (
		config: BenchmarkConfig,
		output: CommandOutput,
		benchmarkCase: BenchmarkCase,
	) => Promise<RunOutcome>;
	readonly executeSession: (
		config: SessionRunConfig,
		output: CommandOutput,
		sessionCase: SessionCase,
	) => Promise<RunOutcome>;
}

/**
 * The case is loaded before the configuration is resolved because it declares
 * both the pipeline the run executes and the target it falls back to, and
 * before the target is claimed because an unknown case must not leave one
 * dirty.
 */
export async function runRunCommand(
	request: RunCommandRequest,
	dependencies: RunCommandDependencies,
): Promise<void> {
	const caseId = asUsageError(() => parseCaseId(request.args));
	const loaded = await dependencies.requireCase(caseId);
	if (loaded.kind === "session") {
		await runSessionCase(loaded, request, dependencies);

		return;
	}

	const benchmarkCase = loaded;
	const config = asUsageError(() =>
		parseArgs(request.args, Bun.env, {
			caseId: benchmarkCase.declaration.id,
			pipelinePath: benchmarkCase.pipelinePath,
			targetPath: benchmarkCase.targetPath,
			model: benchmarkCase.declaration.model,
			sessionBudgetUsd: benchmarkCase.declaration.sessionBudgetUsd,
		}),
	);
	refuseStageCorpus(config.corpus);
	requireSpendAuthorization(request.args, Bun.env, request.stdinIsTerminal);
	refuseWithoutTerminal(config, request.stdinIsTerminal);

	writeDiagnostic(dependencies.output, judgeSelfPreferenceWarning(config));

	const outcome = await dependencies.execute(
		config,
		dependencies.output,
		await selectedCase(benchmarkCase, config),
	);

	await writeRecord(dependencies.output, outcome.recordFile, request.json);
}

/**
 * Two questions a run may ask, each refused before any paid work when nothing
 * can answer it: the review pause, requested by `--pause`, and the projected
 * cost of a confirmation group that `--yes` has not already approved.
 */
function refuseWithoutTerminal(
	config: Readonly<BenchmarkConfig>,
	stdinIsTerminal: boolean,
): void {
	if (config.pause) {
		requireInteractiveStdin(stdinIsTerminal, REVIEW_PAUSE_REASON);
	}
	if (config.confirmation !== undefined && !config.confirmation.approved) {
		requireInteractiveStdin(stdinIsTerminal, COST_APPROVAL_REASON);
	}
}

/**
 * A session case takes neither a target nor a pipeline, so it parses its own
 * configuration and skips the review pause the stage graph needs a TTY for:
 * a session attempt has no stage to pause between.
 */
async function runSessionCase(
	sessionCase: SessionCase,
	request: RunCommandRequest,
	dependencies: RunCommandDependencies,
): Promise<void> {
	const config = asUsageError(() =>
		parseSessionArgs(request.args, Bun.env, {
			caseId: sessionCase.declaration.id,
			model: sessionCase.declaration.model,
			sessionBudgetUsd: sessionCase.declaration.sessionBudgetUsd,
		}),
	);

	requireSpendAuthorization(request.args, Bun.env, request.stdinIsTerminal);

	const outcome = await dependencies.executeSession(
		config,
		dependencies.output,
		sessionCase,
	);

	await writeRecord(dependencies.output, outcome.recordFile, request.json);
}

/**
 * `--pipeline` overrides the case's declared pipeline, which changes the stage
 * rubrics with it, so the override is resolved into the loaded case rather
 * than carried alongside it.
 */
function selectedCase(
	benchmarkCase: BenchmarkCase,
	config: BenchmarkConfig,
): Promise<BenchmarkCase> {
	if (config.pipelinePath === benchmarkCase.pipelinePath) {
		return Promise.resolve(benchmarkCase);
	}

	return withPipeline(benchmarkCase, config.pipelinePath);
}

export async function executeRun(
	config: BenchmarkConfig,
	output: CommandOutput,
	benchmarkCase: BenchmarkCase,
): Promise<RunOutcome> {
	const questioner = terminalQuestioner();

	try {
		const outcome = await executeBenchmark(
			config,
			benchmarkCase.pipeline.stages.length,
			{
				approval: {
					output: (message) => {
						output.stderr(`${message}\n`);
					},
					prompt: (message) => questioner.question(message),
				},
				runDebug: () => runBenchmark(config, benchmarkCase, questioner),
				runConfirmed: (confirmation) =>
					confirmRun(config, benchmarkCase, confirmation, output),
			},
		);
		if (outcome.kind === "confirmation") {
			output.stderr(
				`Confirmation group: ${outcome.evidence.groupRecordFile}\n`,
			);
			for (const recordFile of outcome.evidence.repRecordFiles) {
				output.stderr(`Confirmation rep: ${recordFile}\n`);
			}

			return {
				kind: "confirmation",
				recordFile: outcome.evidence.reportFile,
			};
		}

		return { kind: "debug", recordFile: outcome.evidence.artifactFile };
	} finally {
		questioner.close();
	}
}

interface ConfirmationApproval {
	readonly reps: number;
	readonly projectedCost: PipelineConfirmationRequest["projectedCost"];
	readonly approvalMethod: "interactive" | "yes";
}

export interface ConfirmationRequestInputs {
	readonly benchmarkCase: BenchmarkCase;
	readonly config: BenchmarkConfig;
	readonly confirmation: ConfirmationApproval;
	readonly controlSha: string;
	readonly source: SourceBaseline;
	readonly instructions: string;
}

/**
 * The loaded case is the one owner of the case identity, so the group and rep
 * records name what the run actually loaded rather than a second copy of the
 * id that the configuration carries for the manifest.
 */
export function buildConfirmationRequest(
	inputs: Immutable<ConfirmationRequestInputs>,
): PipelineConfirmationRequest {
	const { benchmarkCase, config, confirmation } = inputs;

	return {
		runsDirectory: benchmarkRunsDirectory(CONTROL_DIR),
		groupId: randomUUID(),
		reps: confirmation.reps,
		projectedCost: confirmation.projectedCost,
		approvalMethod: confirmation.approvalMethod,
		source: inputs.source,
		controlSha: inputs.controlSha,
		caseId: benchmarkCase.declaration.id,
		pipelinePath: config.pipelinePath,
		pipeline: benchmarkCase.pipeline,
		task: benchmarkCase.task,
		productBrief: benchmarkCase.productBrief,
		instructions: inputs.instructions,
		finalRubric: benchmarkCase.finalRubric,
		stageRubrics: benchmarkCase.stageRubrics,
		corpusRoots: corpusLayoutRoots(CONTROL_DIR),
		model: config.model,
		effort: config.effort,
		judgeModel: config.judgeModel,
		judgeEffort: config.judgeEffort,
		sessionBudgetUsd: config.sessionBudgetUsd,
	};
}

async function confirmRun(
	config: BenchmarkConfig,
	benchmarkCase: BenchmarkCase,
	confirmation: ConfirmationApproval,
	output: CommandOutput,
): Promise<Awaited<ReturnType<typeof runPipelineConfirmation>>> {
	const [controlSha, source, instructions] = await Promise.all([
		assertControlReady(),
		assertSourceReady(config.sourceDir),
		liveCorpusInstructions(),
	]);
	validateRubricDefinition(benchmarkCase.finalRubric);

	return runPipelineConfirmation(
		{
			createProductOwner,
			stageSession: {
				runWorkflowStage,
				readTaskOutput,
				readTaskCard,
				captureBuildCandidate,
				assertPlanningStageCompleted,
				assertBuildCommitted,
				changedPathsBetween,
				captureCheckIntegrity,
				captureTreatmentChecks,
				captureStageCorpus,
			},
			runStageJudge,
			runFinalJudge: (judgeRequest) =>
				runJudge(
					config.judgeModel,
					config.judgeEffort,
					config.sessionBudgetUsd,
					judgeRequest.rubric,
					judgeRequest.baselineContext,
					judgeRequest.evidence.diff,
					judgeRequest.evidence.changedPaths,
					judgeRequest.evidence.checkIntegrity,
					judgeRequest.evidence.localChecks,
				),
			seedTaskBoard,
			runChecks,
			runSetup,
			captureBaselineContext,
			captureFileHashes,
			addWorktree,
			removeWorktree,
			materializeCheckpoint,
			installStageCorpusSnapshot,
			recordCheckpoint,
			recordRetentionRef,
			captureBuildCandidate,
			log: (message) => {
				output.stderr(`${message}\n`);
			},
		},
		buildConfirmationRequest({
			benchmarkCase,
			config,
			confirmation,
			controlSha,
			source,
			instructions,
		}),
	);
}

/**
 * A session confirmation group is not built yet, so the projection is shown
 * and the group refused before any provider call rather than after: the
 * ordering the vision asks for holds whether or not the group exists.
 */
export function executeSessionRun(
	config: SessionRunConfig,
	output: CommandOutput,
	sessionCase: SessionCase,
): Promise<RunOutcome> {
	const questioner = terminalQuestioner();

	return runRequestedExecution<RunOutcome>({
		confirmation: config.confirmation,
		projectCost: () =>
			projectConfirmationCost({
				mode: "session",
				reps: config.confirmation?.reps ?? 1,
				sessionBudgetUsd: config.sessionBudgetUsd,
			}),
		approval: {
			output: (message) => {
				output.stderr(`${message}\n`);
			},
			prompt: (message) => questioner.question(message),
		},
		runDebug: async () => {
			const outcome = await runSessionDebugAttempt(
				defaultSessionRunRequest(
					sessionCase,
					config,
					benchmarkRunsDirectory(CONTROL_DIR),
				),
			);
			reportSessionChecks(outcome.record, output);

			return { kind: "debug", recordFile: outcome.recordFile };
		},
		runConfirmed: () =>
			Promise.reject(
				new RefusedPreconditionError(
					"A session confirmation group is not built yet; run the case without --confirm",
				),
			),
	}).finally(() => {
		questioner.close();
	});
}
