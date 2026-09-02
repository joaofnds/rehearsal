import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import {
	assertPlanningStageCompleted,
	createTaskCommit,
	readTaskCard,
	readTaskOutput,
} from "./src/benchmark/backlog";
import { executeBenchmark } from "./src/benchmark/benchmark-command";
import {
	captureStageCorpus,
	installStageCorpusSnapshot,
	materializeCheckpoint,
	recordCheckpoint,
	skillSearchRoots,
} from "./src/benchmark/checkpoint";
import {
	captureBaselineContext,
	captureCheckIntegrity,
	captureFileHashes,
	captureTreatmentChecks,
	runChecks,
} from "./src/benchmark/checks";
import {
	CONTROL_DIR,
	judgeSelfPreferenceWarning,
	parseArgs,
	REQUIRED_BUN_VERSION,
} from "./src/benchmark/config";
import { runJudge, validateRubricDefinition } from "./src/benchmark/judge";
import { runPipelineConfirmation } from "./src/benchmark/pipeline-confirmation";
import { loadPipeline } from "./src/benchmark/pipeline";
import { runBenchmark } from "./src/benchmark/run";
import { benchmarkRunsDirectory } from "./src/benchmark/run-layout";
import { loadStageRubric, runStageJudge } from "./src/benchmark/stage-grading";
import {
	addWorktree,
	assertBuildCommitted,
	assertControlReady,
	assertSourceReady,
	captureBuildCandidate,
	changedPathsBetween,
	recordRetentionRef,
	removeWorktree,
} from "./src/benchmark/target";
import { createProductOwner, runWorkflowStage } from "./src/benchmark/workflow";

async function main(): Promise<void> {
	if (Bun.version !== REQUIRED_BUN_VERSION) {
		throw new Error(
			`Use Bun ${REQUIRED_BUN_VERSION}; current version is ${Bun.version}`,
		);
	}

	const config = parseArgs(Bun.argv.slice(2));
	const warning = judgeSelfPreferenceWarning(config);
	if (warning !== undefined) {
		console.error(warning);
	}

	const pipeline = await loadPipeline(config.pipelinePath);
	const rl = createInterface({ input, output });

	try {
		const outcome = await executeBenchmark(config, pipeline.stages.length, {
			approval: {
				output: console.log,
				prompt: (message) => rl.question(message),
			},
			runDebug: () => runBenchmark(config, rl),
			runConfirmed: async (confirmation) => {
				const [
					controlSha,
					source,
					task,
					productBrief,
					instructions,
					finalRubric,
				] = await Promise.all([
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
						runFinalJudge: (request) =>
							runJudge(
								config.judgeModel,
								config.judgeEffort,
								config.sessionBudgetUsd,
								request.rubric,
								request.baselineContext,
								request.evidence.diff,
								request.evidence.changedPaths,
								request.evidence.checkIntegrity,
								request.evidence.localChecks,
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
						log: console.log,
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
			},
		});
		if (outcome.kind === "confirmation") {
			console.log(`\nConfirmation group: ${outcome.evidence.groupRecordFile}`);
			console.log(`Confirmation report: ${outcome.evidence.reportFile}`);
			for (const recordFile of outcome.evidence.repRecordFiles) {
				console.log(`Confirmation rep: ${recordFile}`);
			}
		}
	} finally {
		rl.close();
	}
}

if (import.meta.main) {
	await main();
}
