import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assertPlanningStageCompleted,
	createTaskCommit,
	parseTaskState,
	readTaskCard,
	readTaskOutput,
} from "./backlog";
import type { Questioner } from "./calibration";
import { collectCalibration } from "./calibration";
import type { CheckpointRecord, HashedFile } from "./checkpoint";
import {
	captureStageCorpus,
	GLOBAL_SKILLS,
	hashArtifacts,
	hashWorkflowState,
	INITIAL_CHECKPOINT_STAGE,
	initialCheckpointInputs,
	recordCheckpoint,
	resolveSkillDirectory,
	skillSearchRoots,
} from "./checkpoint";
import {
	captureBaselineContext,
	captureCheckIntegrity,
	captureFileHashes,
	captureTreatmentChecks,
	runChecks,
} from "./checks";
import { killActiveCommands, runCommand } from "./command";
import type { BenchmarkConfig, Effort, WorkflowStage } from "./config";
import { CONTROL_DIR } from "./config";
import type {
	CalibrationResult,
	ContextFile,
	FailedJudgeRunArtifact,
	GradedRunArtifact,
	LocalCheckResult,
	RunArtifact,
	RunArtifactEvidence,
	StageJudgeInput,
	StageScorecard,
	StageTranscript,
} from "./contracts";
import type { JudgeAttempt, JudgeInvoker } from "./judge-attempt";
import { JudgeOutputValidationError } from "./judge-attempt";
import type { JudgeResult } from "./judge";
import { runJudge, validateRubricDefinition } from "./judge";
import { writeRunManifest } from "./manifest";
import type { PipelineDefinition, StageDefinition } from "./pipeline";
import { loadPipeline } from "./pipeline";
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
	recordRetentionRef,
	teardownTarget,
} from "./target";
import type { ProductOwner, ProductOwnerSnapshot } from "./workflow";
import { createProductOwner, runWorkflowStage } from "./workflow";

async function createRunFiles(timestamp: string): Promise<{
	name: string;
	artifact: string;
	review: string;
	stage: (stage: string) => string;
	checkpointsRoot: string;
	checkpoint: (stage: string) => string;
}> {
	const directory = join(CONTROL_DIR, ".benchmark-runs");
	const name = timestamp.replaceAll(":", "-");

	await mkdir(directory, { recursive: true });

	return {
		name,
		artifact: join(directory, `${name}.json`),
		review: join(directory, `${name}.review.json`),
		stage: (stage: string) => join(directory, `${name}.${stage}.json`),
		checkpointsRoot: join(directory, `${name}.checkpoints`),
		checkpoint: (stage: string) =>
			join(directory, `${name}.checkpoints`, stage),
	};
}

async function writeArtifact(
	path: string,
	artifact: RunArtifact,
): Promise<void> {
	await Bun.write(path, `${JSON.stringify(artifact, null, 2)}\n`);
}

function signalExitCode(signal: NodeJS.Signals): number {
	if (signal === "SIGTERM") {
		return 143;
	}
	if (signal === "SIGHUP") {
		return 129;
	}
	return 130;
}

export interface BuildEvidence {
	readonly resultSha: string;
	readonly diff: string;
	readonly changedPaths: readonly string[];
	readonly checkIntegrity: LocalCheckResult;
	readonly localChecks: LocalCheckResult;
	readonly taskState: string;
}

export interface RunArtifactBaseInputs {
	readonly timestamp: string;
	readonly controlSha: string;
	readonly source: {
		readonly root: string;
		readonly origin?: string | undefined;
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
	readonly productOwner: ProductOwnerSnapshot;
	readonly workflow: readonly StageTranscript[];
	readonly stageScorecards: readonly StageScorecard[];
	readonly checkpoints: readonly CheckpointRecord[];
	readonly evidence: BuildEvidence;
}

export interface RunArtifactInputs extends RunArtifactBaseInputs {
	readonly judge: JudgeResult;
	readonly reviewFile: string;
}

function runArtifactEvidence(
	inputs: RunArtifactBaseInputs,
	judge: Pick<JudgeResult, "prompt" | "attempts" | "costUsd">,
): RunArtifactEvidence {
	const { source, config, evidence, productOwner } = inputs;

	return {
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
		checkpoints: inputs.checkpoints,
		taskState: evidence.taskState,
		judgePrompt: judge.prompt,
		judgeAttempts: judge.attempts,
		judgeCostUsd: judge.costUsd,
		diff: evidence.diff,
		changedPaths: evidence.changedPaths,
		checkIntegrity: evidence.checkIntegrity,
		localChecks: evidence.localChecks,
	};
}

export function buildRunArtifact(inputs: RunArtifactInputs): GradedRunArtifact {
	return {
		...runArtifactEvidence(inputs, inputs.judge),
		status: "AWAITING_HUMAN_REVIEW",
		grade: inputs.judge.grade,
		reviewFile: inputs.reviewFile,
	};
}

export function buildFailedJudgeRunArtifact(
	inputs: RunArtifactBaseInputs,
	failure: Readonly<JudgeOutputValidationError>,
): FailedJudgeRunArtifact {
	return {
		...runArtifactEvidence(inputs, failure),
		status: "FAILED",
		failure: failure.message,
	};
}

export interface FinalJudgeRequest {
	readonly artifactFile: string;
	readonly artifactInputs: RunArtifactBaseInputs;
	readonly invoke?: JudgeInvoker | undefined;
}

export async function runFinalJudge(
	request: FinalJudgeRequest,
): Promise<JudgeResult> {
	const { artifactInputs: inputs } = request;
	const { config, evidence } = inputs;

	try {
		return await runJudge(
			config.judgeModel,
			config.judgeEffort,
			config.sessionBudgetUsd,
			inputs.rubric,
			inputs.baselineContext,
			evidence.diff,
			evidence.changedPaths,
			evidence.checkIntegrity,
			evidence.localChecks,
			request.invoke,
		);
	} catch (error) {
		if (error instanceof JudgeOutputValidationError) {
			await writeArtifact(
				request.artifactFile,
				buildFailedJudgeRunArtifact(inputs, error),
			);
		}

		throw error;
	}
}

/**
 * Records the checkpoint and then pins its commit under refs/rehearsal, in
 * that order: an unpinned checkpoint is a gc race, a stray ref without a
 * checkpoint is only debris.
 */
export function retainedCheckpointRecorder(
	runName: string,
): typeof recordCheckpoint {
	return async (targetDir, directory, inputs) => {
		const record = await recordCheckpoint(targetDir, directory, inputs);
		await recordRetentionRef(targetDir, runName, inputs.targetSha);

		return record;
	};
}

export interface StageSessionDependencies {
	readonly runWorkflowStage: typeof runWorkflowStage;
	readonly readTaskOutput: typeof readTaskOutput;
	readonly readTaskCard: typeof readTaskCard;
	readonly captureBuildCandidate: typeof captureBuildCandidate;
	readonly assertPlanningStageCompleted: typeof assertPlanningStageCompleted;
	readonly assertBuildCommitted: typeof assertBuildCommitted;
	readonly changedPathsBetween: typeof changedPathsBetween;
	readonly captureCheckIntegrity: typeof captureCheckIntegrity;
	readonly captureTreatmentChecks: typeof captureTreatmentChecks;
	readonly captureStageCorpus: typeof captureStageCorpus;
}

export interface StageDependencies extends StageSessionDependencies {
	readonly runStageJudge: typeof runStageJudge;
	readonly resolveSkillDirectory: typeof resolveSkillDirectory;
	readonly recordCheckpoint: typeof recordCheckpoint;
}

export interface PendingStage {
	readonly file: string;
	readonly stage: WorkflowStage;
	readonly input: StageJudgeInput;
	readonly failure?:
		| {
				readonly prompt: string;
				readonly attempts: readonly JudgeAttempt[];
				readonly costUsd: number;
		  }
		| undefined;
}

export async function writeStageJudgeFailure(
	pending: PendingStage,
	reason: string,
): Promise<void> {
	await Bun.write(
		pending.file,
		`${JSON.stringify(
			{
				status: "STAGE_JUDGE_FAILED",
				stage: pending.stage,
				error: reason,
				input: pending.input,
				...pending.failure,
			},
			null,
			2,
		)}\n`,
	);
}

export interface StageContext {
	readonly targetDir: string;
	readonly initialLineage: string;
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly judgeModel: string;
	readonly judgeEffort?: Effort | undefined;
	readonly sessionBudgetUsd: number;
	readonly productOwner: ProductOwner;
	readonly task: string;
	readonly productBrief: string;
	readonly instructions: string;
	readonly baselineContext: readonly ContextFile[];
	readonly baselineHashes: ReadonlyMap<string, string>;
	readonly taskId: string;
	readonly taskSha: string;
	readonly pipeline: PipelineDefinition;
	readonly stageFile: (stage: WorkflowStage) => string;
	readonly checkpointDirectory: (stage: WorkflowStage) => string;
	readonly log: (message: string) => void;
	readonly trackPendingStage: (pending: PendingStage | undefined) => void;
	readonly calibrateStageFailure: (
		stageScorecards: readonly StageScorecard[],
	) => Promise<CalibrationResult>;
}

export interface StageOutcome {
	readonly workflow: readonly StageTranscript[];
	readonly stageScorecards: readonly StageScorecard[];
	readonly checkpoints: readonly CheckpointRecord[];
	readonly buildEvidence?: BuildEvidence | undefined;
}

export interface StageSessionEnvironment {
	readonly targetDir: string;
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly sessionBudgetUsd: number;
	readonly productOwner: ProductOwner;
	readonly task: string;
	readonly productBrief: string;
	readonly instructions: string;
	readonly baselineContext: readonly ContextFile[];
	readonly baselineHashes: ReadonlyMap<string, string>;
	readonly taskId: string;
	readonly taskSha: string;
	readonly baselineSha: string;
	readonly commitSubjectPattern?: string | undefined;
	readonly skillRoots: readonly string[];
	readonly log: (message: string) => void;
}

export interface StageSessionResult {
	readonly resultSha: string;
	readonly corpusFiles: readonly HashedFile[];
	readonly transcript: StageTranscript;
	readonly input: StageJudgeInput;
	readonly artifact?: ContextFile | undefined;
	readonly buildEvidence?: BuildEvidence | undefined;
}

/**
 * One stage session up to its judge-ready evidence: run the skill, read the
 * task state, and validate the stage's delivery. Shared by the run's stage
 * loop and by replay, which differ in what happens to the evidence, never in
 * how a stage produces it.
 */
export async function executeStageSession(
	dependencies: StageSessionDependencies,
	environment: StageSessionEnvironment,
	definition: StageDefinition,
	priorArtifacts: readonly ContextFile[],
): Promise<StageSessionResult> {
	const stage = definition.name;
	const corpusFiles = await dependencies.captureStageCorpus(
		definition.skill,
		environment.instructions,
		environment.skillRoots,
	);
	environment.log(`\n${stage[0]?.toUpperCase()}${stage.slice(1)} session`);
	const transcript = await dependencies.runWorkflowStage(
		environment.targetDir,
		environment.model,
		environment.effort,
		environment.sessionBudgetUsd,
		environment.productOwner,
		environment.taskId,
		stage,
		definition.skill,
	);

	const currentTaskOutput = await dependencies.readTaskOutput(
		environment.targetDir,
		environment.taskId,
	);
	const taskCard = await dependencies.readTaskCard(
		environment.targetDir,
		environment.taskId,
	);
	const buildCandidate =
		definition.kind === "delivery"
			? await dependencies.captureBuildCandidate(
					environment.targetDir,
					environment.taskSha,
				)
			: undefined;
	const baseInput: StageJudgeInput = {
		stage,
		kind: definition.kind,
		task: environment.task,
		productBrief: environment.productBrief,
		instructions: environment.instructions,
		baselineContext: environment.baselineContext,
		taskState: taskCard,
		transcript,
		priorArtifacts: [...priorArtifacts],
		diff: buildCandidate?.diff,
		changedPaths: buildCandidate?.changedPaths,
	};
	let artifact: ContextFile | undefined;
	let buildEvidence: BuildEvidence | undefined;
	let resultSha = environment.baselineSha;
	const input = await captureStageJudgeInput(baseInput, async () => {
		if (definition.kind === "planning") {
			const currentTask = parseTaskState(currentTaskOutput);
			const planning = await dependencies.assertPlanningStageCompleted(
				environment.targetDir,
				environment.baselineSha,
				definition,
				currentTask,
			);
			({ artifact, resultSha } = planning);

			return {
				...baseInput,
				artifact: planning.artifact,
				diff: planning.changedPaths.length > 0 ? planning.diff : undefined,
				changedPaths:
					planning.changedPaths.length > 0 ? planning.changedPaths : undefined,
			};
		}

		const build = await dependencies.assertBuildCommitted(
			environment.targetDir,
			environment.baselineSha,
			"main",
			environment.commitSubjectPattern,
		);
		({ resultSha } = build);
		buildEvidence = {
			resultSha: build.resultSha,
			diff: build.diff,
			changedPaths: await dependencies.changedPathsBetween(
				environment.targetDir,
				environment.baselineSha,
				build.resultSha,
			),
			checkIntegrity: await dependencies.captureCheckIntegrity(
				environment.targetDir,
				environment.baselineHashes,
			),
			localChecks: await dependencies.captureTreatmentChecks(
				environment.targetDir,
			),
			taskState: taskCard,
		};

		return {
			...baseInput,
			diff: buildEvidence.diff,
			changedPaths: buildEvidence.changedPaths,
			checkIntegrity: buildEvidence.checkIntegrity,
			localChecks: buildEvidence.localChecks,
		};
	});

	return { resultSha, corpusFiles, transcript, input, artifact, buildEvidence };
}

export async function runGradedStages(
	dependencies: StageDependencies,
	context: StageContext,
): Promise<StageOutcome> {
	const workflow: StageTranscript[] = [];
	const stageScorecards: StageScorecard[] = [];
	const stageArtifacts: ContextFile[] = [];
	const checkpoints: CheckpointRecord[] = [];
	let buildEvidence: BuildEvidence | undefined;

	// Every skill is resolved before any stage runs, so a missing one fails
	// the run before the first session is paid for. The global skills are
	// resolved too, because every stage's corpus hashes them. Hashing waits
	// for each stage's start: the lineage must record the corpus that fed the
	// stage, and a skill can change while earlier stages run.
	const skillRoots = skillSearchRoots(context.targetDir);
	for (const skill of [
		...GLOBAL_SKILLS,
		...context.pipeline.stages.map(({ skill: name }) => name),
	]) {
		await dependencies.resolveSkillDirectory(skill, skillRoots);
	}
	let upstream = context.initialLineage;
	let baselineSha = context.taskSha;

	for (const definition of context.pipeline.stages) {
		const stage = definition.name;
		const session = await executeStageSession(
			dependencies,
			{
				...context,
				skillRoots,
				baselineSha,
				commitSubjectPattern: context.pipeline.commitSubjectPattern,
			},
			definition,
			stageArtifacts,
		);
		const { corpusFiles, input } = session;
		workflow.push(session.transcript);
		if (session.artifact) {
			stageArtifacts.push(session.artifact);
		}
		if (session.buildEvidence) {
			({ buildEvidence } = session);
		}

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
		const pendingStage = { file: stageFile, stage, input };
		context.trackPendingStage(pendingStage);
		let scorecard: StageScorecard;
		try {
			scorecard = await dependencies.runStageJudge(
				context.judgeModel,
				context.judgeEffort,
				context.sessionBudgetUsd,
				input,
				await loadStageRubric(definition),
			);
		} catch (error) {
			if (error instanceof JudgeOutputValidationError) {
				context.trackPendingStage({
					...pendingStage,
					failure: {
						prompt: error.prompt,
						attempts: error.attempts,
						costUsd: error.costUsd,
					},
				});
			}

			throw error;
		}
		context.trackPendingStage(undefined);
		stageScorecards.push(scorecard);
		const stageRecord = {
			...scorecard,
			corpusFiles,
			model: context.model,
			effort: context.effort,
		};
		await Bun.write(stageFile, `${JSON.stringify(stageRecord, null, 2)}\n`);
		context.log(JSON.stringify(scorecard.grade, null, 2));
		if (scorecard.grade.verdict === "STOP") {
			const calibration = await context.calibrateStageFailure(stageScorecards);
			await Bun.write(
				stageFile,
				`${JSON.stringify({ ...stageRecord, calibration }, null, 2)}\n`,
			);
		}
		assertStageGradePassed(scorecard);

		baselineSha = session.resultSha;
		const checkpoint = await dependencies.recordCheckpoint(
			context.targetDir,
			context.checkpointDirectory(stage),
			{
				stage,
				targetSha: session.resultSha,
				upstream,
				model: context.model,
				effort: context.effort,
				corpusFiles,
				artifacts: hashArtifacts(input.artifact ? [input.artifact] : []),
			},
		);
		checkpoints.push(checkpoint);
		upstream = checkpoint.lineage;
	}

	return { workflow, stageScorecards, checkpoints, buildEvidence };
}

export async function runBenchmark(
	config: BenchmarkConfig,
	rl: Questioner,
): Promise<void> {
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
	const markAborted = (reason: string): Promise<void> => {
		abortRecorded ??= (async () => {
			try {
				if (pendingStage) {
					await writeStageJudgeFailure(pendingStage, reason);
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
	const teardown = (): Promise<void> => {
		teardownStarted ??= teardownTarget(source, workflowBackup);
		return teardownStarted;
	};
	let abortStarted = false;
	const abortAndExit = async (signal: NodeJS.Signals): Promise<void> => {
		try {
			if (!teardownStarted) {
				await killActiveCommands();
			}
			await markAborted(`run interrupted by ${signal}`);
			await teardown();
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
		} finally {
			process.exit(signalExitCode(signal));
		}
	};
	const restoreOnSignal = (signal: NodeJS.Signals): void => {
		console.error(`\nReceived ${signal}; restoring the target before exit.`);
		if (abortStarted) {
			return;
		}
		abortStarted = true;
		void abortAndExit(signal);
	};
	const releaseSignalHandlers = (): void => {
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
			pipeline.statuses,
		);
		const recordRetainedCheckpoint = retainedCheckpointRecorder(runFiles.name);
		await writeRunManifest(runFiles.checkpointsRoot, {
			timestamp,
			controlSha,
			sourceRoot: source.root,
			sourceSha: source.sha,
			taskId,
			taskSha,
			task,
			productBrief,
			model: config.model,
			effort: config.effort,
			judgeModel: config.judgeModel,
			judgeEffort: config.judgeEffort,
			sessionBudgetUsd: config.sessionBudgetUsd,
			pipelinePath: config.pipelinePath,
			pipeline,
		});
		const initialCheckpoint = await recordRetainedCheckpoint(
			source.root,
			runFiles.checkpoint(INITIAL_CHECKPOINT_STAGE),
			initialCheckpointInputs(
				{
					taskSha,
					task,
					productBrief,
					workflowFiles: await hashWorkflowState(source.root),
				},
				config.model,
				config.effort,
			),
		);
		const productOwner = createProductOwner({
			directory: productOwnerDirectory,
			model: config.model,
			effort: config.effort,
			sessionBudgetUsd: config.sessionBudgetUsd,
			task,
			productBrief,
		});
		const { workflow, stageScorecards, checkpoints, buildEvidence } =
			await runGradedStages(
				{
					runWorkflowStage,
					runStageJudge,
					readTaskOutput,
					readTaskCard,
					captureBuildCandidate,
					assertPlanningStageCompleted,
					assertBuildCommitted,
					changedPathsBetween,
					captureCheckIntegrity,
					captureTreatmentChecks,
					resolveSkillDirectory,
					captureStageCorpus,
					recordCheckpoint: recordRetainedCheckpoint,
				},
				{
					targetDir: source.root,
					initialLineage: initialCheckpoint.lineage,
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
					checkpointDirectory: runFiles.checkpoint,
					log: console.log,
					trackPendingStage: (pending) => {
						pendingStage = pending;
					},
					calibrateStageFailure: async (scorecards) => {
						const calibration = await collectCalibration({
							rl,
							reviewFile: runFiles.review,
							targetDir: source.root,
							originalInstructions: instructions,
							originalRubric: rubric,
							stageScorecards: scorecards,
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
		// The build Judge saw only the delivery stage's own commits; the final
		// Judge grades the whole candidate, planning commits included.
		const fullCandidate = await captureBuildCandidate(source.root, taskSha);
		const evidence = {
			...buildEvidence,
			diff: fullCandidate.diff,
			changedPaths: fullCandidate.changedPaths,
		};

		const artifactInputs: RunArtifactBaseInputs = {
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
			productOwner: productOwner.snapshot(),
			workflow,
			stageScorecards,
			checkpoints: [initialCheckpoint, ...checkpoints],
			evidence,
		};

		console.log("\nJudge session");
		const judge = await runFinalJudge({
			artifactFile: runFiles.artifact,
			artifactInputs,
		});
		const { grade } = judge;
		console.log(JSON.stringify(grade, null, 2));
		const artifact = buildRunArtifact({
			...artifactInputs,
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
