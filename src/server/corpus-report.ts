import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { CheckpointRecord, HashedFile } from "#benchmark/checkpoint";
import { parseCheckpointRecord, walkDirectory } from "#benchmark/checkpoint";
import type { CorpusRoot } from "#benchmark/corpus-file";
import {
	classifyEntry,
	refusedEntryReason,
	SymlinkedEntryError,
} from "#benchmark/file-presence";
import {
	CORPUS_INSTRUCTIONS_PATH,
	CORPUS_LAYOUT_DIRECTORIES,
	corpusFileRefusal,
	corpusInstructionsEntry,
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

	const instructions = await corpusInstructionsEntry(source);
	if (instructions.kind === "refused") {
		refusals.push(redactAbsolutePaths(instructions.refusal));
	} else if (instructions.kind === "present") {
		try {
			const hashed = await hashCorpusFiles(source, [CORPUS_INSTRUCTIONS_PATH]);
			files.push(...hashed.map(({ path, sha256 }) => ({ path, sha256 })));
		} catch (error) {
			/**
			 * The entry classified as a regular file inside the corpus, so what
			 * is left to fail is the open itself, which reports a hostile entry
			 * on filesystems where the `stat` pair did not.
			 */
			const reason =
				error instanceof Error
					? refusedEntryReason(error, instructions.path)
					: undefined;
			if (reason !== undefined) {
				refusals.push(corpusFileRefusal(CORPUS_INSTRUCTIONS_PATH, reason));
			} else if (error instanceof SymlinkedEntryError) {
				refusals.push(redactAbsolutePaths(error.message));
			} else {
				throw error;
			}
		}
	}

	for (const directory of CORPUS_LAYOUT_DIRECTORIES) {
		const absolute = join(root, directory);
		const entry = await classifyEntry(absolute);
		if (entry.kind === "absent") {
			continue;
		}
		if (entry.kind === "refused") {
			refusals.push(`${directory} ${entry.reason}`);
			continue;
		}
		if (entry.kind !== "directory") {
			refusals.push(
				`${directory} is not a directory, so it cannot contain corpus files to hash`,
			);
			continue;
		}

		try {
			const walked = await walkDirectory(absolute, directory, {
				source,
			});
			if (walked.refusals.length > 0) {
				refusals.push(
					...walked.refusals.map(({ message }) => redactAbsolutePaths(message)),
				);
				continue;
			}

			files.push(...walked.files);
		} catch (error) {
			const reason =
				error instanceof Error
					? refusedEntryReason(error, absolute)
					: undefined;
			if (reason !== undefined) {
				refusals.push(`${directory} ${reason}`);
			} else if (error instanceof SymlinkedEntryError) {
				refusals.push(redactAbsolutePaths(error.message));
			} else {
				throw error;
			}
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
