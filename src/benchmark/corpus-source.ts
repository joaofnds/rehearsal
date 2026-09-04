import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
	CORPUS_INSTRUCTIONS_PATH,
	CORPUS_LAYOUT_DIRECTORIES,
	liveCorpusRoot,
} from "./corpus-file";
import { pathExists } from "./file-presence";

export class CorpusSourceError extends Error {
	public override name = "CorpusSourceError";
}

export interface LiveCorpusSource {
	readonly kind: "live";
	readonly root: string;
}

export interface DirectoryCorpusSource {
	readonly kind: "directory";
	readonly root: string;
}

/**
 * Where an attempt's corpus bytes come from, parsed once so nothing downstream
 * learns how the directory came to exist: `root` is the only thing hashing and
 * installing ever see.
 */
export type ResolvedCorpusSource = LiveCorpusSource | DirectoryCorpusSource;

/**
 * The entries a directory must hold at least one of to be a corpus. Without
 * this a mistyped path resolves to an empty corpus, and every declared file
 * then fails one at a time instead of the source failing once.
 */
const CORPUS_LAYOUT_ENTRIES: readonly string[] = [
	CORPUS_INSTRUCTIONS_PATH,
	...CORPUS_LAYOUT_DIRECTORIES,
];

async function holdsCorpusLayout(root: string): Promise<boolean> {
	for (const entry of CORPUS_LAYOUT_ENTRIES) {
		if (await pathExists(join(root, entry))) {
			return true;
		}
	}

	return false;
}

async function directorySource(source: string): Promise<DirectoryCorpusSource> {
	const root = resolve(source);
	if (!(await pathExists(root))) {
		throw new CorpusSourceError(
			`Corpus source ${source} is not an existing directory: a corpus source is a directory in corpus layout`,
		);
	}
	if (!(await holdsCorpusLayout(root))) {
		throw new CorpusSourceError(
			`Corpus source ${root} holds no corpus layout entry: expected one of ${CORPUS_LAYOUT_ENTRIES.join(", ")}`,
		);
	}

	return { kind: "directory", root };
}

/**
 * One corpus file or skill directory a source holds, named by where it lands in
 * corpus layout and where its bytes are read from. The snapshot copies these,
 * so nothing after it reads the source tree again.
 */
export interface CorpusLayoutEntry {
	readonly layoutPath: string;
	readonly sourcePath: string;
}

async function entriesUnder(
	directory: string,
	layoutPrefix: string,
): Promise<CorpusLayoutEntry[]> {
	const names = await readdir(directory).catch(() => []);

	return names
		.toSorted((left, right) => left.localeCompare(right))
		.map((name) => ({
			layoutPath: `${layoutPrefix}/${name}`,
			sourcePath: join(directory, name),
		}));
}

/**
 * Every corpus file a source holds, in corpus layout. A source is already in
 * corpus layout, so this reads its entries where they are and never learns what
 * produced the directory.
 */
export async function corpusLayoutEntries(
	source: ResolvedCorpusSource,
): Promise<readonly CorpusLayoutEntry[]> {
	const entries: CorpusLayoutEntry[] = [];

	for (const layoutPrefix of CORPUS_LAYOUT_DIRECTORIES) {
		entries.push(
			...(await entriesUnder(join(source.root, layoutPrefix), layoutPrefix)),
		);
	}

	const instructions = join(source.root, CORPUS_INSTRUCTIONS_PATH);
	if (await pathExists(instructions)) {
		entries.unshift({
			layoutPath: CORPUS_INSTRUCTIONS_PATH,
			sourcePath: instructions,
		});
	}

	return entries;
}

/**
 * The source string is parsed once here, at the boundary, so a caller that
 * holds a resolved source cannot be holding a directory that does not exist or
 * one that holds no corpus.
 */
export function resolveCorpusSource(
	source: string | undefined,
): Promise<ResolvedCorpusSource> {
	if (source === undefined) {
		return Promise.resolve({ kind: "live", root: liveCorpusRoot() });
	}

	return directorySource(source);
}
