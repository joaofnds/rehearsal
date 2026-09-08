import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { CheckpointRecord, HashedFile } from "#benchmark/checkpoint";
import {
	hashDirectory,
	hashFile,
	parseCheckpointRecord,
} from "#benchmark/checkpoint";
import type { CorpusRoot } from "#benchmark/corpus-file";
import { pathExists } from "#benchmark/file-presence";
import {
	CORPUS_INSTRUCTIONS_PATH,
	CORPUS_LAYOUT_DIRECTORIES,
} from "#benchmark/corpus-file";
import { benchmarkRunPaths, checkpointRecordFile } from "#benchmark/run-layout";
import { recordedCheckpoints } from "#cli/list-command";
import { corpusDigest } from "./corpus-digest";

/**
 * `CORPUS_LAYOUT_DIRECTORIES` names what the live corpus tree holds; a stage's
 * own corpus additionally freezes `rulebook` whole (checkpoint.ts's
 * `LAYOUT_DIRECTORY_KINDS`), so a stage session can read rules a corpus-only
 * listing would otherwise leave off the screen.
 */
const CORPUS_SCREEN_DIRECTORIES: readonly string[] = [
	...CORPUS_LAYOUT_DIRECTORIES,
	"rulebook",
];

export interface CorpusFileReport {
	readonly path: string;
	readonly sha256: string;
	readonly lastEditedAt: string;
	readonly readBy: number;
}

export interface CorpusReport {
	readonly root: string;
	readonly digest: string;
	readonly files: readonly CorpusFileReport[];
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
 * The corpus is the instruction file and `CORPUS_SCREEN_DIRECTORIES` beside
 * it. Hashing the root whole instead sweeps in whatever else lives under it,
 * which for a corpus rooted at a real `~/.claude` means caches, logs, and
 * credentials, none of which any stage reads and none of which belong in a
 * digest or on a screen.
 */
async function hashCorpusLayout(root: string): Promise<HashedFile[]> {
	const files: HashedFile[] = [];

	const instructions = join(root, CORPUS_INSTRUCTIONS_PATH);
	if (await Bun.file(instructions).exists()) {
		files.push({
			path: CORPUS_INSTRUCTIONS_PATH,
			sha256: await hashFile(instructions),
		});
	}

	for (const directory of CORPUS_SCREEN_DIRECTORIES) {
		const absolute = join(root, directory);
		if (!(await pathExists(absolute))) {
			continue;
		}
		files.push(...(await hashDirectory(absolute, directory)));
	}

	return files;
}

export async function corpusReport(
	source: CorpusRoot,
	runsDirectory: string,
): Promise<CorpusReport> {
	const hashedFiles = await hashCorpusLayout(source.root);
	const readCounts = await readCountsByPath(runsDirectory);

	const files: CorpusFileReport[] = [];
	for (const file of hashedFiles) {
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
		digest: corpusDigest(hashedFiles),
		files,
	};
}
