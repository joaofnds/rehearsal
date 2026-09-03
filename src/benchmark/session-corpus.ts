import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { PROJECT_INSTRUCTIONS_PATH } from "./config";
import { pathExists } from "./file-presence";
import type {
	ChezmoiCorpusSource,
	ResolvedCorpusSource,
} from "./corpus-source";
import { corpusLayoutEntries } from "./corpus-source";

export class SessionCorpusError extends Error {
	public override name = "SessionCorpusError";
}

/**
 * How a snapshot's bytes were selected, recorded so two runs at the same
 * chezmoi ref are comparable and a ref that moved between them is visible. A
 * ref names different bytes on different days; its resolved commit does not.
 */
export type CorpusSnapshotOrigin =
	| { readonly kind: "live" }
	| { readonly kind: "directory"; readonly source: string }
	| {
			readonly kind: "chezmoi";
			readonly ref: string;
			readonly commit: string;
	  };

/**
 * The one directory a session attempt's corpus bytes are read from, for
 * hashing and for installing alike. Its shape is corpus layout, so a reader
 * cannot tell whether the bytes were rendered, copied, or already installed.
 */
export interface SessionCorpusSnapshot {
	readonly kind: ResolvedCorpusSource["kind"];
	readonly root: string;
	readonly origin: CorpusSnapshotOrigin;
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
		return { kind: "live", root: source.root, origin: originOf(source) };
	}

	refuseDeclaredSkills(declaredPaths);

	const entries = await corpusLayoutEntries(source);
	await mkdir(destination, { recursive: true });
	for (const entry of entries) {
		const target = join(destination, entry.layoutPath);
		await mkdir(dirname(target), { recursive: true });
		await cp(entry.sourcePath, target, { recursive: true });
	}

	if (source.kind === "chezmoi") {
		await cp(PROJECT_INSTRUCTIONS_PATH, join(destination, "CLAUDE.md"));
		await discardRender(source);
	}

	return { kind: source.kind, root: destination, origin: originOf(source) };
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

	for (const kind of ["output-styles", "agents"]) {
		const installed = join(snapshot.root, kind);
		if (!(await pathExists(installed))) {
			continue;
		}

		await mkdir(join(attemptDirectory, ".claude"), { recursive: true });
		await cp(installed, join(attemptDirectory, ".claude", kind), {
			recursive: true,
		});
	}
}

/**
 * Which output style the snapshot delivers, so the attempt can select it: a
 * project-level style shadows the user-level one only when it is named, and
 * nothing else can name it because the snapshot is where the bytes are.
 */
export async function snapshotStyleName(
	snapshot: SessionCorpusSnapshot,
): Promise<string | undefined> {
	const names = await readdir(join(snapshot.root, "output-styles")).catch(
		() => [],
	);
	const style = names
		.toSorted((left, right) => left.localeCompare(right))
		.find((name) => extname(name) === ".md");

	return style === undefined ? undefined : basename(style, ".md");
}
