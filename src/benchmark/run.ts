import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assertPlanningStageCompleted,
	createTaskCommit,
	parseTaskState,
	readTaskOutput,
} from "./backlog";
import { collectCalibration, type Questioner } from "./calibration";
import {
	captureBaselineContext,
	captureCheckIntegrity,
	captureFileHashes,
	captureTreatmentChecks,
	runChecks,
} from "./checks";
import { killActiveCommands, runCommand } from "./command";
import {
	type BenchmarkConfig,
	CONTROL_DIR,
	type Effort,
	type WorkflowStage,
} from "./config";
import type {
	CalibrationResult,
	ContextFile,
	JudgeGrade,
	LocalCheckResult,
	RunArtifact,
	StageJudgeInput,
	StageScorecard,
	StageTranscript,
} from "./contracts";
import { runJudge, validateRubricDefinition } from "./judge";
import { loadPipeline, type PipelineDefinition } from "./pipeline";
import {
	assertStageGradePassed,
	captureStageJudgeInput,
	loadStageRubric,
	runStageJudge,
} from "./stage-grading";
import {
	assertBuildCommitted,
	assertControlReady,
	assertSourceReady,
	assertWorkspaceCleanAt,
	captureBuildCandidate,
	captureWorkflowBackup,
	changedPathsBetween,
	claimTarget,
	teardownTarget,
} from "./target";
import { type ProductOwnerSession, runWorkflowStage } from "./workflow";

async function createRunFiles(timestamp: string) {
	const directory = join(CONTROL_DIR, ".benchmark-runs");
	const name = timestamp.replaceAll(":", "-");

	await mkdir(directory, { recursive: true });

	return {
		artifact: join(directory, `${name}.json`),
		review: join(directory, `${name}.review.json`),
		stage: (stage: string) => join(directory, `${name}.${stage}.json`),
	};
}

async function writeArtifact(path: string, artifact: RunArtifact) {
	await Bun.write(path, `${JSON.stringify(artifact, null, 2)}\n`);
}

const SIGNAL_EXIT_CODES: Partial<Record<NodeJS.Signals, number>> = {
	SIGTERM: 143,
	SIGHUP: 129,
};

interface BuildEvidence {
	readonly resultSha: string;
	readonly diff: string;
	readonly changedPaths: readonly string[];
	readonly checkIntegrity: LocalCheckResult;
	readonly localChecks: LocalCheckResult;
	readonly taskState: string;
}

export interface RunArtifactInputs {
	readonly timestamp: string;
	readonly controlSha: string;
	readonly source: {
		readonly root: string;
		readonly origin?: string;
		readonly sha: string;
	};
	readonly taskSha: string;
	readonly config: BenchmarkConfig;
	readonly pipeline: PipelineDefinition;
	readonly claudeVersion: string;
	readonly task: string;
	readonly productBrief: string;
	readonly instructions: string;
	readonly rubric: string;
	readonly rubricIds: readonly string[];
	readonly baselineContext: readonly ContextFile[];
	readonly taskId: string;
	readonly productOwner: ProductOwnerSession;
	readonly workflow: readonly StageTranscript[];
	readonly stageScorecards: readonly StageScorecard[];
	readonly evidence: BuildEvidence;
	readonly judge: { readonly prompt: string; readonly grade: JudgeGrade };
	readonly reviewFile: string;
}

export function buildRunArtifact(inputs: RunArtifactInputs): RunArtifact {
	const { source, config, evidence, judge, productOwner } = inputs;

	return {
		status: "AWAITING_HUMAN_REVIEW",
		timestamp: inputs.timestamp,
		controlSha: inputs.controlSha,
		sourceRoot: source.root,
		sourceOrigin: source.origin,
		sourceSha: source.sha,
		taskSha: inputs.taskSha,
		resultSha: evidence.resultSha,
		model: config.model,
		effort: config.effort,
		judgeModel: config.judgeModel,
		judgeEffort: config.judgeEffort,
		sessionBudgetUsd: config.sessionBudgetUsd,
		bunVersion: Bun.version,
		claudeVersion: inputs.claudeVersion.trim(),
		task: inputs.task,
		productBrief: inputs.productBrief,
		instructions: inputs.instructions,
		rubric: inputs.rubric,
		rubricIds: inputs.rubricIds,
		pipelinePath: config.pipelinePath,
		pipeline: inputs.pipeline,
		baselineContext: inputs.baselineContext,
		taskId: inputs.taskId,
		productOwnerSessionId: productOwner.sessionId,
		productOwnerCostUsd: productOwner.spentUsd,
		workflow: inputs.workflow,
		stageScorecards: inputs.stageScorecards,
		taskState: evidence.taskState,
		judgePrompt: judge.prompt,
		diff: evidence.diff,
		checkIntegrity: evidence.checkIntegrity,
		localChecks: evidence.localChecks,
		grade: judge.grade,
		reviewFile: inputs.reviewFile,
	};
}

export interface StageDependencies {
	readonly runWorkflowStage: typeof runWorkflowStage;
	readonly runStageJudge: typeof runStageJudge;
	readonly readTaskOutput: typeof readTaskOutput;
	readonly captureBuildCandidate: typeof captureBuildCandidate;
	readonly assertPlanningStageCompleted: typeof assertPlanningStageCompleted;
	readonly assertBuildCommitted: typeof assertBuildCommitted;
	readonly changedPathsBetween: typeof changedPathsBetween;
	readonly captureCheckIntegrity: typeof captureCheckIntegrity;
	readonly captureTreatmentChecks: typeof captureTreatmentChecks;
}

export interface PendingStage {
	readonly file: string;
	readonly stage: WorkflowStage;
	readonly input: StageJudgeInput;
}

export interface StageContext {
	readonly targetDir: string;
	readonly productOwnerDirectory: string;
	readonly model: string;
	readonly effort?: Effort;
	readonly judgeModel: string;
	readonly judgeEffort?: Effort;
	readonly sessionBudgetUsd: number;
	readonly productOwner: ProductOwnerSession;
	readonly task: string;
	readonly productBrief: string;
	readonly instructions: string;
	readonly baselineContext: readonly ContextFile[];
	readonly baselineHashes: ReadonlyMap<string, string>;
	readonly taskId: string;
	readonly taskSha: string;
	readonly pipeline: PipelineDefinition;
	readonly stageFile: (stage: WorkflowStage) => string;
	readonly log: (message: string) => void;
	readonly trackPendingStage: (pending: PendingStage | undefined) => void;
	readonly calibrateStageFailure: (
		stageScorecards: readonly StageScorecard[],
	) => Promise<CalibrationResult>;
}

export interface StageOutcome {
	readonly workflow: readonly StageTranscript[];
	readonly stageScorecards: readonly StageScorecard[];
	readonly buildEvidence?: BuildEvidence;
}

export async function runGradedStages(
	dependencies: StageDependencies,
	context: StageContext,
): Promise<StageOutcome> {
	const workflow: StageTranscript[] = [];
	const stageScorecards: StageScorecard[] = [];
	const stageArtifacts: ContextFile[] = [];
	let buildEvidence: BuildEvidence | undefined;

	for (const definition of context.pipeline.stages) {
		const stage = definition.name;
		context.log(`\n${stage[0]?.toUpperCase()}${stage.slice(1)} session`);
		const transcript = await dependencies.runWorkflowStage(
			context.targetDir,
			context.productOwnerDirectory,
			context.model,
			context.effort,
			context.sessionBudgetUsd,
			context.productOwner,
			context.task,
			context.productBrief,
			context.taskId,
			stage,
			definition.skill,
		);
		workflow.push(transcript);

		const currentTaskOutput = await dependencies.readTaskOutput(
			context.targetDir,
			context.taskId,
		);
		const buildCandidate =
			definition.kind === "delivery"
				? await dependencies.captureBuildCandidate(
						context.targetDir,
						context.taskSha,
					)
				: undefined;
		const baseInput: StageJudgeInput = {
			stage,
			kind: definition.kind,
			task: context.task,
			productBrief: context.productBrief,
			instructions: context.instructions,
			baselineContext: context.baselineContext,
			taskState: currentTaskOutput,
			transcript,
			priorArtifacts: [...stageArtifacts],
			diff: buildCandidate?.diff,
			changedPaths: buildCandidate?.changedPaths,
		};
		const input = await captureStageJudgeInput(baseInput, async () => {
			if (definition.kind === "planning") {
				const currentTask = parseTaskState(currentTaskOutput);
				const planning = await dependencies.assertPlanningStageCompleted(
					context.targetDir,
					context.taskSha,
					definition,
					currentTask,
				);
				stageArtifacts.push(planning.artifact);

				return {
					...baseInput,
					taskState: planning.taskState,
					artifact: planning.artifact,
				};
			}

			const build = await dependencies.assertBuildCommitted(
				context.targetDir,
				context.taskSha,
			);
			buildEvidence = {
				resultSha: build.resultSha,
				diff: build.diff,
				changedPaths: await dependencies.changedPathsBetween(
					context.targetDir,
					context.taskSha,
					build.resultSha,
				),
				checkIntegrity: await dependencies.captureCheckIntegrity(
					context.targetDir,
					context.baselineHashes,
				),
				localChecks: await dependencies.captureTreatmentChecks(
					context.targetDir,
				),
				taskState: currentTaskOutput,
			};

			return {
				...baseInput,
				taskState: buildEvidence.taskState,
				diff: buildEvidence.diff,
				changedPaths: buildEvidence.changedPaths,
				checkIntegrity: buildEvidence.checkIntegrity,
				localChecks: buildEvidence.localChecks,
			};
		});

		context.log(`\n${stage} stage Judge`);
		const stageFile = context.stageFile(stage);
		await Bun.write(
			stageFile,
			`${JSON.stringify(
				{ status: "AWAITING_STAGE_JUDGE", stage, input },
				null,
				2,
			)}\n`,
		);
		context.trackPendingStage({ file: stageFile, stage, input });
		const scorecard = await dependencies.runStageJudge(
			context.judgeModel,
			context.judgeEffort,
			context.sessionBudgetUsd,
			input,
			await loadStageRubric(definition),
		);
		context.trackPendingStage(undefined);
		stageScorecards.push(scorecard);
		await Bun.write(stageFile, `${JSON.stringify(scorecard, null, 2)}\n`);
		context.log(JSON.stringify(scorecard.grade, null, 2));
		if (scorecard.grade.verdict === "STOP") {
			const calibration = await context.calibrateStageFailure(stageScorecards);
			await Bun.write(
				stageFile,
				`${JSON.stringify({ ...scorecard, calibration }, null, 2)}\n`,
			);
		}
		assertStageGradePassed(scorecard);
	}

	return { workflow, stageScorecards, buildEvidence };
}

export async function runBenchmark(config: BenchmarkConfig, rl: Questioner) {
	const pipeline = await loadPipeline(config.pipelinePath);
	const controlSha = await assertControlReady();
	const source = await assertSourceReady(config.sourceDir);
	const workflowBackup = await captureWorkflowBackup(source.root);
	const productOwnerDirectory = await mkdtemp(join(tmpdir(), "rehearsal-po-"));
	const timestamp = new Date().toISOString();
	const runFiles = await createRunFiles(timestamp);
	let stageFailureCalibrated = false;
	let pendingArtifact: RunArtifact | undefined;
	let pendingStage: PendingStage | undefined;

	let abortRecorded: Promise<void> | undefined;
	const markAborted = (reason: string) => {
		abortRecorded ??= (async () => {
			try {
				if (pendingStage) {
					await Bun.write(
						pendingStage.file,
						`${JSON.stringify(
							{
								status: "STAGE_JUDGE_FAILED",
								stage: pendingStage.stage,
								error: reason,
								input: pendingStage.input,
							},
							null,
							2,
						)}\n`,
					);
				}
				if (pendingArtifact) {
					await writeArtifact(runFiles.artifact, {
						...pendingArtifact,
						status: "FAILED",
					});
				}
			} catch (writeError) {
				console.error(
					`Failed to update run artifacts: ${writeError instanceof Error ? writeError.message : String(writeError)}`,
				);
			}
		})();

		return abortRecorded;
	};
	let teardownStarted: Promise<void> | undefined;
	const teardown = () => {
		teardownStarted ??= teardownTarget(source, workflowBackup);
		return teardownStarted;
	};
	let aborting: Promise<void> | undefined;
	const restoreOnSignal = (signal: NodeJS.Signals) => {
		console.error(`\nReceived ${signal}; restoring the target before exit.`);
		aborting ??= (teardownStarted ? Promise.resolve() : killActiveCommands())
			.then(() => markAborted(`run interrupted by ${signal}`))
			.then(teardown)
			.catch((error) =>
				console.error(error instanceof Error ? error.message : String(error)),
			);
		aborting.finally(() => process.exit(SIGNAL_EXIT_CODES[signal] ?? 130));
	};
	const releaseSignalHandlers = () => {
		process.off("SIGINT", restoreOnSignal);
		process.off("SIGTERM", restoreOnSignal);
		process.off("SIGHUP", restoreOnSignal);
	};
	process.on("SIGINT", restoreOnSignal);
	process.on("SIGTERM", restoreOnSignal);
	process.on("SIGHUP", restoreOnSignal);

	try {
		await claimTarget(source);
	} catch (error) {
		releaseSignalHandlers();
		throw error;
	}

	try {
		console.log(`Target: ${source.root}`);
		console.log(`Original commit: ${source.sha}`);
		console.log(`Workflow backup: ${workflowBackup.directory}`);
		await runChecks(source.root, "Baseline checks");
		await assertWorkspaceCleanAt(source.root, source.sha);
		const baselineHashes = await captureFileHashes(source.root);
		const baselineContext = await captureBaselineContext(source.root);
		const [task, productBrief, instructions, rubric, claudeVersion] =
			await Promise.all([
				Bun.file(join(CONTROL_DIR, "backlog-seed.md")).text(),
				Bun.file(join(CONTROL_DIR, "product-brief.md")).text(),
				Bun.file(join(CONTROL_DIR, "CLAUDE.md")).text(),
				Bun.file(join(CONTROL_DIR, "rubric.md")).text(),
				runCommand(["claude", "--version"], CONTROL_DIR),
			]);
		const rubricIds = validateRubricDefinition(rubric);
		const { taskId, taskSha } = await createTaskCommit(
			source.root,
			task,
			instructions,
		);
		const productOwner: ProductOwnerSession = {
			sessionId: randomUUID(),
			spentUsd: 0,
			started: false,
		};
		const { workflow, stageScorecards, buildEvidence } = await runGradedStages(
			{
				runWorkflowStage,
				runStageJudge,
				readTaskOutput,
				captureBuildCandidate,
				assertPlanningStageCompleted,
				assertBuildCommitted,
				changedPathsBetween,
				captureCheckIntegrity,
				captureTreatmentChecks,
			},
			{
				targetDir: source.root,
				productOwnerDirectory,
				model: config.model,
				effort: config.effort,
				judgeModel: config.judgeModel,
				judgeEffort: config.judgeEffort,
				sessionBudgetUsd: config.sessionBudgetUsd,
				productOwner,
				task,
				productBrief,
				instructions,
				baselineContext,
				baselineHashes,
				taskId,
				taskSha,
				pipeline,
				stageFile: runFiles.stage,
				log: console.log,
				trackPendingStage: (pending) => {
					pendingStage = pending;
				},
				calibrateStageFailure: async (stageScorecards) => {
					const calibration = await collectCalibration({
						rl,
						reviewFile: runFiles.review,
						targetDir: source.root,
						originalInstructions: instructions,
						originalRubric: rubric,
						stageScorecards,
						judgeModel: config.judgeModel,
						judgeEffort: config.judgeEffort,
						sessionBudgetUsd: config.sessionBudgetUsd,
					});
					stageFailureCalibrated = true;

					return calibration;
				},
			},
		);

		if (!buildEvidence) {
			throw new Error("Build stage did not run");
		}
		const evidence = buildEvidence;

		console.log("\nJudge session");
		const judge = await runJudge(
			config.judgeModel,
			config.judgeEffort,
			config.sessionBudgetUsd,
			rubric,
			baselineContext,
			evidence.diff,
			evidence.changedPaths,
			evidence.checkIntegrity,
			evidence.localChecks,
		);
		const { grade } = judge;
		console.log(JSON.stringify(grade, null, 2));
		const artifact = buildRunArtifact({
			timestamp,
			controlSha,
			source,
			taskSha,
			config,
			pipeline,
			claudeVersion,
			task,
			productBrief,
			instructions,
			rubric,
			rubricIds,
			baselineContext,
			taskId,
			productOwner,
			workflow,
			stageScorecards,
			evidence,
			judge,
			reviewFile: runFiles.review,
		});
		await writeArtifact(runFiles.artifact, artifact);
		pendingArtifact = artifact;
		console.log(`Run artifact: ${runFiles.artifact}`);
		console.log(`Human review: ${runFiles.review}`);

		const calibration = await collectCalibration({
			rl,
			reviewFile: runFiles.review,
			targetDir: source.root,
			originalInstructions: instructions,
			originalRubric: rubric,
			finalCandidate: {
				originalGrade: grade,
				baselineContext,
				diff: evidence.diff,
				changedPaths: evidence.changedPaths,
				checkIntegrity: evidence.checkIntegrity,
				localChecks: evidence.localChecks,
			},
			stageScorecards,
			judgeModel: config.judgeModel,
			judgeEffort: config.judgeEffort,
			sessionBudgetUsd: config.sessionBudgetUsd,
		});
		await writeArtifact(runFiles.artifact, {
			...artifact,
			status: "COMPLETE",
			calibration,
		});
		pendingArtifact = undefined;
		console.log("Calibration recorded; restoring the target.");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(message);
		await markAborted(message);
		if (!stageFailureCalibrated) {
			try {
				await rl.question(
					`The run failed. Inspect ${source.root} if useful, then press Enter to restore the target.`,
				);
			} catch {
				console.error("No interactive stdin; restoring the target now.");
			}
		}
		throw error;
	} finally {
		try {
			await teardown();
		} finally {
			releaseSignalHandlers();
			await rm(productOwnerDirectory, { force: true, recursive: true });
		}
	}
}
