import { cp, lstat, mkdir, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, relative } from "node:path";
import type { DirectoryCorpusRoot, LiveCorpusRoot } from "./corpus-file";
import { resolvesOutsideCorpus } from "./corpus-file";
import type { CorpusLayoutEntry, ResolvedCorpusSource } from "./corpus-source";
import { corpusLayoutEntries } from "./corpus-source";
import type { CorpusSnapshotOrigin } from "./session-record";

export class SessionCorpusError extends Error {
	public override name = "SessionCorpusError";
}

/**
 * The one directory a session attempt's corpus bytes are read from, for
 * hashing and for installing alike. Its shape is corpus layout, so a reader
 * cannot tell whether the bytes were copied or already installed.
 * It carries the paths the case declared because a source holds files no case
 * named, and installing or selecting one of those would run the attempt
 * against a corpus it never declared.
 */
interface SessionCorpusSnapshotFields {
	readonly origin: CorpusSnapshotOrigin;
	readonly declaredPaths: readonly string[];
}

export type SessionCorpusSnapshot = SessionCorpusSnapshotFields &
	(LiveCorpusRoot | DirectoryCorpusRoot);

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
 * A source carries the whole corpus, most of which no case reads, so the
 * refusal keys on what the case declared: a skill the case does not name is
 * never reported, and refusing on its presence would make a source unusable for
 * the styles and agents that do get delivered.
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
		return snapshotOf(source, source.root, declaredPaths);
	}

	refuseDeclaredSkills(declaredPaths);
	await copyDeclared(source, destination, declaredPaths);

	return snapshotOf(source, destination, declaredPaths);
}

/**
 * A confirmation group cannot keep a live corpus pointer: every repetition
 * must read the bytes captured before the first provider call. This always
 * copies the declared, currently deliverable corpus files and retains the
 * original source only as provenance.
 */
export async function freezeSessionCorpus(
	source: ResolvedCorpusSource,
	destination: string,
	declaredPaths: readonly string[],
): Promise<SessionCorpusSnapshot> {
	refuseDeclaredSkills(declaredPaths);
	await copyDeclared(source, destination, declaredPaths);

	return {
		kind: "directory",
		root: destination,
		origin: originOf(source),
		declaredPaths: [...declaredPaths],
	};
}

function snapshotOf(
	source: ResolvedCorpusSource,
	root: string,
	declaredPaths: readonly string[],
): SessionCorpusSnapshot {
	const fields: SessionCorpusSnapshotFields = {
		origin: originOf(source),
		declaredPaths: [...declaredPaths],
	};
	if (source.kind === "live") {
		return {
			kind: source.kind,
			root,
			backingRoot: source.backingRoot,
			...fields,
		};
	}

	return {
		kind: source.kind,
		root,
		...fields,
	};
}

/**
 * A recursive copy dereferences, so an entry reached through a link copies bytes
 * from outside the source: the harness would hash and install whatever the link
 * points at while the record says it snapshotted a source. Containment of the
 * resolved path is what answers it, because the link can be the entry itself or
 * any directory above it, and an `lstat` on the entry sees only the first. A
 * skill entry is a directory, so the entries inside it are checked too.
 */
async function refuseSymlinks(
	source: ResolvedCorpusSource,
	entry: CorpusLayoutEntry,
): Promise<void> {
	if (await resolvesOutsideCorpus(source, entry.sourcePath)) {
		throw symlinkedCorpusEntry(entry.layoutPath);
	}

	const stats = await lstat(entry.sourcePath);
	if (!stats.isDirectory()) {
		return;
	}

	for (const nested of await readdir(entry.sourcePath, {
		recursive: true,
		withFileTypes: true,
	})) {
		const nestedPath = join(nested.parentPath, nested.name);
		if (await resolvesOutsideCorpus(source, nestedPath)) {
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
		`Corpus entry ${layoutPath} resolves outside the corpus source, which would snapshot bytes the corpus does not hold`,
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
		await refuseSymlinks(source, entry);

		const target = join(destination, entry.layoutPath);
		await mkdir(dirname(target), { recursive: true });
		await cp(entry.sourcePath, target, {
			recursive: true,
			dereference: source.kind === "live",
		});
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

const OVERLAID_KINDS: readonly string[] = [
	"output-styles/",
	"agents/",
	"rulebook/",
];

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
