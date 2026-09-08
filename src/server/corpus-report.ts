import { stat } from "node:fs/promises";
import { join } from "node:path";
import { hashDirectory, parseCheckpointRecord } from "#benchmark/checkpoint";
import type { CorpusRoot } from "#benchmark/corpus-file";
import { benchmarkRunPaths, checkpointRecordFile } from "#benchmark/run-layout";
import { recordedCheckpoints } from "#cli/list-command";
import { corpusDigest } from "./corpus-digest";

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
		const record = parseCheckpointRecord(await Bun.file(recordFile).text());
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

export async function corpusReport(
	source: CorpusRoot,
	runsDirectory: string,
): Promise<CorpusReport> {
	const hashedFiles = await hashDirectory(source.root, "");
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
