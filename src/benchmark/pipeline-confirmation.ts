import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { createTaskCommit } from "./backlog";
import type {
	CheckpointRecord,
	HashedFile,
	materializeCheckpoint,
	recordCheckpoint,
} from "./checkpoint";
import {
	hashArtifacts,
	hashWorkflowState,
	initialCheckpointInputs,
	installStageCorpusSnapshot,
	snapshotStageCorpus,
} from "./checkpoint";
import type {
	captureBaselineContext,
	captureFileHashes,
	runChecks,
} from "./checks";
import type { Effort } from "./config";
import type {
	ClaudeCallMetrics,
	ContextFile,
	StageRubric,
	StageScorecard,
} from "./contracts";
import type { JudgeResult } from "./judge";
import type { PipelineDefinition } from "./pipeline";
import type { ConfirmationCostProjection } from "./confirmation";
import { runConfirmation } from "./confirmation";
import {
	buildReliabilityReport,
	buildResourceReport,
} from "./confirmation-report";
import type {
	ConfirmationGroupRecord,
	ConfirmationRepRecord,
} from "./confirmation-record";
import {
	confirmationGroupRecordSchema,
	confirmationRepRecordSchema,
} from "./confirmation-record";
import { detachedStageDependencies } from "./replay";
import type { BuildEvidence, StageSessionDependencies } from "./run";
import { executeStageSession } from "./run";
import { confirmationGroupPaths } from "./run-layout";
import type {
	addWorktree,
	captureBuildCandidate,
	recordRetentionRef,
	removeWorktree,
	SourceBaseline,
} from "./target";
import { createProductOwner } from "./workflow";

interface LoadedStageRubric {
	readonly rubricPath: string;
	readonly content: string;
	readonly rubric: StageRubric;
}

interface FrozenFile {
	readonly kind:
		| "checkpoint"
		| "corpus"
		| "rubric"
		| "pipeline"
		| "instructions"
		| "task"
		| "product-brief";
	readonly path: string;
	readonly sha256: string;
}

export interface PipelineFinalJudgeRequest {
	readonly repId: string;
	readonly ordinal: number;
	readonly resultSha: string;
	readonly rubric: string;
	readonly baselineContext: readonly ContextFile[];
	readonly evidence: BuildEvidence;
}

export interface PipelineConfirmationDependencies {
	readonly stageSession: StageSessionDependencies;
	readonly runStageJudge: (
		model: string,
		effort: Effort | undefined,
		budget: number,
		input: Parameters<
			StageSessionDependencies["runWorkflowStage"]
		>[0] extends never
			? never
			: StageScorecard["input"],
		source: LoadedStageRubric,
	) => Promise<StageScorecard>;
	readonly runFinalJudge: (
		request: PipelineFinalJudgeRequest,
	) => Promise<JudgeResult>;
	readonly createTaskCommit: typeof createTaskCommit;
	readonly runChecks: typeof runChecks;
	readonly captureBaselineContext: typeof captureBaselineContext;
	readonly captureFileHashes: typeof captureFileHashes;
	readonly addWorktree: typeof addWorktree;
	readonly removeWorktree: typeof removeWorktree;
	readonly materializeCheckpoint: typeof materializeCheckpoint;
	readonly recordCheckpoint: typeof recordCheckpoint;
	readonly recordRetentionRef: typeof recordRetentionRef;
	readonly captureBuildCandidate: typeof captureBuildCandidate;
	readonly log: (message: string) => void;
}

export interface PipelineConfirmationRequest {
	readonly runsDirectory: string;
	readonly groupId: string;
	readonly reps: number;
	readonly projectedCost: ConfirmationCostProjection;
	readonly approvalMethod: "interactive" | "yes";
	readonly source: SourceBaseline;
	readonly controlSha: string;
	readonly pipelinePath: string;
	readonly pipeline: PipelineDefinition;
	readonly task: string;
	readonly productBrief: string;
	readonly instructions: string;
	readonly finalRubric: string;
	readonly stageRubrics: Readonly<Record<string, LoadedStageRubric>>;
	readonly corpusRoots: readonly string[];
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly judgeModel: string;
	readonly judgeEffort?: Effort | undefined;
	readonly sessionBudgetUsd: number;
	readonly now?: (() => number) | undefined;
}

export interface PipelineConfirmationOutcome {
	readonly groupRecordFile: string;
	readonly reportFile: string;
	readonly repRecordFiles: readonly string[];
}

interface FrozenPipelineInputs {
	readonly taskId: string;
	readonly taskSha: string;
	readonly initialCheckpoint: CheckpointRecord;
	readonly checkpointDirectory: string;
	readonly baselineContext: readonly ContextFile[];
	readonly baselineHashes: ReadonlyMap<string, string>;
	readonly corpusDirectories: Readonly<Record<string, string>>;
	readonly corpusFiles: Readonly<Record<string, readonly HashedFile[]>>;
	readonly files: readonly FrozenFile[];
}

function sha256(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

async function writeFrozenFile(
	groupDirectory: string,
	path: string,
	content: string,
	kind: FrozenFile["kind"],
): Promise<FrozenFile> {
	await Bun.write(path, content);

	return {
		kind,
		path: relative(groupDirectory, path),
		sha256: sha256(content),
	};
}

async function frozenDirectoryFiles(
	groupDirectory: string,
	directory: string,
	kind: FrozenFile["kind"],
): Promise<readonly FrozenFile[]> {
	const entries = await readdir(directory, { recursive: true });
	const files: FrozenFile[] = [];
	for (const entry of entries.toSorted()) {
		const path = join(directory, entry);
		const file = Bun.file(path);
		if (!(await file.exists()) || file.type === "directory") {
			continue;
		}

		const bytes = await file.bytes();
		files.push({
			kind,
			path: relative(groupDirectory, path),
			sha256: createHash("sha256").update(bytes).digest("hex"),
		});
	}

	return files;
}

async function freezePipelineInputs(
	dependencies: PipelineConfirmationDependencies,
	request: PipelineConfirmationRequest,
	groupDirectory: string,
	inputsDirectory: string,
	worktreesDirectory: string,
): Promise<FrozenPipelineInputs> {
	const corpusRoot = join(inputsDirectory, "corpus");
	const corpusDirectories: Record<string, string> = {};
	const corpusFiles: Record<string, readonly HashedFile[]> = {};
	for (const stage of request.pipeline.stages) {
		const directory = join(corpusRoot, stage.name);
		corpusDirectories[stage.name] = directory;
		corpusFiles[stage.name] = await snapshotStageCorpus(
			stage.skill,
			request.instructions,
			request.corpusRoots,
			directory,
		);
	}

	const setupWorktree = join(worktreesDirectory, "setup");
	await dependencies.addWorktree(
		request.source.root,
		request.source.sha,
		setupWorktree,
	);
	let taskId: string;
	let taskSha: string;
	let baselineContext: readonly ContextFile[];
	let baselineHashes: ReadonlyMap<string, string>;
	const checkpointDirectory = join(inputsDirectory, "checkpoint");
	let initialCheckpoint: CheckpointRecord;
	try {
		await dependencies.runChecks(setupWorktree, "Baseline checks");
		baselineHashes = await dependencies.captureFileHashes(setupWorktree);
		baselineContext = await dependencies.captureBaselineContext(setupWorktree);
		({ taskId, taskSha } = await dependencies.createTaskCommit(
			setupWorktree,
			request.task,
			request.instructions,
			request.pipeline.statuses,
		));
		initialCheckpoint = await dependencies.recordCheckpoint(
			setupWorktree,
			checkpointDirectory,
			initialCheckpointInputs(
				{
					taskSha,
					task: request.task,
					productBrief: request.productBrief,
					workflowFiles: await hashWorkflowState(setupWorktree),
				},
				request.model,
				request.effort,
			),
		);
		await dependencies.recordRetentionRef(
			request.source.root,
			`${request.groupId}/setup`,
			taskSha,
		);
	} finally {
		await dependencies.removeWorktree(request.source.root, setupWorktree);
	}

	const files: FrozenFile[] = [
		...(await frozenDirectoryFiles(
			groupDirectory,
			checkpointDirectory,
			"checkpoint",
		)),
		...(await frozenDirectoryFiles(groupDirectory, corpusRoot, "corpus")),
		await writeFrozenFile(
			groupDirectory,
			join(inputsDirectory, "pipeline.json"),
			`${JSON.stringify(request.pipeline, null, 2)}\n`,
			"pipeline",
		),
		await writeFrozenFile(
			groupDirectory,
			join(inputsDirectory, "instructions.md"),
			request.instructions,
			"instructions",
		),
		await writeFrozenFile(
			groupDirectory,
			join(inputsDirectory, "task.md"),
			request.task,
			"task",
		),
		await writeFrozenFile(
			groupDirectory,
			join(inputsDirectory, "product-brief.md"),
			request.productBrief,
			"product-brief",
		),
		await writeFrozenFile(
			groupDirectory,
			join(inputsDirectory, "final-rubric.md"),
			request.finalRubric,
			"rubric",
		),
	];
	for (const stage of request.pipeline.stages) {
		const source = request.stageRubrics[stage.name];
		if (source === undefined) {
			throw new Error(`No frozen rubric for ${stage.name}`);
		}
		files.push(
			await writeFrozenFile(
				groupDirectory,
				join(inputsDirectory, `${stage.name}-rubric.json`),
				source.content,
				"rubric",
			),
		);
	}

	return {
		taskId,
		taskSha,
		initialCheckpoint,
		checkpointDirectory,
		baselineContext,
		baselineHashes,
		corpusDirectories,
		corpusFiles,
		files,
	};
}

interface MetricCall {
	readonly role: "worker" | "product-owner" | "stage-judge" | "final-judge";
	readonly metrics: ClaudeCallMetrics;
}

function repMetrics(
	worker: readonly ClaudeCallMetrics[],
	productOwner: readonly ClaudeCallMetrics[] | undefined,
	stageJudge: readonly ClaudeCallMetrics[],
	finalJudge: readonly ClaudeCallMetrics[],
): Pick<ConfirmationRepRecord, "metrics" | "workerTrajectorySteps"> {
	const calls: MetricCall[] = [];
	const missing: string[] = [];
	if (worker.length === 0) {
		missing.push("worker call metrics");
	}
	if (productOwner === undefined) {
		missing.push("product-owner call metrics");
	}
	if (stageJudge.length === 0) {
		missing.push("stage-judge call metrics");
	}
	if (finalJudge.length === 0) {
		missing.push("final-judge call metrics");
	}
	for (const metrics of worker) {
		calls.push({ role: "worker", metrics });
	}
	for (const metrics of productOwner ?? []) {
		calls.push({ role: "product-owner", metrics });
	}
	for (const metrics of stageJudge) {
		calls.push({ role: "stage-judge", metrics });
	}
	for (const metrics of finalJudge) {
		calls.push({ role: "final-judge", metrics });
	}

	return {
		metrics:
			missing.length === 0
				? { status: "COMPLETE", calls }
				: { status: "MISSING", calls, missing },
		workerTrajectorySteps: worker.reduce(
			(total, metrics) => total + metrics.turns,
			0,
		),
	};
}

function attemptMetrics(
	attempts: readonly { readonly metrics?: ClaudeCallMetrics | undefined }[],
): ClaudeCallMetrics[] {
	return attempts.flatMap(({ metrics }) =>
		metrics === undefined ? [] : [metrics],
	);
}

export async function runPipelineConfirmation(
	dependencies: PipelineConfirmationDependencies,
	request: PipelineConfirmationRequest,
): Promise<PipelineConfirmationOutcome> {
	const now = request.now ?? (() => performance.now());
	const paths = confirmationGroupPaths(request.runsDirectory, request.groupId);
	await mkdir(paths.inputsDirectory, { recursive: true });
	const worktreesDirectory = await mkdtemp(
		join(tmpdir(), `rehearsal-${request.groupId}-`),
	);
	const frozen = await freezePipelineInputs(
		dependencies,
		request,
		paths.directory,
		paths.inputsDirectory,
		worktreesDirectory,
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
			await dependencies.addWorktree(
				request.source.root,
				frozen.taskSha,
				plan.worktreePath,
			);
			await dependencies.materializeCheckpoint(
				frozen.checkpointDirectory,
				plan.worktreePath,
			);
			const productOwner = createProductOwner({
				directory: join(repPaths.directory, "product-owner"),
				model: request.model,
				effort: request.effort,
				sessionBudgetUsd: request.sessionBudgetUsd,
				task: request.task,
				productBrief: request.productBrief,
			});
			const stageOutcomes: ConfirmationRepRecord["stages"] = [];
			const workerMetrics: ClaudeCallMetrics[] = [];
			const stageJudgeMetrics: ClaudeCallMetrics[] = [];
			const priorArtifacts: ContextFile[] = [];
			let upstream = frozen.initialCheckpoint.lineage;
			let baselineSha = frozen.taskSha;
			let buildEvidence: BuildEvidence | undefined;
			let resultSha = frozen.taskSha;
			for (const [index, definition] of request.pipeline.stages.entries()) {
				await installStageCorpusSnapshot(
					frozen.corpusDirectories[definition.name] ?? "",
					plan.worktreePath,
				);
				const stageStart = now();
				const session = await executeStageSession(
					detachedStageDependencies(dependencies.stageSession),
					{
						targetDir: plan.worktreePath,
						model: request.model,
						effort: request.effort,
						sessionBudgetUsd: request.sessionBudgetUsd,
						productOwner,
						task: request.task,
						productBrief: request.productBrief,
						instructions: request.instructions,
						baselineContext: frozen.baselineContext,
						baselineHashes: frozen.baselineHashes,
						taskId: frozen.taskId,
						taskSha: frozen.taskSha,
						baselineSha,
						commitSubjectPattern: request.pipeline.commitSubjectPattern,
						skillRoots: [join(plan.worktreePath, ".claude", "skills")],
						log: dependencies.log,
					},
					definition,
					priorArtifacts,
				);
				workerMetrics.push(...(session.transcript.callMetrics ?? []));
				const rubric = request.stageRubrics[definition.name];
				if (rubric === undefined) {
					throw new Error(`No frozen rubric for ${definition.name}`);
				}
				const scorecard = await dependencies.runStageJudge(
					request.judgeModel,
					request.judgeEffort,
					request.sessionBudgetUsd,
					session.input,
					rubric,
				);
				stageJudgeMetrics.push(...attemptMetrics(scorecard.attempts));
				const stageFile = repPaths.stageFile(definition.name);
				await Bun.write(stageFile, `${JSON.stringify(scorecard, null, 2)}\n`);
				stageOutcomes.push({
					stage: definition.name,
					status: "JUDGED",
					grade: scorecard.grade.grade,
					verdict: scorecard.grade.verdict,
					elapsedMs: now() - stageStart,
					evidence: {
						resultSha: session.resultSha,
						recordFile: relative(repPaths.directory, stageFile),
					},
				});
				({ resultSha } = session);
				if (scorecard.grade.verdict === "STOP") {
					for (const later of request.pipeline.stages.slice(index + 1)) {
						stageOutcomes.push({
							stage: later.name,
							status: "NOT_REACHED",
							reason: `${definition.name} Judge stopped the rep`,
						});
					}
					const evidence = repMetrics(
						workerMetrics,
						productOwner.snapshot().callMetrics,
						stageJudgeMetrics,
						[],
					);
					const record = confirmationRepRecordSchema.parse({
						schemaVersion: 1,
						groupId: request.groupId,
						repId: plan.repId,
						ordinal: plan.ordinal,
						mode: "pipeline",
						worktreePath: plan.worktreePath,
						lineage: { kind: "SOURCE", sha: request.source.sha },
						outcome: "UNSUCCESSFUL",
						stages: stageOutcomes,
						finalOutcome: {
							status: "NOT_REACHED",
							reason: `${definition.name} Judge stopped the rep`,
						},
						metrics: evidence.metrics,
						workerTrajectorySteps: evidence.workerTrajectorySteps,
						elapsedMs: now() - repStart,
					});
					await Bun.write(
						repPaths.recordFile,
						`${JSON.stringify(record, null, 2)}\n`,
					);
					await dependencies.removeWorktree(
						request.source.root,
						plan.worktreePath,
					);

					return repPaths.recordFile;
				}
				({ resultSha: baselineSha } = session);
				if (session.artifact !== undefined) {
					priorArtifacts.push(session.artifact);
				}
				if (session.buildEvidence !== undefined) {
					({ buildEvidence } = session);
				}
				const checkpoint = await dependencies.recordCheckpoint(
					plan.worktreePath,
					repPaths.checkpointDirectory(definition.name),
					{
						stage: definition.name,
						targetSha: session.resultSha,
						upstream,
						model: request.model,
						effort: request.effort,
						corpusFiles: frozen.corpusFiles[definition.name] ?? [],
						artifacts: hashArtifacts(
							session.artifact ? [session.artifact] : [],
						),
					},
				);
				upstream = checkpoint.lineage;
			}
			if (buildEvidence === undefined) {
				throw new Error("Build stage did not run");
			}
			const fullCandidate = await dependencies.captureBuildCandidate(
				plan.worktreePath,
				frozen.taskSha,
			);
			const finalEvidence = {
				...buildEvidence,
				diff: fullCandidate.diff,
				changedPaths: fullCandidate.changedPaths,
			};
			const finalJudge = await dependencies.runFinalJudge({
				repId: plan.repId,
				ordinal: plan.ordinal,
				resultSha,
				rubric: request.finalRubric,
				baselineContext: frozen.baselineContext,
				evidence: finalEvidence,
			});
			const finalJudgeMetrics = attemptMetrics(finalJudge.attempts);
			await Bun.write(
				paths.rep(plan.repId).finalFile,
				`${JSON.stringify(finalJudge, null, 2)}\n`,
			);
			const evidence = repMetrics(
				workerMetrics,
				productOwner.snapshot().callMetrics,
				stageJudgeMetrics,
				finalJudgeMetrics,
			);
			const successful =
				evidence.metrics.status === "COMPLETE" &&
				stageOutcomes.every(
					(stage) =>
						stage.status === "JUDGED" &&
						stage.verdict === "CONTINUE" &&
						(stage.grade === "A" || stage.grade === "B"),
				) &&
				finalJudge.grade.verdict === "PASS";
			const record = confirmationRepRecordSchema.parse({
				schemaVersion: 1,
				groupId: request.groupId,
				repId: plan.repId,
				ordinal: plan.ordinal,
				mode: "pipeline",
				worktreePath: plan.worktreePath,
				lineage: { kind: "SOURCE", sha: request.source.sha },
				outcome: successful ? "SUCCESSFUL" : "UNSUCCESSFUL",
				stages: stageOutcomes,
				finalOutcome: {
					status: "JUDGED",
					verdict: finalJudge.grade.verdict,
					evidence: {
						resultSha,
						recordFile: relative(repPaths.directory, repPaths.finalFile),
					},
				},
				metrics: evidence.metrics,
				workerTrajectorySteps: evidence.workerTrajectorySteps,
				elapsedMs: now() - repStart,
			});
			await dependencies.recordRetentionRef(
				request.source.root,
				`${request.groupId}/${plan.repId}`,
				resultSha,
			);
			await Bun.write(
				repPaths.recordFile,
				`${JSON.stringify(record, null, 2)}\n`,
			);
			await dependencies.removeWorktree(request.source.root, plan.worktreePath);

			return repPaths.recordFile;
		},
	);
	const makespanMs = now() - makespanStart;
	const repRecordFiles = await Promise.all(
		results.map(async ({ plan, outcome }) => {
			if (outcome.status === "fulfilled") {
				return outcome.value;
			}

			const reason =
				outcome.reason instanceof Error
					? outcome.reason.message
					: String(outcome.reason);
			dependencies.log(
				`Pipeline rep ${plan.repId} failed; evidence preserved at ${plan.worktreePath}`,
			);
			const [failedStage, ...laterStages] = request.pipeline.stages;
			if (failedStage === undefined) {
				throw new Error("Pipeline must declare at least one stage");
			}
			const record = confirmationRepRecordSchema.parse({
				schemaVersion: 1,
				groupId: request.groupId,
				repId: plan.repId,
				ordinal: plan.ordinal,
				mode: "pipeline",
				worktreePath: plan.worktreePath,
				lineage: { kind: "SOURCE", sha: request.source.sha },
				outcome: "UNSUCCESSFUL",
				stages: [
					{
						stage: failedStage.name,
						status: "EXECUTION_FAILED",
						error: reason,
						worktreePath: plan.worktreePath,
						elapsedMs: makespanMs,
					},
					...laterStages.map((stage) => ({
						stage: stage.name,
						status: "NOT_REACHED" as const,
						reason: `${failedStage.name} execution failed`,
					})),
				],
				finalOutcome: {
					status: "NOT_REACHED",
					reason: `${failedStage.name} execution failed`,
				},
				metrics: {
					status: "MISSING",
					calls: [],
					missing: ["stage evidence"],
				},
				workerTrajectorySteps: 0,
				elapsedMs: makespanMs,
			});
			const { recordFile } = paths.rep(plan.repId);
			await Bun.write(recordFile, `${JSON.stringify(record, null, 2)}\n`);

			return recordFile;
		}),
	);
	const records = await Promise.all(
		repRecordFiles.map(async (path) =>
			confirmationRepRecordSchema.parse(
				JSON.parse(await Bun.file(path).text()),
			),
		),
	);
	const reliability = buildReliabilityReport(
		request.pipeline.stages.map(({ name }) => name),
		records.map((record) => {
			if (record.finalOutcome.status === "NOT_APPLICABLE") {
				throw new Error(
					"Pipeline rep cannot have a not-applicable final outcome",
				);
			}

			return { stages: record.stages, finalOutcome: record.finalOutcome };
		}),
	);
	const resources = buildResourceReport(
		request.pipeline.stages.map(({ name }) => name),
		records,
		makespanMs,
	);
	await Bun.write(
		paths.reportFile,
		`${JSON.stringify({ reliability, resources }, null, 2)}\n`,
	);
	const group: ConfirmationGroupRecord = confirmationGroupRecordSchema.parse({
		schemaVersion: 1,
		groupId: request.groupId,
		mode: "pipeline",
		reps: request.reps,
		declaredStages: request.pipeline.stages.map(({ name }) => name),
		inputs: {
			lineage: { kind: "SOURCE", sha: request.source.sha },
			files: frozen.files,
			model: request.model,
			effort: request.effort,
			judgeModel: request.judgeModel,
			judgeEffort: request.judgeEffort,
			sessionBudgetUsd: request.sessionBudgetUsd,
			pipelinePath: request.pipelinePath,
		},
		projectedCost: request.projectedCost,
		approval: { method: request.approvalMethod, approved: true },
		repRecords: repRecordFiles.map((path, index) => ({
			repId: `${request.groupId}-rep-${index + 1}`,
			ordinal: index + 1,
			path: relative(paths.directory, path),
		})),
		reportFile: relative(paths.directory, paths.reportFile),
		makespanMs,
	});
	await Bun.write(paths.groupFile, `${JSON.stringify(group, null, 2)}\n`);
	if (results.every(({ outcome }) => outcome.status === "fulfilled")) {
		await rm(worktreesDirectory, { force: true, recursive: true });
	}

	return {
		groupRecordFile: paths.groupFile,
		reportFile: paths.reportFile,
		repRecordFiles,
	};
}
