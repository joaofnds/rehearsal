import { createHash } from "node:crypto";
import type { Stats } from "node:fs";
import { cp, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { Effort } from "./config";
import { effortSchema, WORKFLOW_PATHS } from "./config";
import type { Immutable } from "./contracts";

export interface HashedFile {
	readonly path: string;
	readonly sha256: string;
}

export interface LineageInputs {
	readonly upstream: string;
	readonly corpusFiles: readonly HashedFile[];
	readonly model: string;
	readonly effort?: Effort | undefined;
}

export interface RootLineageInputs {
	readonly taskSha: string;
	readonly task: string;
	readonly productBrief: string;
	readonly workflowFiles: readonly HashedFile[];
}

function sha256(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

// Codepoint order, never locale collation: the lineage key must hash the
// same bytes on every machine, and locale-aware sorting varies with the
// host's collation rules.
function canonicalFiles(files: readonly HashedFile[]): HashedFile[] {
	return files
		.toSorted((left, right) => {
			if (left.path < right.path) {
				return -1;
			}
			if (left.path > right.path) {
				return 1;
			}
			return 0;
		})
		.map((file) => ({ path: file.path, sha256: file.sha256 }));
}

/**
 * The key hashes exactly the inputs the design names — upstream checkpoint,
 * corpus files feeding the stage, model, effort — so a checkpoint is
 * invalidated when and only when one of them changes. Nothing else may enter
 * this object: an extra field would invalidate checkpoints spuriously.
 */
export function lineageKey(inputs: LineageInputs): string {
	return sha256(
		JSON.stringify({
			upstream: inputs.upstream,
			corpusFiles: canonicalFiles(inputs.corpusFiles),
			model: inputs.model,
			effort: inputs.effort ?? null,
		}),
	);
}

// Only a missing path may read as absent; any other failure (EACCES, EIO)
// must surface, or a checkpoint would silently record partial state as truth.
async function statIfExists(path: string): Promise<Stats | undefined> {
	try {
		return await stat(path);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return undefined;
		}

		throw error;
	}
}

async function hashFile(path: string): Promise<string> {
	return createHash("sha256")
		.update(await Bun.file(path).bytes())
		.digest("hex");
}

async function hashDirectory(
	root: string,
	prefix: string,
): Promise<HashedFile[]> {
	const entries = await readdir(root, { recursive: true });
	const files: HashedFile[] = [];

	for (const entry of entries.toSorted()) {
		const absolute = join(root, entry);
		const entryStats = await stat(absolute);
		if (!entryStats.isFile()) {
			continue;
		}

		files.push({ path: join(prefix, entry), sha256: await hashFile(absolute) });
	}

	return files;
}

export function skillSearchRoots(targetDir: string): string[] {
	return [
		join(targetDir, ".claude", "skills"),
		join(homedir(), ".claude", "skills"),
	];
}

export async function resolveSkillDirectory(
	skill: string,
	roots: readonly string[],
): Promise<string> {
	for (const root of roots) {
		const directory = join(root, skill);
		const directoryStats = await statIfExists(directory);
		if (directoryStats?.isDirectory() === true) {
			return directory;
		}
	}

	throw new Error(
		`The ${skill} skill is not installed; searched ${roots.join(", ")}`,
	);
}

/**
 * Corpus file paths are recorded relative to the corpus, not the machine, so
 * the same skill bytes produce the same lineage wherever they are installed.
 */
export async function captureStageCorpus(
	skill: string,
	instructions: string,
	roots: readonly string[],
): Promise<readonly HashedFile[]> {
	const directory = await resolveSkillDirectory(skill, roots);

	return [
		{ path: "CLAUDE.md", sha256: sha256(instructions) },
		...(await hashDirectory(directory, join("skills", skill))),
	];
}

/**
 * The checkpoint recorded at run start, before any stage runs, so the first
 * stage replays from a checkpoint like every other stage. The name is
 * reserved in pipeline definitions; a stage of the same name would claim the
 * same checkpoint directory.
 */
export const INITIAL_CHECKPOINT_STAGE = "initial";

/**
 * The initial checkpoint consumes no corpus: no skill ran to produce it. Its
 * upstream is the root lineage, so the chain starts at the initial state the
 * run created rather than at any stage's output.
 */
export function initialCheckpointInputs(
	root: RootLineageInputs,
	model: string,
	effort?: Effort,
): CheckpointInputs {
	return {
		stage: INITIAL_CHECKPOINT_STAGE,
		targetSha: root.taskSha,
		upstream: rootLineage(root),
		model,
		effort,
		corpusFiles: [],
		artifacts: [],
	};
}

/**
 * The first stage has no upstream checkpoint; its upstream is the initial
 * state the run created: the task commit, the task and brief texts that feed
 * every session, and the workflow files present before any stage ran.
 */
export function rootLineage(inputs: RootLineageInputs): string {
	return sha256(
		JSON.stringify({
			taskSha: inputs.taskSha,
			task: sha256(inputs.task),
			productBrief: sha256(inputs.productBrief),
			workflowFiles: canonicalFiles(inputs.workflowFiles),
		}),
	);
}

export interface StalenessRequest {
	readonly model: string;
	readonly effort?: Effort | undefined;
}

export interface CheckpointStaleness {
	readonly stage: string;
	readonly stale: boolean;
	readonly causes: readonly string[];
}

/**
 * A corpus file differs when its hash changed, when the record has it and
 * the corpus no longer does, or the reverse. Each is named by its path so a
 * reader learns which edit invalidated the checkpoint, not merely that one
 * did.
 */
function corpusChanges(
	recorded: readonly HashedFile[],
	current: readonly HashedFile[],
): string[] {
	const currentByPath = new Map(
		current.map((file) => [file.path, file.sha256]),
	);
	const causes: string[] = [];

	for (const file of recorded) {
		const now = currentByPath.get(file.path);
		if (now === undefined) {
			causes.push(`${file.path} removed`);
			continue;
		}
		if (now !== file.sha256) {
			causes.push(`${file.path} changed`);
		}

		currentByPath.delete(file.path);
	}

	for (const path of currentByPath.keys()) {
		causes.push(`${path} added`);
	}

	return causes.toSorted();
}

/**
 * Walks the chain in order, so an upstream stale checkpoint carries forward:
 * a checkpoint produced from state that can no longer be reproduced is stale
 * whatever its own corpus says. The initial checkpoint consumes no corpus, so
 * only a model or effort change can make it stale.
 *
 * A stage absent from `current` is one the corpus no longer feeds; its own
 * corpus is left unjudged and only its upstream can make it stale.
 */
export function deriveStaleness(
	chain: readonly CheckpointRecord[],
	current: ReadonlyMap<string, readonly HashedFile[]>,
	request: StalenessRequest,
): CheckpointStaleness[] {
	const staleness: CheckpointStaleness[] = [];
	let staleUpstream: string | undefined;

	for (const record of chain) {
		const causes: string[] = [];
		if (staleUpstream !== undefined) {
			causes.push(`upstream stage ${staleUpstream} is stale`);
		}
		if (record.model !== request.model) {
			causes.push(`model ${record.model} is now ${request.model}`);
		}
		if (record.effort !== request.effort) {
			causes.push(
				`effort ${record.effort ?? "none"} is now ${request.effort ?? "none"}`,
			);
		}

		const currentCorpus = current.get(record.stage);
		if (currentCorpus !== undefined) {
			causes.push(...corpusChanges(record.corpusFiles, currentCorpus));
		}

		const stale = causes.length > 0;
		staleness.push({ stage: record.stage, stale, causes });
		if (stale && staleUpstream === undefined) {
			staleUpstream = record.stage;
		}
	}

	return staleness;
}

export function hashArtifacts(
	artifacts: readonly { readonly path: string; readonly content: string }[],
): readonly HashedFile[] {
	return artifacts.map(({ path, content }) => ({
		path,
		sha256: sha256(content),
	}));
}

export const hashedFileSchema = z.object({
	path: z
		.string()
		.min(1)
		.refine(
			(path) => !path.startsWith("/") && !path.split("/").includes(".."),
			"must be a relative path without traversal",
		),
	sha256: z.string().regex(/^[0-9a-f]{64}$/u),
});

const checkpointRecordSchema = z
	.object({
		stage: z.string().min(1),
		targetSha: z.string().min(1),
		lineage: z.string().min(1),
		upstream: z.string().min(1),
		model: z.string().min(1),
		effort: effortSchema.optional(),
		corpusFiles: z.array(hashedFileSchema),
		artifacts: z.array(hashedFileSchema),
		workflowState: z.array(hashedFileSchema),
	})
	.strict();

export type CheckpointRecord = Immutable<
	z.infer<typeof checkpointRecordSchema>
>;

export interface CheckpointInputs {
	readonly stage: string;
	readonly targetSha: string;
	readonly upstream: string;
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly corpusFiles: readonly HashedFile[];
	readonly artifacts: readonly HashedFile[];
}

const RECORD_FILE = "checkpoint.json";
const SNAPSHOT_DIRECTORY = "workflow-state";

async function existingWorkflowPaths(root: string): Promise<string[]> {
	const present: string[] = [];

	for (const path of WORKFLOW_PATHS) {
		if (await statIfExists(join(root, path))) {
			present.push(path);
		}
	}

	return present;
}

async function copyWorkflowTrees(from: string, to: string): Promise<void> {
	for (const path of await existingWorkflowPaths(from)) {
		await cp(join(from, path), join(to, path), { recursive: true });
	}
}

export async function hashWorkflowState(
	targetDir: string,
): Promise<readonly HashedFile[]> {
	const files: HashedFile[] = [];

	for (const path of await existingWorkflowPaths(targetDir)) {
		files.push(...(await hashDirectory(join(targetDir, path), path)));
	}

	return files;
}

/**
 * The snapshot is a byte-faithful copy, never the bounded captures used for
 * judge context: materializing it must reproduce exactly the state the next
 * stage consumed (ACT-2 decision 2).
 */
export async function recordCheckpoint(
	targetDir: string,
	directory: string,
	inputs: CheckpointInputs,
): Promise<CheckpointRecord> {
	const workflowState = await hashWorkflowState(targetDir);
	await copyWorkflowTrees(targetDir, join(directory, SNAPSHOT_DIRECTORY));

	const record: CheckpointRecord = {
		stage: inputs.stage,
		targetSha: inputs.targetSha,
		lineage: lineageKey(inputs),
		upstream: inputs.upstream,
		model: inputs.model,
		effort: inputs.effort,
		corpusFiles: canonicalFiles(inputs.corpusFiles),
		artifacts: canonicalFiles(inputs.artifacts),
		workflowState: canonicalFiles(workflowState),
	};
	await Bun.write(
		join(directory, RECORD_FILE),
		`${JSON.stringify(record, null, 2)}\n`,
	);

	return record;
}

export async function readCheckpointRecord(
	directory: string,
): Promise<CheckpointRecord> {
	return checkpointRecordSchema.parse(
		JSON.parse(await Bun.file(join(directory, RECORD_FILE)).text()),
	);
}

export async function materializeCheckpoint(
	directory: string,
	destination: string,
): Promise<CheckpointRecord> {
	const record = await readCheckpointRecord(directory);

	// The snapshot must match the record exactly — a modified, missing, or
	// planted file all void it — and nothing is copied until it does.
	const snapshot = join(directory, SNAPSHOT_DIRECTORY);
	const recorded = new Map(
		record.workflowState.map((file) => [file.path, file.sha256]),
	);
	for (const file of await hashWorkflowState(snapshot)) {
		const expected = recorded.get(file.path);
		if (expected === undefined) {
			throw new Error(
				`Checkpoint snapshot does not match its record: ${file.path} is not recorded`,
			);
		}
		if (file.sha256 !== expected) {
			throw new Error(
				`Checkpoint snapshot does not match its record: ${file.path} hashes ${file.sha256}, recorded ${expected}`,
			);
		}

		recorded.delete(file.path);
	}
	const missing = recorded.keys().next();
	if (missing.done !== true) {
		throw new Error(
			`Checkpoint snapshot does not match its record: ${missing.value} is recorded but missing`,
		);
	}

	// Whole trees, not the recorded files one by one: the workflow tools
	// expect their empty directories (backlog/docs, backlog/drafts, ...) to
	// exist, and only a tree copy carries them.
	await copyWorkflowTrees(snapshot, destination);

	return record;
}
