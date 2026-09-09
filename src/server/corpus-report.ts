import type { Stats } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { CheckpointRecord, HashedFile } from "#benchmark/checkpoint";
import { parseCheckpointRecord, walkDirectory } from "#benchmark/checkpoint";
import type { CorpusRoot } from "#benchmark/corpus-file";
import {
	lstatIfPresent,
	pathExists,
	statIfExists,
	SymlinkedEntryError,
} from "#benchmark/file-presence";
import {
	CORPUS_INSTRUCTIONS_PATH,
	CORPUS_LAYOUT_DIRECTORIES,
	hashCorpusFiles,
} from "#benchmark/corpus-file";
import { benchmarkRunPaths, checkpointRecordFile } from "#benchmark/run-layout";
import { recordedCheckpoints } from "#cli/list-command";
import { corpusDigest } from "./corpus-digest";
import { redactAbsolutePaths } from "./redact-path";

export interface CorpusFileReport {
	readonly path: string;
	readonly sha256: string;
	readonly lastEditedAt: string;
	readonly readBy: number;
}

export interface CorpusReport {
	readonly root: string;
	readonly digest: string | undefined;
	readonly files: readonly CorpusFileReport[];
	readonly refusals: readonly string[];
}

interface HashedLayout {
	readonly files: readonly HashedFile[];
	readonly refusals: readonly string[];
}

async function readCountsByPath(
	runsDirectory: string,
): Promise<ReadonlyMap<string, number>> {
	const runsByPath = new Map<string, Set<string>>();

	for (const { run, stage } of await recordedCheckpoints(runsDirectory)) {
		const paths = benchmarkRunPaths(runsDirectory, run);
		const recordFile = checkpointRecordFile(paths.checkpointDirectory(stage));
		let record: CheckpointRecord;
		try {
			record = parseCheckpointRecord(await Bun.file(recordFile).text());
		} catch {
			continue;
		}

		for (const file of record.corpusFiles) {
			const runs = runsByPath.get(file.path) ?? new Set<string>();
			runs.add(run);
			runsByPath.set(file.path, runs);
		}
	}

	return new Map(
		[...runsByPath.entries()].map(([path, runs]) => [path, runs.size]),
	);
}

async function resolvedStat(path: string): Promise<Stats | undefined> {
	try {
		return await statIfExists(path);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ELOOP") {
			return undefined;
		}

		throw error;
	}
}

/**
 * A corpus root with no CLAUDE.md is valid, so absence is not a refusal. A
 * CLAUDE.md that is present but cannot yield instruction bytes is: reading
 * either as absence would report the corpus as one that has no instruction
 * file, under a digest that says so confidently.
 *
 * A link that does not resolve is refused whether its target is missing or
 * its chain loops, since neither names bytes to hash and both otherwise
 * reach the screen as a failure that names no file.
 */
async function refuseUnhashableInstructions(
	root: string,
): Promise<string | undefined> {
	const path = join(root, CORPUS_INSTRUCTIONS_PATH);
	if (!(await lstatIfPresent(path))) {
		return undefined;
	}

	const target = await resolvedStat(path);
	if (target === undefined) {
		return `Corpus file ${CORPUS_INSTRUCTIONS_PATH} is a link whose target is missing, so the bytes it names cannot be read`;
	}

	if (target.isDirectory()) {
		return `Corpus file ${CORPUS_INSTRUCTIONS_PATH} is a directory, so it holds no instruction bytes to hash`;
	}

	return undefined;
}

/**
 * The corpus is the instruction file and `CORPUS_LAYOUT_DIRECTORIES` beside
 * it. Hashing the root whole instead sweeps in whatever else lives under it,
 * which for a corpus rooted at a real `~/.claude` means caches, logs, and
 * credentials, none of which any stage reads and none of which belong in a
 * digest or on a screen.
 *
 * One unhashable entry refuses its own layout directory and no other, so the
 * caller gets the directories that hashed whole beside a refusal naming each
 * one that did not. The instruction file is inside that tolerance: this report
 * is what the corpus screen renders, and a refusal naming CLAUDE.md tells the
 * operator which file broke the corpus, where a thrown error reaches the
 * screen as "Could not load the corpus." and names nothing. The digest is
 * withheld either way, so an unidentifiable corpus is never served as an
 * identified one.
 */
async function hashCorpusLayout(source: CorpusRoot): Promise<HashedLayout> {
	const { root } = source;
	const files: HashedFile[] = [];
	const refusals: string[] = [];

	const instructionsRefusal = await refuseUnhashableInstructions(root);
	if (instructionsRefusal !== undefined) {
		refusals.push(instructionsRefusal);
	} else if (await lstatIfPresent(join(root, CORPUS_INSTRUCTIONS_PATH))) {
		try {
			const instructions = await hashCorpusFiles(source, [
				CORPUS_INSTRUCTIONS_PATH,
			]);
			files.push(...instructions.map(({ path, sha256 }) => ({ path, sha256 })));
		} catch (error) {
			if (!(error instanceof SymlinkedEntryError)) {
				throw error;
			}
			refusals.push(redactAbsolutePaths(error.message));
		}
	}

	for (const directory of CORPUS_LAYOUT_DIRECTORIES) {
		const absolute = join(root, directory);
		if (!(await pathExists(absolute))) {
			continue;
		}
		try {
			const walked = await walkDirectory(absolute, directory, {
				rootMayBeALink: source.kind === "live",
			});
			if (walked.refusals.length > 0) {
				refusals.push(
					...walked.refusals.map(({ message }) => redactAbsolutePaths(message)),
				);
				continue;
			}

			files.push(...walked.files);
		} catch (error) {
			if (!(error instanceof SymlinkedEntryError)) {
				throw error;
			}
			refusals.push(redactAbsolutePaths(error.message));
		}
	}

	return { files, refusals };
}

export async function corpusReport(
	source: CorpusRoot,
	runsDirectory: string,
): Promise<CorpusReport> {
	const layout = await hashCorpusLayout(source);
	const readCounts = await readCountsByPath(runsDirectory);

	const files: CorpusFileReport[] = [];
	for (const file of layout.files) {
		const fileStats = await stat(join(source.root, file.path));
		files.push({
			path: file.path,
			sha256: file.sha256,
			lastEditedAt: fileStats.mtime.toISOString(),
			readBy: readCounts.get(file.path) ?? 0,
		});
	}

	return {
		root: source.root,
		digest: layout.refusals.length > 0 ? undefined : corpusDigest(layout.files),
		files,
		refusals: layout.refusals,
	};
}
