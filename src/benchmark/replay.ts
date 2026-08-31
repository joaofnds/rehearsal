import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { installInstructions } from "./backlog";
import type {
	CheckpointRecord,
	HashedFile,
	materializeCheckpoint,
} from "./checkpoint";
import {
	deriveStaleness,
	hashArtifacts,
	hashedFileSchema,
	INITIAL_CHECKPOINT_STAGE,
	lineageKey,
	readCheckpointRecord,
	skillSearchRoots,
} from "./checkpoint";
import type { captureBaselineContext, captureFileHashes } from "./checks";
import type { Effort } from "./config";
import { effortSchema } from "./config";
import type { ContextFile, StageScorecard } from "./contracts";
import { stageLetterGradeSchema } from "./contracts";
import type { RunManifest } from "./manifest";
import { loadRunManifest } from "./manifest";
import type { StageDefinition } from "./pipeline";
import type { StageSessionDependencies } from "./run";
import { executeStageSession } from "./run";
import type { BenchmarkRunPaths } from "./run-layout";
import type { loadStageRubric, runStageJudge } from "./stage-grading";
import type { addWorktree, removeWorktree } from "./target";
import { createProductOwner } from "./workflow";

export class ReplayError extends Error {
	public override name = "ReplayError";
}

/**
 * Every checkpoint the run recorded, keyed by stage. The record's own stage
 * name is authoritative; the directory name only locates it.
 */
export async function loadRunCheckpoints(
	runDirectory: string,
): Promise<Map<string, CheckpointRecord>> {
	const checkpoints = new Map<string, CheckpointRecord>();

	for (const entry of await readdir(runDirectory, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}

		const record = await readCheckpointRecord(join(runDirectory, entry.name));
		checkpoints.set(record.stage, record);
	}

	return checkpoints;
}

export interface ReplayPlan {
	readonly definition: StageDefinition;
	readonly consumed: CheckpointRecord;
	readonly priorArtifacts: readonly HashedFile[];
	/** The verified chain from the initial checkpoint to the consumed one. */
	readonly chain: readonly CheckpointRecord[];
}

/**
 * Replaying stage N consumes the checkpoint of stage N-1: the state after
 * that stage was accepted. The whole chain back to the initial checkpoint is
 * verified first, because the prior artifacts fed to the judge are collected
 * from every earlier checkpoint and a broken link would present artifacts
 * that never led to the consumed state.
 */
export function resolveReplay(
	manifest: RunManifest,
	checkpoints: ReadonlyMap<string, CheckpointRecord>,
	stageName: string,
): ReplayPlan {
	const { stages } = manifest.pipeline;
	const index = stages.findIndex(({ name }) => name === stageName);
	const definition = stages[index];
	if (!definition) {
		throw new ReplayError(
			`The run's pipeline has no ${stageName} stage; it declares ${stages
				.map(({ name }) => name)
				.join(", ")}`,
		);
	}

	const initial = checkpoints.get(INITIAL_CHECKPOINT_STAGE);
	if (!initial) {
		throw new ReplayError(
			"The run has no initial checkpoint; runs recorded before initial checkpoints cannot be replayed",
		);
	}

	let consumed = initial;
	const priorArtifacts: HashedFile[] = [];
	const chain: CheckpointRecord[] = [initial];
	for (const earlier of stages.slice(0, index)) {
		const checkpoint = checkpoints.get(earlier.name);
		if (!checkpoint) {
			throw new ReplayError(
				`The run has no checkpoint for the ${earlier.name} stage; it stopped before accepting it`,
			);
		}
		if (checkpoint.upstream !== consumed.lineage) {
			throw new ReplayError(
				`The run's checkpoint chain is broken at the ${earlier.name} stage: it consumed ${checkpoint.upstream}, but ${consumed.stage} produced ${consumed.lineage}`,
			);
		}

		priorArtifacts.push(...checkpoint.artifacts);
		consumed = checkpoint;
		chain.push(checkpoint);
	}

	return { definition, consumed, priorArtifacts, chain };
}

export interface ReplayDependencies {
	readonly stageSession: StageSessionDependencies;
	readonly runStageJudge: typeof runStageJudge;
	readonly loadStageRubric: typeof loadStageRubric;
	readonly addWorktree: typeof addWorktree;
	readonly removeWorktree: typeof removeWorktree;
	readonly materializeCheckpoint: typeof materializeCheckpoint;
	readonly captureBaselineContext: typeof captureBaselineContext;
	readonly captureFileHashes: typeof captureFileHashes;
	readonly installInstructions: typeof installInstructions;
	readonly installDependencies: (worktreeDir: string) => Promise<void>;
	readonly log: (message: string) => void;
}

export interface ReplayRequest {
	readonly paths: BenchmarkRunPaths;
	readonly stage: string;
	readonly instructions: string;
	readonly controlSha: string;
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly judgeModel: string;
	readonly judgeEffort?: Effort | undefined;
	readonly sessionBudgetUsd: number;
}

export interface ReplayRecord {
	readonly replay: true;
	readonly timestamp: string;
	readonly runName: string;
	readonly stage: string;
	readonly consumed: {
		readonly stage: string;
		readonly lineage: string;
		readonly targetSha: string;
	};
	readonly baseSha: string;
	readonly lineage: string;
	readonly corpusFiles: readonly HashedFile[];
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly judgeModel: string;
	readonly judgeEffort?: Effort | undefined;
	readonly sessionBudgetUsd: number;
	readonly controlSha: string;
	readonly stageCostUsd: number;
	readonly productOwnerCostUsd: number;
	readonly judgeCostUsd: number;
	readonly resultSha?: string | undefined;
	/** Whether the consumed chain still reflects the current corpus. */
	readonly stale: boolean;
	/** Per stale checkpoint, why: named corpus files, model, or effort. */
	readonly staleness: readonly {
		readonly stage: string;
		readonly causes: readonly string[];
	}[];
	readonly scorecard: StageScorecard;
}

/**
 * The replay-specific envelope is strict; the scorecard inside it stays open
 * because its shape belongs to stage grading and is validated there.
 */
export const replayRecordSchema = z
	.object({
		replay: z.literal(true),
		timestamp: z.string().min(1),
		runName: z.string().min(1),
		stage: z.string().min(1),
		consumed: z
			.object({
				stage: z.string().min(1),
				lineage: z.string().min(1),
				targetSha: z.string().min(1),
			})
			.strict(),
		baseSha: z.string().min(1),
		lineage: z.string().min(1),
		corpusFiles: z.array(hashedFileSchema),
		model: z.string().min(1),
		effort: effortSchema.optional(),
		judgeModel: z.string().min(1),
		judgeEffort: effortSchema.optional(),
		sessionBudgetUsd: z.number().positive(),
		controlSha: z.string().min(1),
		stageCostUsd: z.number().nonnegative(),
		productOwnerCostUsd: z.number().nonnegative(),
		judgeCostUsd: z.number().nonnegative(),
		resultSha: z.string().min(1).optional(),
		stale: z.boolean().optional(),
		staleness: z
			.array(
				z
					.object({
						stage: z.string().min(1),
						causes: z.array(z.string().min(1)),
					})
					.strict(),
			)
			.optional(),
		scorecard: z
			.object({
				stage: z.string().min(1),
				costUsd: z.number(),
				grade: z
					.object({
						grade: stageLetterGradeSchema,
						verdict: z.enum(["CONTINUE", "STOP"]),
					})
					.loose(),
			})
			.loose(),
	})
	.strict();

export async function readReplayRecord(
	path: string,
): Promise<z.infer<typeof replayRecordSchema>> {
	return replayRecordSchema.parse(JSON.parse(await Bun.file(path).text()));
}

export interface ReplayOutcome {
	readonly record: ReplayRecord;
	readonly recordPath: string;
}

/**
 * A replayed stage validates against the worktree's detached HEAD: main
 * cannot be checked out twice, and the primary checkout must stay untouched.
 */
export function detachedStageDependencies(
	base: StageSessionDependencies,
): StageSessionDependencies {
	return {
		...base,
		assertPlanningStageCompleted: (targetDir, taskSha, stage, taskState) =>
			base.assertPlanningStageCompleted(
				targetDir,
				taskSha,
				stage,
				taskState,
				null,
			),
		assertBuildCommitted: (targetDir, taskSha, _branch, commitSubjectPattern) =>
			base.assertBuildCommitted(targetDir, taskSha, null, commitSubjectPattern),
	};
}

/**
 * Prior artifacts reach the judge from the materialized snapshot, verified
 * against the hashes their own checkpoints recorded when they were accepted.
 */
export async function readPriorArtifacts(
	worktreeDir: string,
	recorded: readonly HashedFile[],
): Promise<ContextFile[]> {
	const artifacts: ContextFile[] = [];

	for (const { path, sha256 } of recorded) {
		const file = Bun.file(join(worktreeDir, path));
		if (!(await file.exists())) {
			throw new ReplayError(
				`Prior artifact ${path} is missing from the materialized checkpoint`,
			);
		}

		const content = await file.text();
		if (hashArtifacts([{ path, content }])[0]?.sha256 !== sha256) {
			throw new ReplayError(
				`Prior artifact ${path} does not match its checkpoint record`,
			);
		}

		artifacts.push({ path, content });
	}

	return artifacts;
}

/**
 * The current corpus for each stage in the consumed chain, so staleness
 * compares each checkpoint against the corpus that would feed its stage
 * today. The initial checkpoint consumes no corpus, so it has none to
 * capture. A stage whose skill no longer resolves fails the replay rather
 * than reading as fresh: an uncapturable corpus is not an unchanged one.
 */
async function currentChainCorpus(
	plan: ReplayPlan,
	manifest: RunManifest,
	instructions: string,
	roots: readonly string[],
	captureStageCorpus: StageSessionDependencies["captureStageCorpus"],
): Promise<Map<string, readonly HashedFile[]>> {
	const corpus = new Map<string, readonly HashedFile[]>();

	for (const record of plan.chain) {
		if (record.stage === INITIAL_CHECKPOINT_STAGE) {
			continue;
		}

		const definition = manifest.pipeline.stages.find(
			({ name }) => name === record.stage,
		);
		if (!definition) {
			throw new ReplayError(
				`The run's pipeline no longer declares the ${record.stage} stage its checkpoint records`,
			);
		}

		corpus.set(
			record.stage,
			await captureStageCorpus(definition.skill, instructions, roots),
		);
	}

	return corpus;
}

export async function runReplay(
	dependencies: ReplayDependencies,
	request: ReplayRequest,
): Promise<ReplayOutcome> {
	const manifest = await loadRunManifest(request.paths.manifestFile);
	const checkpoints = await loadRunCheckpoints(
		request.paths.checkpointsDirectory,
	);
	const plan = resolveReplay(manifest, checkpoints, request.stage);

	const parent = await mkdtemp(join(tmpdir(), "rehearsal-replay-"));
	const worktreeDir = join(parent, "worktree");
	const productOwnerDirectory = join(parent, "product-owner");
	await mkdir(productOwnerDirectory, { recursive: true });
	await dependencies.addWorktree(
		manifest.sourceRoot,
		plan.consumed.targetSha,
		worktreeDir,
	);

	let outcome: ReplayOutcome;
	try {
		await dependencies.materializeCheckpoint(
			request.paths.checkpointDirectory(plan.consumed.stage),
			worktreeDir,
		);
		const baseSha = await dependencies.installInstructions(
			worktreeDir,
			request.instructions,
		);
		if (plan.definition.kind === "delivery") {
			await dependencies.installDependencies(worktreeDir);
		}
		const priorArtifacts = await readPriorArtifacts(
			worktreeDir,
			plan.priorArtifacts,
		);
		const staleness = deriveStaleness(
			plan.chain,
			await currentChainCorpus(
				plan,
				manifest,
				request.instructions,
				skillSearchRoots(worktreeDir),
				dependencies.stageSession.captureStageCorpus,
			),
			{ model: request.model, effort: request.effort },
		).filter(({ stale }) => stale);
		if (staleness.length === 0) {
			dependencies.log("Checkpoint chain is fresh");
		}
		for (const { stage, causes } of staleness) {
			dependencies.log(`Stale checkpoint ${stage}: ${causes.join("; ")}`);
		}
		const baselineHashes = await dependencies.captureFileHashes(worktreeDir);
		const baselineContext =
			await dependencies.captureBaselineContext(worktreeDir);
		const productOwner = createProductOwner({
			directory: productOwnerDirectory,
			model: request.model,
			effort: request.effort,
			sessionBudgetUsd: request.sessionBudgetUsd,
			task: manifest.task,
			productBrief: manifest.productBrief,
		});

		const session = await executeStageSession(
			detachedStageDependencies(dependencies.stageSession),
			{
				targetDir: worktreeDir,
				model: request.model,
				effort: request.effort,
				sessionBudgetUsd: request.sessionBudgetUsd,
				productOwner,
				task: manifest.task,
				productBrief: manifest.productBrief,
				instructions: request.instructions,
				baselineContext,
				baselineHashes,
				taskId: manifest.taskId,
				taskSha: baseSha,
				baselineSha: baseSha,
				commitSubjectPattern: manifest.pipeline.commitSubjectPattern,
				skillRoots: skillSearchRoots(worktreeDir),
				log: dependencies.log,
			},
			plan.definition,
			priorArtifacts,
		);

		dependencies.log(`\n${request.stage} stage Judge`);
		const scorecard = await dependencies.runStageJudge(
			request.judgeModel,
			request.judgeEffort,
			request.sessionBudgetUsd,
			session.input,
			await dependencies.loadStageRubric(plan.definition),
		);

		const timestamp = new Date().toISOString();
		const record: ReplayRecord = {
			replay: true,
			timestamp,
			runName: request.paths.name,
			stage: request.stage,
			consumed: {
				stage: plan.consumed.stage,
				lineage: plan.consumed.lineage,
				targetSha: plan.consumed.targetSha,
			},
			baseSha,
			lineage: lineageKey({
				upstream: plan.consumed.lineage,
				corpusFiles: session.corpusFiles,
				model: request.model,
				effort: request.effort,
			}),
			corpusFiles: session.corpusFiles,
			model: request.model,
			effort: request.effort,
			judgeModel: request.judgeModel,
			judgeEffort: request.judgeEffort,
			sessionBudgetUsd: request.sessionBudgetUsd,
			controlSha: request.controlSha,
			stageCostUsd: session.transcript.costUsd,
			productOwnerCostUsd: productOwner.snapshot().spentUsd,
			judgeCostUsd: scorecard.costUsd,
			resultSha: session.buildEvidence?.resultSha,
			stale: staleness.length > 0,
			staleness: staleness.map(({ stage, causes }) => ({ stage, causes })),
			scorecard,
		};
		const recordPath = request.paths.replayRecordFile(
			plan.consumed.lineage,
			timestamp,
		);
		await Bun.write(recordPath, `${JSON.stringify(record, null, 2)}\n`);
		outcome = { record, recordPath };
	} catch (error) {
		dependencies.log(`Replay failed; evidence preserved at ${worktreeDir}`);
		throw error;
	}

	await dependencies.removeWorktree(manifest.sourceRoot, worktreeDir);
	await rm(parent, { force: true, recursive: true });

	return outcome;
}
