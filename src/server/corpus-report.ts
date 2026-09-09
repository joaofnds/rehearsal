import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { CheckpointRecord, HashedFile } from "#benchmark/checkpoint";
import { hashDirectory, parseCheckpointRecord } from "#benchmark/checkpoint";
import type { CorpusRoot } from "#benchmark/corpus-file";
import { pathExists, SymlinkedEntryError } from "#benchmark/file-presence";
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

/**
 * The corpus is the instruction file and `CORPUS_LAYOUT_DIRECTORIES` beside
 * it. Hashing the root whole instead sweeps in whatever else lives under it,
 * which for a corpus rooted at a real `~/.claude` means caches, logs, and
 * credentials, none of which any stage reads and none of which belong in a
 * digest or on a screen.
 *
 * One unhashable entry refuses its own layout directory and no other, so the
 * caller gets the directories that hashed whole beside a refusal naming each
 * one that did not. The instruction file is hashed outside that tolerance: a
 * corpus whose CLAUDE.md is not the corpus's own bytes is one the harness
 * cannot identify, rather than a partial corpus to show.
 */
async function hashCorpusLayout(source: CorpusRoot): Promise<HashedLayout> {
	const { root } = source;
	const files: HashedFile[] = [];
	const refusals: string[] = [];

	if (await Bun.file(join(root, CORPUS_INSTRUCTIONS_PATH)).exists()) {
		const instructions = await hashCorpusFiles(source, [
			CORPUS_INSTRUCTIONS_PATH,
		]);
		files.push(...instructions.map(({ path, sha256 }) => ({ path, sha256 })));
	}

	for (const directory of CORPUS_LAYOUT_DIRECTORIES) {
		const absolute = join(root, directory);
		if (!(await pathExists(absolute))) {
			continue;
		}
		try {
			files.push(
				...(await hashDirectory(absolute, directory, {
					rootMayBeALink: source.kind === "live",
				})),
			);
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
