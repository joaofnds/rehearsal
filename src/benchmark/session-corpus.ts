import { cp, lstat, mkdir, readdir, rm } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";
import { PROJECT_INSTRUCTIONS_PATH } from "./config";
import type {
	ChezmoiCorpusSource,
	CorpusLayoutEntry,
	ResolvedCorpusSource,
} from "./corpus-source";
import { corpusLayoutEntries } from "./corpus-source";
import type { CorpusSnapshotOrigin } from "./session-record";

export class SessionCorpusError extends Error {
	public override name = "SessionCorpusError";
}

/**
 * The one directory a session attempt's corpus bytes are read from, for
 * hashing and for installing alike. Its shape is corpus layout, so a reader
 * cannot tell whether the bytes were rendered, copied, or already installed.
 * It carries the paths the case declared because a source holds files no case
 * named, and installing or selecting one of those would run the attempt
 * against a corpus it never declared.
 */
export interface SessionCorpusSnapshot {
	readonly kind: ResolvedCorpusSource["kind"];
	readonly root: string;
	readonly origin: CorpusSnapshotOrigin;
	readonly declaredPaths: readonly string[];
}

/**
 * A project-level skill does not shadow the user-level one on claude 2.1.258,
 * so a corpus carrying skill bytes would be hashed into lineage and then not
 * delivered: the attempt would record a measurement of a corpus the session
 * never read. ACT-28 owns the delivery mechanism; until it lands, refusing is
 * the only honest answer.
 */
export function undeliverableSkill(subject: string): SessionCorpusError {
	return new SessionCorpusError(
		`${subject}, and a project-level skill does not shadow the user-level one: ACT-28 owns the delivery mechanism, so a skill variant cannot be measured yet`,
	);
}

/**
 * A stage's corpus is the skill it invokes, so a stage cannot run against a
 * corpus source at all. A session case is where a corpus variant is measured
 * until ACT-28 lands.
 */
export function stageCorpusRefusal(corpus: string): SessionCorpusError {
	return undeliverableSkill(
		`A stage's corpus is the skill it invokes, so --corpus ${corpus} cannot reach it`,
	);
}

/**
 * A rendered source carries the whole corpus, most of which no case reads, so
 * the refusal keys on what the case declared: a skill the case does not name is
 * never reported, and refusing on its presence would make a chezmoi source
 * unusable for the styles and agents that do get delivered.
 */
function refuseDeclaredSkills(declaredPaths: readonly string[]): void {
	const skill = declaredPaths.find((layoutPath) =>
		layoutPath.startsWith("skills/"),
	);
	if (skill === undefined) {
		return;
	}

	throw undeliverableSkill(`The case declares corpus file ${skill}`);
}

function originOf(source: ResolvedCorpusSource): CorpusSnapshotOrigin {
	if (source.kind === "chezmoi") {
		return { kind: "chezmoi", ref: source.ref, commit: source.commit };
	}
	if (source.kind === "directory") {
		return { kind: "directory", source: source.root };
	}

	return { kind: "live" };
}

/**
 * The live install is already the corpus the session reads, so it is snapshotted
 * by naming it rather than by copying it: a copy would change the resolved paths
 * every record before `--corpus` carries, for bytes nothing installs.
 */
export async function snapshotSessionCorpus(
	source: ResolvedCorpusSource,
	destination: string,
	declaredPaths: readonly string[],
): Promise<SessionCorpusSnapshot> {
	if (source.kind === "live") {
		return {
			kind: "live",
			root: source.root,
			origin: originOf(source),
			declaredPaths: [...declaredPaths],
		};
	}

	try {
		refuseDeclaredSkills(declaredPaths);
		await copyDeclared(source, destination, declaredPaths);
	} finally {
		if (source.kind === "chezmoi") {
			await discardRender(source);
		}
	}

	return {
		kind: source.kind,
		root: destination,
		origin: originOf(source),
		declaredPaths: [...declaredPaths],
	};
}

/**
 * A recursive copy dereferences, so a symlinked entry copies bytes from outside
 * the source: the harness would hash and install whatever the link points at
 * while the record says it snapshotted a source. A skill entry is a directory,
 * so the links inside it are refused too.
 */
async function refuseSymlinks(entry: CorpusLayoutEntry): Promise<void> {
	const stats = await lstat(entry.sourcePath);
	if (stats.isSymbolicLink()) {
		throw symlinkedCorpusEntry(entry.layoutPath);
	}
	if (!stats.isDirectory()) {
		return;
	}

	for (const nested of await readdir(entry.sourcePath, {
		recursive: true,
		withFileTypes: true,
	})) {
		if (nested.isSymbolicLink()) {
			throw symlinkedCorpusEntry(
				join(
					entry.layoutPath,
					relative(entry.sourcePath, nested.parentPath),
					nested.name,
				),
			);
		}
	}
}

function symlinkedCorpusEntry(layoutPath: string): SessionCorpusError {
	return new SessionCorpusError(
		`Corpus entry ${layoutPath} is a symlink, which would snapshot bytes from outside the corpus source`,
	);
}

async function copyDeclared(
	source: ResolvedCorpusSource,
	destination: string,
	declaredPaths: readonly string[],
): Promise<void> {
	const entries = await corpusLayoutEntries(source);
	await mkdir(destination, { recursive: true });

	for (const entry of entries.filter((candidate) =>
		declares(declaredPaths, candidate.layoutPath),
	)) {
		await refuseSymlinks(entry);

		const target = join(destination, entry.layoutPath);
		await mkdir(dirname(target), { recursive: true });
		await cp(entry.sourcePath, target, { recursive: true });
	}

	if (source.kind === "chezmoi" && declaredPaths.includes("CLAUDE.md")) {
		await cp(PROJECT_INSTRUCTIONS_PATH, join(destination, "CLAUDE.md"));
	}
}

/**
 * A skill is declared as `skills/<name>/<file>` but snapshotted as the whole
 * `skills/<name>` directory, so a declared path matches the entry that carries
 * it as well as the entry it names exactly.
 */
function declares(
	declaredPaths: readonly string[],
	layoutPath: string,
): boolean {
	return declaredPaths.some(
		(declared) =>
			declared === layoutPath || declared.startsWith(`${layoutPath}/`),
	);
}

/**
 * A render is the whole home layout, of which four kinds are read, so keeping
 * it would leave a copy of the home tree in the temporary directory after every
 * run. The snapshot holds every byte anything reads afterwards.
 */
async function discardRender(source: ChezmoiCorpusSource): Promise<void> {
	await rm(source.root, { force: true, recursive: true });
	await rm(source.sourceDirectory, { force: true, recursive: true });
}

/**
 * Output styles and agent definitions placed under the attempt directory's
 * `.claude` shadow the same-named user-level ones, verified on claude 2.1.258.
 * The attempt directory is the harness's own and no live session reads it, so
 * this is how a corpus variant reaches a session without an install.
 */
export async function installSessionCorpusSnapshot(
	snapshot: SessionCorpusSnapshot,
	attemptDirectory: string,
): Promise<void> {
	if (snapshot.kind === "live") {
		return;
	}

	for (const layoutPath of snapshot.declaredPaths.filter(isOverlaid)) {
		const target = join(attemptDirectory, ".claude", layoutPath);
		await mkdir(dirname(target), { recursive: true });
		await cp(join(snapshot.root, layoutPath), target);
	}
}

const OVERLAID_KINDS: readonly string[] = ["output-styles/", "agents/"];

function isOverlaid(layoutPath: string): boolean {
	return OVERLAID_KINDS.some((kind) => layoutPath.startsWith(kind));
}

/**
 * Which output style the snapshot delivers, so the attempt can select it. It is
 * the one the case declared: a corpus holds styles no case named, and reading
 * the snapshot directory instead would select one of those while recording the
 * declared style's digest in lineage.
 */
export function snapshotStyleName(
	snapshot: SessionCorpusSnapshot,
): string | undefined {
	const style = snapshot.declaredPaths.find(
		(layoutPath) =>
			layoutPath.startsWith("output-styles/") && extname(layoutPath) === ".md",
	);

	return style === undefined ? undefined : basename(style, ".md");
}
