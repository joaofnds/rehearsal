import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
	assertPlanningStageCompleted,
	createTaskCommit,
	readTaskCard,
	readTaskOutput,
} from "#benchmark/backlog";
import { executeBenchmark } from "#benchmark/benchmark-command";
import {
	captureStageCorpus,
	installStageCorpusSnapshot,
	materializeCheckpoint,
	recordCheckpoint,
	skillSearchRoots,
} from "#benchmark/checkpoint";
import {
	captureBaselineContext,
	captureCheckIntegrity,
	captureFileHashes,
	captureTreatmentChecks,
	runChecks,
} from "#benchmark/checks";
import type { BenchmarkCase } from "#benchmark/case";
import { withPipeline } from "#benchmark/case";
import type { BenchmarkConfig } from "#benchmark/config";
import {
	CONTROL_DIR,
	judgeSelfPreferenceWarning,
	parseArgs,
	parseCaseId,
} from "#benchmark/config";
import { runJudge, validateRubricDefinition } from "#benchmark/judge";
import { runPipelineConfirmation } from "#benchmark/pipeline-confirmation";
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
import { createProductOwner, runWorkflowStage } from "#benchmark/workflow";
import { asUsageError } from "#cli/commands";
import { requireInteractiveStdin } from "#cli/interactive-stdin";
import type { CommandOutput } from "#cli/output";
import { writeDiagnostic, writeRecord } from "#cli/output";
import { terminalQuestioner } from "#cli/questioner";

const REVIEW_PAUSE_REASON =
	"the review pause has no flag alternative until ACT-26.3, so a run needs a TTY";

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
	readonly requireCase: (caseId: string) => Promise<BenchmarkCase>;
	readonly execute: (
		config: BenchmarkConfig,
		output: CommandOutput,
		benchmarkCase: BenchmarkCase,
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
	const benchmarkCase = await dependencies.requireCase(caseId);
	const config = asUsageError(() =>
		parseArgs(request.args, Bun.env, {
			caseId: benchmarkCase.declaration.id,
			pipelinePath: benchmarkCase.pipelinePath,
			targetPath: benchmarkCase.targetPath,
		}),
	);
	if (config.confirmation === undefined || !config.confirmation.approved) {
		requireInteractiveStdin(request.stdinIsTerminal, REVIEW_PAUSE_REASON);
	}

	writeDiagnostic(dependencies.output, judgeSelfPreferenceWarning(config));

	const outcome = await dependencies.execute(
		config,
		dependencies.output,
		await selectedCase(benchmarkCase, config),
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

async function confirmRun(
	config: BenchmarkConfig,
	benchmarkCase: BenchmarkCase,
	confirmation: {
		readonly reps: number;
		readonly projectedCost: Parameters<
			typeof runPipelineConfirmation
		>[1]["projectedCost"];
		readonly approvalMethod: "interactive" | "yes";
	},
	output: CommandOutput,
): Promise<Awaited<ReturnType<typeof runPipelineConfirmation>>> {
	const [controlSha, source, instructions] = await Promise.all([
		assertControlReady(),
		assertSourceReady(config.sourceDir),
		Bun.file(join(CONTROL_DIR, "CLAUDE.md")).text(),
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
			createTaskCommit,
			runChecks,
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
		{
			runsDirectory: benchmarkRunsDirectory(CONTROL_DIR),
			groupId: randomUUID(),
			reps: confirmation.reps,
			projectedCost: confirmation.projectedCost,
			approvalMethod: confirmation.approvalMethod,
			source,
			controlSha,
			caseId: config.caseId,
			pipelinePath: config.pipelinePath,
			pipeline: benchmarkCase.pipeline,
			task: benchmarkCase.task,
			productBrief: benchmarkCase.productBrief,
			instructions,
			finalRubric: benchmarkCase.finalRubric,
			stageRubrics: benchmarkCase.stageRubrics,
			corpusRoots: skillSearchRoots(CONTROL_DIR),
			model: config.model,
			effort: config.effort,
			judgeModel: config.judgeModel,
			judgeEffort: config.judgeEffort,
			sessionBudgetUsd: config.sessionBudgetUsd,
		},
	);
}
