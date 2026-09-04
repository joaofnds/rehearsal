import { resolve } from "node:path";
import { liveCorpusRoot } from "./corpus-source";

/**
 * What resolving a layout path needs and nothing more: the root the bytes are
 * under, and which kind of source supplied it. A resolved corpus source and a
 * corpus snapshot both satisfy it.
 */
export interface CorpusRoot {
	readonly kind: "live" | "directory" | "chezmoi";
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

const CORPUS_LAYOUT_PREFIXES: readonly string[] = [
	"output-styles/",
	"agents/",
	"skills/",
];

/**
 * The corpus's global instruction file, in corpus layout. A repository's own
 * CLAUDE.md is its project instructions and is not this file.
 */
export const CORPUS_INSTRUCTIONS_PATH = "CLAUDE.md";

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
	if (layoutPath === CORPUS_INSTRUCTIONS_PATH) {
		return confinedTo(source.root, layoutPath);
	}

	for (const prefix of CORPUS_LAYOUT_PREFIXES) {
		if (layoutPath.startsWith(prefix)) {
			return confinedTo(source.root, layoutPath);
		}
	}

	throw new CorpusFileError(
		`Corpus file ${layoutPath} names no corpus layout path: use CLAUDE.md, output-styles/<name>.md, agents/<name>.md, or skills/<name>/...`,
	);
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
