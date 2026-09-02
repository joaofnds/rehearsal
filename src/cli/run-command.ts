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
import type { BenchmarkConfig } from "#benchmark/config";
import {
	CONTROL_DIR,
	judgeSelfPreferenceWarning,
	parseArgs,
} from "#benchmark/config";
import { runJudge, validateRubricDefinition } from "#benchmark/judge";
import type { PipelineDefinition } from "#benchmark/pipeline";
import { runPipelineConfirmation } from "#benchmark/pipeline-confirmation";
import { runBenchmark } from "#benchmark/run";
import { benchmarkRunsDirectory } from "#benchmark/run-layout";
import { loadStageRubric, runStageJudge } from "#benchmark/stage-grading";
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
	readonly loadPipeline: (path: string) => Promise<PipelineDefinition>;
	readonly execute: (
		config: BenchmarkConfig,
		output: CommandOutput,
		pipeline: PipelineDefinition,
	) => Promise<RunOutcome>;
}

export async function runRunCommand(
	request: RunCommandRequest,
	dependencies: RunCommandDependencies,
): Promise<void> {
	const config = asUsageError(() => parseArgs(request.args));
	requireInteractiveStdin(request.stdinIsTerminal, REVIEW_PAUSE_REASON);

	const warning = judgeSelfPreferenceWarning(config);
	if (warning !== undefined) {
		dependencies.output.stderr(`${warning}\n`);
	}

	const pipeline = await dependencies.loadPipeline(config.pipelinePath);
	const outcome = await dependencies.execute(
		config,
		dependencies.output,
		pipeline,
	);

	dependencies.output.stdout(
		request.json
			? await Bun.file(outcome.recordFile).text()
			: `${outcome.recordFile}\n`,
	);
}

export async function executeRun(
	config: BenchmarkConfig,
	output: CommandOutput,
	pipeline: PipelineDefinition,
): Promise<RunOutcome> {
	const questioner = terminalQuestioner();

	try {
		const outcome = await executeBenchmark(config, pipeline.stages.length, {
			approval: {
				output: (message) => {
					output.stderr(`${message}\n`);
				},
				prompt: (message) => questioner.question(message),
			},
			runDebug: () => runBenchmark(config, questioner),
			runConfirmed: (confirmation) =>
				confirmRun(config, pipeline, confirmation, output),
		});
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
	pipeline: PipelineDefinition,
	confirmation: {
		readonly reps: number;
		readonly projectedCost: Parameters<
			typeof runPipelineConfirmation
		>[1]["projectedCost"];
		readonly approvalMethod: "interactive" | "yes";
	},
	output: CommandOutput,
): Promise<Awaited<ReturnType<typeof runPipelineConfirmation>>> {
	const [controlSha, source, task, productBrief, instructions, finalRubric] =
		await Promise.all([
			assertControlReady(),
			assertSourceReady(config.sourceDir),
			Bun.file(join(CONTROL_DIR, "backlog-seed.md")).text(),
			Bun.file(join(CONTROL_DIR, "product-brief.md")).text(),
			Bun.file(join(CONTROL_DIR, "CLAUDE.md")).text(),
			Bun.file(join(CONTROL_DIR, "rubric.md")).text(),
		]);
	validateRubricDefinition(finalRubric);
	const stageRubrics: Record<
		string,
		Awaited<ReturnType<typeof loadStageRubric>>
	> = {};
	for (const stage of pipeline.stages) {
		stageRubrics[stage.name] = await loadStageRubric(stage);
	}

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
			pipelinePath: config.pipelinePath,
			pipeline,
			task,
			productBrief,
			instructions,
			finalRubric,
			stageRubrics,
			corpusRoots: skillSearchRoots(CONTROL_DIR),
			model: config.model,
			effort: config.effort,
			judgeModel: config.judgeModel,
			judgeEffort: config.judgeEffort,
			sessionBudgetUsd: config.sessionBudgetUsd,
		},
	);
}
