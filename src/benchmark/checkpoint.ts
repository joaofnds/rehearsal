import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Effort } from "./config";

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

function canonicalFiles(files: readonly HashedFile[]) {
	return [...files]
		.sort((a, b) => a.path.localeCompare(b.path))
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

/**
 * The first stage has no upstream checkpoint; its upstream is the initial
 * state the run created: the task commit, the task and brief texts that feed
 * every session, and the workflow files present before any stage ran.
 */
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
		const exists = await stat(directory)
			.then((entry) => entry.isDirectory())
			.catch(() => false);
		if (!exists) continue;

		return [
			{ path: "CLAUDE.md", sha256: sha256(instructions) },
			...(await hashDirectory(directory, join("skills", skill))),
		];
	}

	throw new Error(
		`The ${skill} skill is not installed; searched ${roots.join(", ")}`,
	);
}

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
