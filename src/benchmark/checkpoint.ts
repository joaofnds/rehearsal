import { createHash } from "node:crypto";
import { cp, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { type Effort, effortSchema, WORKFLOW_PATHS } from "./config";

export interface HashedFile {
	readonly path: string;
	readonly sha256: string;
}

export interface LineageInputs {
	readonly upstream: string;
	readonly corpusFiles: readonly HashedFile[];
	readonly model: string;
	readonly effort?: Effort;
}

export interface RootLineageInputs {
	readonly taskSha: string;
	readonly task: string;
	readonly productBrief: string;
	readonly workflowFiles: readonly HashedFile[];
}

function sha256(content: string) {
	return createHash("sha256").update(content).digest("hex");
}

// Codepoint order, never locale collation: the lineage key must hash the
// same bytes on every machine, and locale-aware sorting varies with the
// host's collation rules.
function canonicalFiles(files: readonly HashedFile[]) {
	return [...files]
		.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
		.map(({ path, sha256 }) => ({ path, sha256 }));
}

/**
 * The key hashes exactly the inputs the design names — upstream checkpoint,
 * corpus files feeding the stage, model, effort — so a checkpoint is
 * invalidated when and only when one of them changes. Nothing else may enter
 * this object: an extra field would invalidate checkpoints spuriously.
 */
export function lineageKey(inputs: LineageInputs) {
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
async function statIfExists(path: string) {
	try {
		return await stat(path);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return undefined;
		}

		throw error;
	}
}

async function hashFile(path: string) {
	return createHash("sha256")
		.update(await Bun.file(path).bytes())
		.digest("hex");
}

async function hashDirectory(root: string, prefix: string) {
	const entries = await readdir(root, { recursive: true });
	const files: HashedFile[] = [];

	for (const entry of entries.sort()) {
		const absolute = join(root, entry);
		if (!(await stat(absolute)).isFile()) continue;

		files.push({ path: join(prefix, entry), sha256: await hashFile(absolute) });
	}

	return files;
}

export function skillSearchRoots(targetDir: string) {
	return [
		join(targetDir, ".claude", "skills"),
		join(homedir(), ".claude", "skills"),
	];
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
	for (const root of roots) {
		const directory = join(root, skill);
		if (!(await statIfExists(directory))?.isDirectory()) continue;

		return [
			{ path: "CLAUDE.md", sha256: sha256(instructions) },
			...(await hashDirectory(directory, join("skills", skill))),
		];
	}

	throw new Error(
		`The ${skill} skill is not installed; searched ${roots.join(", ")}`,
	);
}

/**
 * The first stage has no upstream checkpoint; its upstream is the initial
 * state the run created: the task commit, the task and brief texts that feed
 * every session, and the workflow files present before any stage ran.
 */
export function rootLineage(inputs: RootLineageInputs) {
	return sha256(
		JSON.stringify({
			taskSha: inputs.taskSha,
			task: sha256(inputs.task),
			productBrief: sha256(inputs.productBrief),
			workflowFiles: canonicalFiles(inputs.workflowFiles),
		}),
	);
}

export function hashArtifacts(
	artifacts: readonly { readonly path: string; readonly content: string }[],
): readonly HashedFile[] {
	return artifacts.map(({ path, content }) => ({
		path,
		sha256: sha256(content),
	}));
}

const hashedFileSchema = z.object({
	path: z.string().min(1),
	sha256: z.string().regex(/^[0-9a-f]{64}$/),
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

export type CheckpointRecord = z.infer<typeof checkpointRecordSchema>;

export interface CheckpointInputs {
	readonly stage: string;
	readonly targetSha: string;
	readonly upstream: string;
	readonly model: string;
	readonly effort?: Effort;
	readonly corpusFiles: readonly HashedFile[];
	readonly artifacts: readonly HashedFile[];
}

const RECORD_FILE = "checkpoint.json";
const SNAPSHOT_DIRECTORY = "workflow-state";

async function existingWorkflowPaths(root: string) {
	const present: string[] = [];

	for (const path of WORKFLOW_PATHS) {
		if (await statIfExists(join(root, path))) present.push(path);
	}

	return present;
}

async function copyWorkflowTrees(from: string, to: string) {
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
		...(inputs.effort === undefined ? {} : { effort: inputs.effort }),
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

export async function materializeCheckpoint(
	directory: string,
	destination: string,
): Promise<CheckpointRecord> {
	const record = checkpointRecordSchema.parse(
		JSON.parse(await Bun.file(join(directory, RECORD_FILE)).text()),
	);

	// Whole trees, not the recorded files one by one: the workflow tools
	// expect their empty directories (backlog/docs, backlog/drafts, ...) to
	// exist, and only a tree copy carries them.
	await copyWorkflowTrees(join(directory, SNAPSHOT_DIRECTORY), destination);

	for (const { path, sha256: expected } of record.workflowState) {
		const actual = await hashFile(join(destination, path)).catch(
			() => "missing",
		);
		if (actual !== expected) {
			throw new Error(
				`Checkpoint snapshot does not match its record: ${path} hashes ${actual}, recorded ${expected}`,
			);
		}
	}

	return record;
}
