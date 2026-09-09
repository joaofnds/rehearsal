import { createHash } from "node:crypto";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { z } from "zod";
import type { Effort } from "./config";
import { effortSchema } from "./config";
import type { CorpusRoot } from "./corpus-file";
import { liveCorpusRoot, resolvesOutside } from "./corpus-file";
import type { Immutable } from "./contracts";
import {
	lstatIfPresent,
	statIfExists,
	SymlinkedEntryError,
} from "./file-presence";
import { copyWorkflowState, existingWorkflowTrees } from "./workflow-state";

export interface HashedFile {
	readonly path: string;
	readonly sha256: string;
}

export interface WalkedDirectory {
	readonly files: readonly HashedFile[];
	readonly refusals: readonly SymlinkedEntryError[];
}

export interface LineageInputs {
	readonly upstream: string;
	readonly corpusFiles: readonly HashedFile[];
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly settingsFile?: HashedFile | undefined;
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
export function canonicalFiles(files: readonly HashedFile[]): HashedFile[] {
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
			settingsFile: inputs.settingsFile ?? null,
		}),
	);
}

export async function hashFile(path: string): Promise<string> {
	return createHash("sha256")
		.update(await Bun.file(path).bytes())
		.digest("hex");
}

/**
 * The path is named the way the hashes are, `join(prefix, entry)`, because the
 * corpus screen redacts the absolute root before a reader sees the message. An
 * entry named alone leaves that reader knowing something called `escape.md` is
 * a link, with no way to tell which layout directory holds it.
 */
function symlinkedEntry(path: string): SymlinkedEntryError {
	return new SymlinkedEntryError(
		`${path} resolves outside the tree it is named under, so its bytes are not the ones that tree holds`,
	);
}

function danglingEntry(path: string): SymlinkedEntryError {
	return new SymlinkedEntryError(
		`${path} is a link whose target is missing, so the bytes it names cannot be read`,
	);
}

async function refuseIfLink(root: string, prefix: string): Promise<void> {
	const stats = await lstatIfPresent(root);
	if (stats?.isSymbolicLink() === true) {
		throw symlinkedEntry(prefix === "" ? root : prefix);
	}
}

/**
 * `walkDirectory` for a caller that refuses the whole tree on any refusal, so
 * the first one is the only one that changes its outcome.
 */
export async function hashDirectory(
	root: string,
	prefix: string,
	{ rootMayBeALink }: { readonly rootMayBeALink: boolean },
): Promise<HashedFile[]> {
	const { files, refusals } = await walkDirectory(root, prefix, {
		rootMayBeALink,
	});

	const [first] = refusals;
	if (first !== undefined) {
		throw first;
	}

	return [...files];
}

/**
 * An entry whose resolved path leaves the walked tree is refused, because
 * `readdir` follows a link: it lists the link's descendants as ordinary entries
 * under the link's own relative path, so hashing them reads bytes from outside
 * the tree the caller named and files them under a path that claims they are
 * inside it. Skipping the link alone does not stop that, since the descendants
 * are listed under their own paths and report no link of their own. Resolving
 * every component is what sees it, because the link may be the entry or any
 * directory above it, and a link that resolves back inside the tree is followed
 * rather than refused: nothing escapes, and a corpus may link within itself.
 *
 * A link whose target is gone resolves to nothing, so it is refused too, under
 * its own message: the walk that skipped it would report a lineage as complete
 * while a declared file was never hashed, and a reader told it escaped the tree
 * would go looking for a leak that is not there.
 *
 * `rootMayBeALink` is the caller's answer for the root itself, which `readdir`
 * follows before this walk sees anything. Only a caller that resolved the root
 * from a trusted location may say yes: a `.claude` layout directory is
 * routinely a symlink into the real corpus, and refusing it would empty every
 * lineage this records. A root taken from a target repository or a case
 * declaration says no, or the link it is becomes the whole leak one directory
 * further up.
 *
 * Both a checkpoint's workflow state and a session case's fixture hash through
 * here, because two copies of this walk could disagree about ordering or about
 * what counts as a file, and a lineage key that differs by walk is a stale
 * checkpoint nobody can explain.
 *
 * Every refused entry is reported rather than the first, because a caller that
 * displays them needs all of them: one benign entry sorting before a hostile
 * one would otherwise hide it, and whoever plants the hostile one chooses both
 * names. A refused entry's descendants are skipped, since naming each of them
 * would put the outside tree's filenames in a message whose purpose is not to
 * report what the link points at.
 *
 * An entry `readdir` lists but that no longer exists by the time this walk
 * reaches it is skipped rather than thrown: a frozen snapshot this function's
 * other callers hash never loses a file mid-walk, so this tolerance is a no-op
 * for them, but the live corpus root the corpus screen hashes is a directory
 * another process can still be writing to.
 */
export async function walkDirectory(
	root: string,
	prefix: string,
	{ rootMayBeALink }: { readonly rootMayBeALink: boolean },
): Promise<WalkedDirectory> {
	if (!rootMayBeALink) {
		await refuseIfLink(root, prefix);
	}

	const entries = await readdir(root, { recursive: true });
	const files: HashedFile[] = [];
	const refusals: SymlinkedEntryError[] = [];
	const refused: string[] = [];

	for (const entry of entries.toSorted()) {
		if (refused.some((above) => entry.startsWith(`${above}${sep}`))) {
			continue;
		}

		const absolute = join(root, entry);
		const linkStats = await lstatIfPresent(absolute);
		if (linkStats === undefined) {
			continue;
		}

		const entryStats = await statIfExists(absolute);
		if (entryStats === undefined) {
			refusals.push(danglingEntry(join(prefix, entry)));
			refused.push(entry);
			continue;
		}
		if (await resolvesOutside(root, absolute)) {
			refusals.push(symlinkedEntry(join(prefix, entry)));
			refused.push(entry);
			continue;
		}
		if (!entryStats.isFile()) {
			continue;
		}

		files.push({ path: join(prefix, entry), sha256: await hashFile(absolute) });
	}

	return { files, refusals };
}

/**
 * A layout root holds `skills/`, `agents/`, and `output-styles/` as siblings,
 * the shape a `.claude` directory has whether it belongs to a project or a
 * user. Project level is searched before user level, so a stage session
 * reads the frozen bytes a worktree's project-level `.claude` carries before
 * falling back to whatever is live at user level.
 */
export function corpusLayoutRoots(targetDir: string): string[] {
	return [join(targetDir, ".claude"), liveCorpusRoot()];
}

/**
 * Where a stage's corpus lives for one corpus source, so `stale` and `replay`
 * cannot disagree about whether the same checkpoint is stale. The live
 * install is the pair `corpusLayoutRoots` already searches against the
 * target under test, project level first; a resolved directory or render is
 * the whole corpus, so nothing outside it may shadow what it holds.
 */
export function stageCorpusRoots(
	source: CorpusRoot,
	targetRoot: string,
): readonly string[] {
	return source.kind === "live" ? corpusLayoutRoots(targetRoot) : [source.root];
}

export async function resolveSkillDirectory(
	skill: string,
	roots: readonly string[],
): Promise<string> {
	for (const root of roots) {
		const directory = join(root, "skills", skill);
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
 * The first root, project then user, that holds a whole `agents/` or
 * `output-styles/` directory. Neither kind is resolved by name the way a
 * skill is: the whole directory is either frozen corpus or it is live, never
 * merged file by file across roots.
 */
async function resolveLayoutDirectory(
	kind: string,
	roots: readonly string[],
): Promise<string | undefined> {
	for (const root of roots) {
		const directory = join(root, kind);
		const directoryStats = await statIfExists(directory);
		if (directoryStats?.isDirectory() === true) {
			return directory;
		}
	}

	return undefined;
}

/**
 * Skills every stage reads regardless of which skill it invokes, so an edit
 * to one changes every stage's corpus. A declared list: adding another global
 * skill later is one entry here. The doctrine left this list when it became a
 * rules file, which `rulebook` now carries whole.
 */
export const GLOBAL_SKILLS: readonly string[] = [];

/**
 * The whole-directory corpus kinds a stage's corpus carries beside its skills:
 * every agent, every output style, and every rule, whichever root supplies
 * them, because a stage session can read any of them and all must be frozen
 * the same way a skill is. Rules are a directory of files rather than a named
 * unit like a skill, so a stage reads them by path and the whole tree is
 * frozen.
 */
const LAYOUT_DIRECTORY_KINDS: readonly string[] = [
	"agents",
	"output-styles",
	"rulebook",
];

/**
 * Corpus file paths are recorded relative to the corpus, not the machine, so
 * the same skill bytes produce the same lineage wherever they are installed.
 * The global skills join every stage's corpus beside the installed
 * instructions, because every stage reads them. Agents and output styles join
 * it too, whole, from the first root that has them: a stage session's skill
 * can invoke either, and both must be frozen along with the skill it invokes.
 */
export async function captureStageCorpus(
	skill: string,
	instructions: string,
	roots: readonly string[],
): Promise<readonly HashedFile[]> {
	const files: HashedFile[] = [
		{ path: "CLAUDE.md", sha256: sha256(instructions) },
	];

	for (const kind of LAYOUT_DIRECTORY_KINDS) {
		const directory = await resolveLayoutDirectory(kind, roots);
		if (directory !== undefined) {
			files.push(
				...(await hashDirectory(directory, kind, {
					rootMayBeALink: true,
				})),
			);
		}
	}

	// The stage's own skill is hashed once even when it is a global one:
	// hashing it twice would say nothing more and would make the corpus
	// depend on which stage happens to invoke it.
	for (const global of GLOBAL_SKILLS) {
		files.push(
			...(await hashDirectory(
				await resolveSkillDirectory(global, roots),
				join("skills", global),
				{ rootMayBeALink: true },
			)),
		);
	}
	if (!GLOBAL_SKILLS.includes(skill)) {
		files.push(
			...(await hashDirectory(
				await resolveSkillDirectory(skill, roots),
				join("skills", skill),
				{ rootMayBeALink: true },
			)),
		);
	}

	return files;
}

export async function snapshotStageCorpus(
	skill: string,
	instructions: string,
	roots: readonly string[],
	destination: string,
): Promise<readonly HashedFile[]> {
	const skillsDirectory = join(destination, "skills");
	await mkdir(skillsDirectory, { recursive: true });
	await Bun.write(join(destination, "CLAUDE.md"), instructions);

	const skills = new Set([...GLOBAL_SKILLS, skill]);
	for (const name of skills) {
		await cp(
			await resolveSkillDirectory(name, roots),
			join(skillsDirectory, name),
			{ recursive: true },
		);
	}

	for (const kind of LAYOUT_DIRECTORY_KINDS) {
		const directory = await resolveLayoutDirectory(kind, roots);
		if (directory !== undefined) {
			await cp(directory, join(destination, kind), { recursive: true });
		}
	}

	return captureStageCorpus(skill, instructions, [destination]);
}

/**
 * A worktree is reused across every stage of a rep, so a kind a prior stage's
 * snapshot carried but this one doesn't must be cleared, not left behind: a
 * plain `cp` only overwrites same-named files and would leave the prior
 * stage's agents or output styles readable by a session whose recorded corpus
 * says it never had them.
 */
async function replaceLayoutDirectory(
	source: string,
	target: string,
): Promise<void> {
	await rm(target, { recursive: true, force: true });
	await cp(source, target, { recursive: true });
}

/**
 * `cp` dereferences, so an entry reached through a link installs bytes from
 * outside the snapshot into the worktree the session reads, while the record
 * says the session read the snapshot. Containment of the resolved path is what
 * answers it, because the link can be the entry or any directory above it.
 */
async function refuseUncontainedEntries(
	snapshotDirectory: string,
): Promise<void> {
	for (const entry of await readdir(snapshotDirectory, {
		recursive: true,
		withFileTypes: true,
	})) {
		const absolute = join(entry.parentPath, entry.name);
		if (await resolvesOutside(snapshotDirectory, absolute)) {
			throw symlinkedEntry(
				join(relative(snapshotDirectory, entry.parentPath), entry.name),
			);
		}
	}
}

export async function installStageCorpusSnapshot(
	snapshotDirectory: string,
	targetDirectory: string,
): Promise<void> {
	await refuseUncontainedEntries(snapshotDirectory);

	const targetLayout = join(targetDirectory, ".claude");
	await mkdir(targetLayout, { recursive: true });
	await cp(
		join(snapshotDirectory, "CLAUDE.md"),
		join(targetLayout, "CLAUDE.md"),
	);
	await replaceLayoutDirectory(
		join(snapshotDirectory, "skills"),
		join(targetLayout, "skills"),
	);

	for (const kind of LAYOUT_DIRECTORY_KINDS) {
		const source = join(snapshotDirectory, kind);
		const target = join(targetLayout, kind);
		const sourceStats = await statIfExists(source);
		await (sourceStats?.isDirectory() === true
			? replaceLayoutDirectory(source, target)
			: rm(target, { recursive: true, force: true }));
	}
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
	settingsFile?: HashedFile,
): CheckpointInputs {
	return {
		stage: INITIAL_CHECKPOINT_STAGE,
		targetSha: root.taskSha,
		upstream: rootLineage(root),
		model,
		effort,
		corpusFiles: [],
		artifacts: [],
		settingsFile,
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
	readonly settingsFile?: HashedFile | undefined;
}

export interface CheckpointStaleness {
	readonly stage: string;
	readonly stale: boolean;
	readonly causes: readonly string[];
}

/**
 * A stage's corpus as it stands today: the files it hashes to, or the reason
 * the tree could not be hashed at all. A refusal is a comparison the reader
 * cannot be given, and reading it as no difference would badge the checkpoint
 * fresh on a corpus nobody can reproduce, so it stales the stage the same way
 * an edited file does.
 */
export type StageCorpus =
	| { readonly hashed: readonly HashedFile[] }
	| { readonly refused: string };

export function hashedCorpus(files: readonly HashedFile[]): StageCorpus {
	return { hashed: files };
}

export function refusedCorpus(reason: string): StageCorpus {
	return { refused: reason };
}

/**
 * How a reader is told about each way two corpora can differ. Staleness and
 * the comparison guard ask the same question of the same data and differ only
 * in what the answer means to their reader, so the traversal is shared and
 * the wording is theirs.
 */
export interface CorpusDifferenceWording {
	/** Present in both, hashing differently. */
	readonly modified: (path: string) => string;
	/** Present in the left side only. */
	readonly missingFromRight: (path: string) => string;
	/** Present in the right side only. */
	readonly missingFromLeft: (path: string) => string;
}

function assertUniqueCorpusPaths(files: readonly HashedFile[]): void {
	const paths = new Set<string>();

	for (const file of files) {
		if (paths.has(file.path)) {
			throw new Error(`Duplicate corpus path: ${file.path}`);
		}

		paths.add(file.path);
	}
}

/**
 * Every way two sets of hashed files disagree, each named by its path so a
 * reader learns which file it was, not merely that one differed. Sorted, so
 * the same disagreement reads the same way twice.
 */
export function corpusDifferences(
	left: readonly HashedFile[],
	right: readonly HashedFile[],
	wording: CorpusDifferenceWording,
): string[] {
	assertUniqueCorpusPaths(left);
	assertUniqueCorpusPaths(right);

	const rightByPath = new Map(right.map((file) => [file.path, file.sha256]));
	const differences: string[] = [];

	for (const file of left) {
		const counterpart = rightByPath.get(file.path);
		if (counterpart === undefined) {
			differences.push(wording.missingFromRight(file.path));
			continue;
		}
		if (counterpart !== file.sha256) {
			differences.push(wording.modified(file.path));
		}

		rightByPath.delete(file.path);
	}

	for (const path of rightByPath.keys()) {
		differences.push(wording.missingFromLeft(path));
	}

	return differences.toSorted();
}

/**
 * A corpus file the record has and the corpus no longer does was removed;
 * the reverse was added. Both invalidate the checkpoint as surely as an edit.
 */
const STALENESS_WORDING: CorpusDifferenceWording = {
	modified: (path) => `${path} changed`,
	missingFromRight: (path) => `${path} removed`,
	missingFromLeft: (path) => `${path} added`,
};

function stageCorpusCauses(
	recorded: readonly HashedFile[],
	current: StageCorpus,
): readonly string[] {
	if ("refused" in current) {
		return [current.refused];
	}

	return corpusDifferences(recorded, current.hashed, STALENESS_WORDING);
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
	current: ReadonlyMap<string, StageCorpus>,
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
		if (record.settingsFile?.sha256 !== request.settingsFile?.sha256) {
			const path =
				record.settingsFile?.path ?? request.settingsFile?.path ?? "none";
			causes.push(`stage settings file ${path} changed`);
		}

		const currentCorpus = current.get(record.stage);
		if (currentCorpus !== undefined) {
			causes.push(...stageCorpusCauses(record.corpusFiles, currentCorpus));
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
		settingsFile: hashedFileSchema.optional(),
	})
	.strict();

export type CheckpointRecord = Immutable<
	z.infer<typeof checkpointRecordSchema>
>;

export function parseCheckpointRecord(text: string): CheckpointRecord {
	return checkpointRecordSchema.parse(JSON.parse(text));
}

export interface CheckpointInputs {
	readonly stage: string;
	readonly targetSha: string;
	readonly upstream: string;
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly corpusFiles: readonly HashedFile[];
	readonly artifacts: readonly HashedFile[];
	readonly settingsFile?: HashedFile | undefined;
}

const RECORD_FILE = "checkpoint.json";
const SNAPSHOT_DIRECTORY = "workflow-state";

export async function hashWorkflowState(
	targetDir: string,
): Promise<readonly HashedFile[]> {
	const files: HashedFile[] = [];

	for (const tree of await existingWorkflowTrees(targetDir)) {
		files.push(
			...(await hashDirectory(tree.directory, tree.path, {
				rootMayBeALink: false,
			})),
		);
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
	await copyWorkflowState(targetDir, join(directory, SNAPSHOT_DIRECTORY));

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
		settingsFile: inputs.settingsFile,
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
	return parseCheckpointRecord(
		await Bun.file(join(directory, RECORD_FILE)).text(),
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
	await copyWorkflowState(snapshot, destination);

	return record;
}
