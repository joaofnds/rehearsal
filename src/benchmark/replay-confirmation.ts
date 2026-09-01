import { cp, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
	deriveStaleness,
	snapshotStageCorpus,
	installStageCorpusSnapshot,
	INITIAL_CHECKPOINT_STAGE,
} from "./checkpoint";
import type { CheckpointRecord, HashedFile } from "./checkpoint";
import type { ProviderCall, StageScorecard } from "./contracts";
import type { ConfirmationCostProjection } from "./confirmation";
import { runConfirmation } from "./confirmation";
import type { ConfirmationRepRecord } from "./confirmation-record";
import { confirmationRepRecordSchema } from "./confirmation-record";
import type {
	ConfirmationRepResult,
	FrozenFile,
} from "./confirmation-evidence";
import {
	collectConfirmationMetrics,
	finalizeConfirmationGroup,
	frozenDirectoryFiles,
	settleCompletedConfirmationRep,
	settleDiagnosticConfirmationRep,
	writeFrozenFile,
} from "./confirmation-evidence";
import { JudgeOutputValidationError } from "./judge-attempt";
import { loadRunManifest } from "./manifest";
import {
	detachedStageDependencies,
	loadRunCheckpoints,
	readPriorArtifacts,
	resolveReplay,
} from "./replay";
import type { ReplayDependencies, ReplayRequest } from "./replay";
import type { StageSessionResult } from "./run";
import { executeStageSession } from "./run";
import { confirmationGroupPaths } from "./run-layout";
import { recordRetentionRef } from "./target";
import type { ProductOwner } from "./workflow";

interface FrozenReplayInputs {
	readonly manifest: Awaited<ReturnType<typeof loadRunManifest>>;
	readonly plan: ReturnType<typeof resolveReplay>;
	readonly checkpointDirectory: string;
	readonly corpusDirectory: string;
	readonly rubric: Awaited<ReturnType<ReplayDependencies["loadStageRubric"]>>;
	readonly instructions: string;
	readonly staleness: readonly {
		readonly stage: string;
		readonly causes: readonly string[];
	}[];
	readonly files: readonly FrozenFile[];
}

export interface ReplayConfirmationRequest extends ReplayRequest {
	readonly groupId: string;
	readonly reps: number;
	readonly corpusRoots: readonly string[];
	readonly projectedCost: ConfirmationCostProjection;
	readonly approvalMethod: "interactive" | "yes";
	readonly now?: (() => number) | undefined;
}

export interface ReplayConfirmationOutcome {
	readonly groupRecordFile: string;
	readonly reportFile: string;
	readonly repRecordFiles: readonly string[];
}

async function freezeReplayInputs(
	dependencies: ReplayDependencies,
	request: ReplayConfirmationRequest,
	groupDirectory: string,
	inputsDirectory: string,
): Promise<FrozenReplayInputs> {
	const manifest = await loadRunManifest(request.paths.manifestFile);
	const checkpoints = await loadRunCheckpoints(
		request.paths.checkpointsDirectory,
	);
	const plan = resolveReplay(manifest, checkpoints, request.stage);
	const checkpointDirectory = join(inputsDirectory, "checkpoint");
	await cp(
		request.paths.checkpointDirectory(plan.consumed.stage),
		checkpointDirectory,
		{ recursive: true },
	);

	const definitions = [
		...plan.chain.flatMap((record) => {
			if (record.stage === INITIAL_CHECKPOINT_STAGE) {
				return [];
			}

			const definition = manifest.pipeline.stages.find(
				({ name }) => name === record.stage,
			);
			if (definition === undefined) {
				throw new Error(
					`The run's pipeline no longer declares the ${record.stage} stage its checkpoint records`,
				);
			}

			return [definition];
		}),
		plan.definition,
	];
	const corpusRoot = join(inputsDirectory, "corpus");
	const corpusByStage = new Map<string, readonly HashedFile[]>();
	for (const definition of definitions) {
		if (corpusByStage.has(definition.name)) {
			continue;
		}

		corpusByStage.set(
			definition.name,
			await snapshotStageCorpus(
				definition.skill,
				request.instructions,
				request.corpusRoots,
				join(corpusRoot, definition.name),
			),
		);
	}
	const staleness = deriveStaleness(plan.chain, corpusByStage, {
		model: request.model,
		effort: request.effort,
	}).filter(({ stale }) => stale);
	const rubric = await dependencies.loadStageRubric(plan.definition);
	const files: FrozenFile[] = [
		...(await frozenDirectoryFiles(
			groupDirectory,
			checkpointDirectory,
			"checkpoint",
		)),
		...(await frozenDirectoryFiles(groupDirectory, corpusRoot, "corpus")),
		await writeFrozenFile(
			groupDirectory,
			join(inputsDirectory, "rubric.json"),
			rubric.content,
			"rubric",
		),
		await writeFrozenFile(
			groupDirectory,
			join(inputsDirectory, "instructions.md"),
			request.instructions,
			"instructions",
		),
		await writeFrozenFile(
			groupDirectory,
			join(inputsDirectory, "pipeline.json"),
			`${JSON.stringify(manifest.pipeline, null, 2)}\n`,
			"pipeline",
		),
		await writeFrozenFile(
			groupDirectory,
			join(inputsDirectory, "task.md"),
			manifest.task,
			"task",
		),
		await writeFrozenFile(
			groupDirectory,
			join(inputsDirectory, "product-brief.md"),
			manifest.productBrief,
			"product-brief",
		),
	];

	return {
		manifest,
		plan,
		checkpointDirectory,
		corpusDirectory: join(corpusRoot, plan.definition.name),
		rubric,
		instructions: request.instructions,
		staleness: staleness.map(({ stage, causes }) => ({ stage, causes })),
		files,
	};
}

interface JudgeRejection {
	readonly message: string;
	readonly prompt: string;
	readonly attempts: readonly ProviderCall[];
	readonly costUsd: number;
}

function completeRepRecord(
	request: ReplayConfirmationRequest,
	consumed: Pick<CheckpointRecord, "lineage" | "targetSha">,
	repId: string,
	ordinal: number,
	worktreePath: string,
	resultSha: string,
	scorecardFile: string,
	scorecard: StageScorecard,
	workerCalls: readonly ProviderCall[],
	productOwnerCalls: readonly ProviderCall[],
	stageElapsedMs: number,
	repElapsedMs: number,
): ConfirmationRepRecord {
	const evidence = collectConfirmationMetrics({
		worker: workerCalls,
		productOwner: productOwnerCalls,
		stageJudge: scorecard.attempts,
		finalJudge: undefined,
	});
	const successful =
		evidence.metrics.status === "COMPLETE" &&
		scorecard.grade.verdict === "CONTINUE" &&
		(scorecard.grade.grade === "A" || scorecard.grade.grade === "B");

	return confirmationRepRecordSchema.parse({
		schemaVersion: 1,
		groupId: request.groupId,
		repId,
		ordinal,
		mode: "stage",
		worktreePath,
		lineage: {
			kind: "CHECKPOINT",
			lineage: consumed.lineage,
			targetSha: consumed.targetSha,
		},
		outcome: successful ? "SUCCESSFUL" : "UNSUCCESSFUL",
		stages: [
			{
				stage: request.stage,
				status: "JUDGED",
				grade: scorecard.grade.grade,
				verdict: scorecard.grade.verdict,
				elapsedMs: stageElapsedMs,
				evidence: { resultSha, recordFile: scorecardFile },
			},
		],
		finalOutcome: { status: "NOT_APPLICABLE" },
		metrics: evidence.metrics,
		workerTrajectorySteps: evidence.workerTrajectorySteps,
		elapsedMs: repElapsedMs,
	});
}

function rejectedJudgeRepRecord(
	request: ReplayConfirmationRequest,
	consumed: Pick<CheckpointRecord, "lineage" | "targetSha">,
	repId: string,
	ordinal: number,
	worktreePath: string,
	resultSha: string,
	recordFile: string,
	error: JudgeRejection,
	workerCalls: readonly ProviderCall[],
	productOwnerCalls: readonly ProviderCall[],
	stageElapsedMs: number,
	repElapsedMs: number,
): ConfirmationRepRecord {
	const evidence = collectConfirmationMetrics({
		worker: workerCalls,
		productOwner: productOwnerCalls,
		stageJudge: error.attempts,
		finalJudge: undefined,
	});

	return confirmationRepRecordSchema.parse({
		schemaVersion: 1,
		groupId: request.groupId,
		repId,
		ordinal,
		mode: "stage",
		worktreePath,
		lineage: {
			kind: "CHECKPOINT",
			lineage: consumed.lineage,
			targetSha: consumed.targetSha,
		},
		outcome: "UNSUCCESSFUL",
		stages: [
			{
				stage: request.stage,
				status: "EXECUTION_FAILED",
				elapsedMs: stageElapsedMs,
				error: error.message,
				evidence: { resultSha, recordFile },
			},
		],
		finalOutcome: { status: "NOT_APPLICABLE" },
		metrics: evidence.metrics,
		workerTrajectorySteps: evidence.workerTrajectorySteps,
		elapsedMs: repElapsedMs,
	});
}

function failedRepRecord(
	request: ReplayConfirmationRequest,
	consumed: Pick<CheckpointRecord, "lineage" | "targetSha">,
	repId: string,
	ordinal: number,
	worktreePath: string,
	error: string,
	elapsedMs: number,
): ConfirmationRepRecord {
	return confirmationRepRecordSchema.parse({
		schemaVersion: 1,
		groupId: request.groupId,
		repId,
		ordinal,
		mode: "stage",
		worktreePath,
		lineage: {
			kind: "CHECKPOINT",
			lineage: consumed.lineage,
			targetSha: consumed.targetSha,
		},
		outcome: "UNSUCCESSFUL",
		stages: [
			{
				stage: request.stage,
				status: "EXECUTION_FAILED",
				elapsedMs,
				error,
				worktreePath,
			},
		],
		finalOutcome: { status: "NOT_APPLICABLE" },
		metrics: {
			status: "MISSING",
			calls: [],
			missing: ["stage evidence"],
		},
		workerTrajectorySteps: 0,
		elapsedMs,
	});
}

export async function runReplayConfirmation(
	dependencies: ReplayDependencies,
	request: ReplayConfirmationRequest,
): Promise<ReplayConfirmationOutcome> {
	const now = request.now ?? (() => performance.now());
	const paths = confirmationGroupPaths(
		request.paths.runsDirectory,
		request.groupId,
	);
	await mkdir(paths.inputsDirectory, { recursive: true });
	const frozen = await freezeReplayInputs(
		dependencies,
		request,
		paths.directory,
		paths.inputsDirectory,
	);
	const worktreesDirectory = await mkdtemp(
		join(tmpdir(), `rehearsal-${request.groupId}-`),
	);
	const makespanStart = now();
	const results = await runConfirmation(
		{
			groupId: request.groupId,
			reps: request.reps,
			frozenInputs: frozen,
			worktreePath: (repId) => join(worktreesDirectory, repId),
		},
		async (plan) => {
			const repPaths = paths.rep(plan.repId);
			await mkdir(repPaths.stagesDirectory, { recursive: true });
			const repStart = now();
			let worktreeCreated = false;
			let productOwner: ProductOwner | undefined;
			let session: StageSessionResult | undefined;
			let stageStart = repStart;
			let setupOperation: string | undefined = "worktree creation";
			try {
				await dependencies.addWorktree(
					frozen.manifest.sourceRoot,
					frozen.plan.consumed.targetSha,
					plan.worktreePath,
				);
				worktreeCreated = true;
				setupOperation = "checkpoint materialization";
				await dependencies.materializeCheckpoint(
					frozen.checkpointDirectory,
					plan.worktreePath,
				);
				setupOperation = "instruction installation";
				const baseSha = await dependencies.installInstructions(
					plan.worktreePath,
					frozen.instructions,
				);
				setupOperation = "corpus installation";
				await installStageCorpusSnapshot(
					frozen.corpusDirectory,
					plan.worktreePath,
				);
				if (frozen.plan.definition.kind === "delivery") {
					setupOperation = "dependency installation";
					await dependencies.installDependencies(plan.worktreePath);
				}
				setupOperation = "prior-artifact reading";
				const priorArtifacts = await readPriorArtifacts(
					plan.worktreePath,
					frozen.plan.priorArtifacts,
				);
				setupOperation = "baseline hash capture";
				const baselineHashes = await dependencies.captureFileHashes(
					plan.worktreePath,
				);
				setupOperation = "baseline-context capture";
				const baselineContext = await dependencies.captureBaselineContext(
					plan.worktreePath,
				);
				productOwner = dependencies.createProductOwner({
					directory: join(repPaths.directory, "product-owner"),
					model: request.model,
					effort: request.effort,
					sessionBudgetUsd: request.sessionBudgetUsd,
					task: frozen.manifest.task,
					productBrief: frozen.manifest.productBrief,
				});
				stageStart = now();
				setupOperation = undefined;
				session = await executeStageSession(
					detachedStageDependencies(dependencies.stageSession),
					{
						targetDir: plan.worktreePath,
						model: request.model,
						effort: request.effort,
						sessionBudgetUsd: request.sessionBudgetUsd,
						productOwner,
						task: frozen.manifest.task,
						productBrief: frozen.manifest.productBrief,
						instructions: frozen.instructions,
						baselineContext,
						baselineHashes,
						taskId: frozen.manifest.taskId,
						taskSha: baseSha,
						baselineSha: baseSha,
						commitSubjectPattern: frozen.manifest.pipeline.commitSubjectPattern,
						skillRoots: [join(plan.worktreePath, ".claude", "skills")],
						log: dependencies.log,
					},
					frozen.plan.definition,
					priorArtifacts,
				);
				const scorecard = await dependencies.runStageJudge(
					request.judgeModel,
					request.judgeEffort,
					request.sessionBudgetUsd,
					session.input,
					frozen.rubric,
				);
				const stageElapsedMs = now() - stageStart;
				const scorecardFile = repPaths.stageFile(request.stage);
				await Bun.write(
					scorecardFile,
					`${JSON.stringify(scorecard, null, 2)}\n`,
				);
				const record = completeRepRecord(
					request,
					frozen.plan.consumed,
					plan.repId,
					plan.ordinal,
					plan.worktreePath,
					session.resultSha,
					relative(repPaths.directory, scorecardFile),
					scorecard,
					session.transcript.providerCalls,
					productOwner.snapshot().providerCalls,
					stageElapsedMs,
					now() - repStart,
				);
				return await settleCompletedConfirmationRep({
					targetRoot: frozen.manifest.sourceRoot,
					retentionName: `${request.groupId}/${plan.repId}`,
					resultSha: session.resultSha,
					recordFile: repPaths.recordFile,
					recordContent: `${JSON.stringify(record, null, 2)}\n`,
					worktreePath: plan.worktreePath,
					recordRetentionRef,
					removeWorktree: dependencies.removeWorktree,
				});
			} catch (error) {
				const failure =
					error instanceof Error ? error : new Error(String(error));
				const diagnosticError =
					setupOperation === undefined
						? failure.message
						: `${setupOperation} failed: ${failure.message}`;
				if (
					failure instanceof JudgeOutputValidationError &&
					worktreeCreated &&
					session !== undefined &&
					productOwner !== undefined
				) {
					const scorecardFile = repPaths.stageFile(request.stage);
					await Bun.write(
						scorecardFile,
						`${JSON.stringify(
							{
								stage: request.stage,
								status: "REJECTED",
								prompt: failure.prompt,
								attempts: failure.attempts,
								costUsd: failure.costUsd,
								error: failure.message,
							},
							null,
							2,
						)}\n`,
					);
					const record = rejectedJudgeRepRecord(
						request,
						frozen.plan.consumed,
						plan.repId,
						plan.ordinal,
						plan.worktreePath,
						session.resultSha,
						relative(repPaths.directory, scorecardFile),
						failure,
						session.transcript.providerCalls,
						productOwner.snapshot().providerCalls,
						now() - stageStart,
						now() - repStart,
					);
					return settleCompletedConfirmationRep({
						targetRoot: frozen.manifest.sourceRoot,
						retentionName: `${request.groupId}/${plan.repId}`,
						resultSha: session.resultSha,
						recordFile: repPaths.recordFile,
						recordContent: `${JSON.stringify(record, null, 2)}\n`,
						worktreePath: plan.worktreePath,
						recordRetentionRef,
						removeWorktree: dependencies.removeWorktree,
					});
				}
				const record = failedRepRecord(
					request,
					frozen.plan.consumed,
					plan.repId,
					plan.ordinal,
					plan.worktreePath,
					diagnosticError,
					now() - repStart,
				);
				return settleDiagnosticConfirmationRep({
					recordFile: repPaths.recordFile,
					recordContent: `${JSON.stringify(record, null, 2)}\n`,
					worktreeCreated,
					preservedMessage: `Replay rep ${plan.repId} failed; evidence preserved at ${plan.worktreePath}`,
					log: dependencies.log,
				});
			}
		},
	);
	const makespanMs = now() - makespanStart;
	const repResults: readonly ConfirmationRepResult[] = results.map(
		({ outcome }) => {
			if (outcome.status === "rejected") {
				throw outcome.reason;
			}

			return outcome.value;
		},
	);

	return finalizeConfirmationGroup({
		mode: "stage",
		groupId: request.groupId,
		reps: request.reps,
		declaredStages: [request.stage],
		inputs: {
			lineage: {
				kind: "CHECKPOINT",
				lineage: frozen.plan.consumed.lineage,
				targetSha: frozen.plan.consumed.targetSha,
			},
			files: frozen.files,
			model: request.model,
			effort: request.effort,
			judgeModel: request.judgeModel,
			judgeEffort: request.judgeEffort,
			sessionBudgetUsd: request.sessionBudgetUsd,
			pipelinePath: frozen.manifest.pipelinePath,
		},
		projectedCost: request.projectedCost,
		approvalMethod: request.approvalMethod,
		repResults,
		worktreesDirectory,
		groupDirectory: paths.directory,
		groupFile: paths.groupFile,
		reportFile: paths.reportFile,
		makespanMs,
	});
}
