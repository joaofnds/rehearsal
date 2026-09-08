import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { SymlinkedEntryError } from "./file-presence";

/**
 * Where the corpus is installed for a session that names no source. Every
 * other corpus kind is already read from here; the instruction file is too.
 */
export function liveCorpusRoot(): string {
	return join(homedir(), ".claude");
}

/**
 * What resolving a layout path needs and nothing more: the root the bytes are
 * under, and whether that root is the live install. A resolved corpus source
 * and a corpus snapshot both satisfy it.
 */
export interface CorpusRoot {
	readonly kind: "live" | "directory";
	readonly root: string;
}

export class CorpusFileError extends Error {
	public override name = "CorpusFileError";
}

/**
 * A declared path is data, and `..` in it would name a file the corpus install
 * does not hold, whose bytes would then be hashed into lineage and whose
 * resolved path would be printed in the attempt record.
 */
function confinedTo(root: string, layoutPath: string): string {
	const absolute = resolve(root, layoutPath);
	if (!absolute.startsWith(`${root}/`)) {
		throw new CorpusFileError(
			`Corpus file ${layoutPath} names a path outside the corpus install`,
		);
	}

	return absolute;
}

/**
 * The corpus's global instruction file, in corpus layout. A repository's own
 * CLAUDE.md is its project instructions and is not this file.
 */
export const CORPUS_INSTRUCTIONS_PATH = "CLAUDE.md";

/**
 * The directories corpus layout holds beside the instruction file. Resolving a
 * declared path, enumerating a source, and deciding whether a directory is a
 * corpus at all are three readings of this one list, so a source cannot hold a
 * kind one of them then fails to see.
 */
export const CORPUS_LAYOUT_DIRECTORIES: readonly string[] = [
	"skills",
	"agents",
	"output-styles",
	"rulebook",
];

/**
 * The one predicate that knows what a corpus layout path looks like, so a
 * second reader (observing what a session loaded, rather than resolving it to
 * bytes) answers the same question the same way instead of drifting from it.
 */
export function isCorpusLayoutPath(path: string): boolean {
	return (
		path === CORPUS_INSTRUCTIONS_PATH ||
		CORPUS_LAYOUT_DIRECTORIES.some((directory) =>
			path.startsWith(`${directory}/`),
		)
	);
}

/**
 * The one place that knows where a corpus layout path lands. A case names a
 * file in corpus layout paths, and this maps that layout onto the root the
 * resolved source carries, so the reader never learns where the bytes came
 * from.
 */
export function resolveCorpusFile(
	source: CorpusRoot,
	layoutPath: string,
): string {
	if (isCorpusLayoutPath(layoutPath)) {
		return confinedTo(source.root, layoutPath);
	}

	throw new CorpusFileError(
		`Corpus file ${layoutPath} names no corpus layout path: use CLAUDE.md, output-styles/<name>.md, agents/<name>.md, rulebook/<name>.md, or skills/<name>/...`,
	);
}

/**
 * A declared path that lands inside the root can still be a link, or sit under
 * a linked directory, and opening it reads bytes the corpus does not hold while
 * filing them under a path that says it does. `confinedTo` is lexical and never
 * resolves a link; an `lstat` on the leaf sees a link one level down but not an
 * intermediate directory that is one. Only resolving every component answers it,
 * and both sides get resolved because macOS resolves `/tmp` to `/private/tmp`,
 * so comparing a resolved path against a raw root rejects everything under it.
 *
 * A live source is exempt for the same reason `hashDirectory` takes
 * `rootMayBeALink`: a `.claude` install is a tree of links into the real corpus,
 * its own CLAUDE.md included, so containment against its root would refuse every
 * file it holds. Only `liveCorpusRoot()` builds a live root, so no declared
 * source can claim the exemption.
 */
export async function resolvesOutside(
	root: string,
	absolute: string,
): Promise<boolean> {
	const resolvedRoot = await realpath(root);
	const resolvedPath = await realpath(absolute);

	return !resolvedPath.startsWith(`${resolvedRoot}${sep}`);
}

async function refuseUncontained(
	source: CorpusRoot,
	layoutPath: string,
	absolute: string,
): Promise<void> {
	if (source.kind === "live") {
		return;
	}

	if (await resolvesOutside(source.root, absolute)) {
		throw new SymlinkedEntryError(
			`Corpus file ${layoutPath} resolves outside the corpus source, which would hash bytes the corpus does not hold`,
		);
	}
}

/**
 * The corpus's global instructions, read through the same resolution every
 * other corpus kind goes through. A corpus source holding any one kind is
 * valid, so a source with no CLAUDE.md is possible and is refused here in the
 * caller's terms rather than as a raw ENOENT at the point of use.
 */
export async function readCorpusInstructions(
	source: CorpusRoot,
): Promise<string> {
	const path = resolveCorpusFile(source, CORPUS_INSTRUCTIONS_PATH);
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new CorpusFileError(
			`Corpus file ${CORPUS_INSTRUCTIONS_PATH} does not exist at ${path}`,
		);
	}

	await refuseUncontained(source, CORPUS_INSTRUCTIONS_PATH, path);

	return file.text();
}

/**
 * The live install as a corpus source. A run, replay, or calibration takes no
 * corpus source, so the corpus it measures is whatever is installed.
 */
export function liveCorpusSource(): CorpusRoot {
	return { kind: "live", root: liveCorpusRoot() };
}

export function liveCorpusInstructions(): Promise<string> {
	return readCorpusInstructions(liveCorpusSource());
}

export interface ResolvedCorpusFile {
	readonly path: string;
	readonly resolvedPath: string;
	readonly sha256: string;
}

/**
 * A declared corpus file that does not resolve is refused here, before any
 * provider call: discovering a missing style after paying for a session is the
 * failure this ordering prevents.
 */
export async function hashCorpusFiles(
	source: CorpusRoot,
	layoutPaths: readonly string[],
): Promise<readonly ResolvedCorpusFile[]> {
	const hashed: ResolvedCorpusFile[] = [];
	for (const layoutPath of layoutPaths) {
		const resolvedPath = resolveCorpusFile(source, layoutPath);
		const file = Bun.file(resolvedPath);
		if (!(await file.exists())) {
			throw new CorpusFileError(
				`Corpus file ${layoutPath} does not exist at ${resolvedPath}`,
			);
		}

		await refuseUncontained(source, layoutPath, resolvedPath);

		hashed.push({
			path: layoutPath,
			resolvedPath,
			sha256: new Bun.CryptoHasher("sha256")
				.update(await file.bytes())
				.digest("hex"),
		});
	}

	return hashed;
}
