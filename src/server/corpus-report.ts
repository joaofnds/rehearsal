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

const UNHASHABLE_INSTRUCTION_CODES = new Map([
	["ELOOP", "is a link that never resolves to a file, so it names no bytes"],
	["EACCES", "cannot be read, so its bytes cannot be hashed"],
	["EPERM", "cannot be read, so its bytes cannot be hashed"],
]);

function refusalForCode(code: string): string | undefined {
	const reason = UNHASHABLE_INSTRUCTION_CODES.get(code);

	return reason === undefined
		? undefined
		: `Corpus file ${CORPUS_INSTRUCTIONS_PATH} ${reason}`;
}

interface InstructionsEntry {
	readonly present: boolean;
	readonly refusal: string | undefined;
}

/**
 * A corpus root with no CLAUDE.md is valid, so absence is not a refusal. A
 * CLAUDE.md that is present but cannot yield instruction bytes is: reading
 * either as absence would report the corpus as one that has no instruction
 * file, under a digest that says so confidently.
 *
 * What this decides is what the entry *is*: absent, or present as something
 * that cannot hold instruction bytes. Only a regular file can, so a missing
 * link target, a link chain that never resolves, a directory, a device, and a
 * pipe are each refused here by name. Whether the bytes can actually be read,
 * and whether the path stays inside the corpus, are answered by the hash
 * itself, so those two refusals are made at the call site below.
 *
 * The device and the pipe are why this runs before the hash rather than
 * leaving every failure to the catch there. `hashCorpusFiles` reports a device
 * as a file that does not exist, which is false and sends the reader looking
 * for a file that is there. A pipe with no writer blocks its read forever, so
 * the request never returns at all and the screen waits instead of failing.
 */
async function readInstructionsEntry(root: string): Promise<InstructionsEntry> {
	const path = join(root, CORPUS_INSTRUCTIONS_PATH);
	let target: Stats | undefined;
	try {
		if (!(await lstatIfPresent(path))) {
			return { present: false, refusal: undefined };
		}

		target = await statIfExists(path);
	} catch (error) {
		const refusal =
			error instanceof Error && "code" in error
				? refusalForCode(String(error.code))
				: undefined;
		if (refusal === undefined) {
			throw error;
		}

		return { present: true, refusal };
	}

	if (target === undefined) {
		return {
			present: true,
			refusal: `Corpus file ${CORPUS_INSTRUCTIONS_PATH} is a link whose target is missing, so the bytes it names cannot be read`,
		};
	}

	if (target.isDirectory()) {
		return {
			present: true,
			refusal: `Corpus file ${CORPUS_INSTRUCTIONS_PATH} is a directory, so it holds no instruction bytes to hash`,
		};
	}

	if (!target.isFile()) {
		return {
			present: true,
			refusal: `Corpus file ${CORPUS_INSTRUCTIONS_PATH} is not a regular file, so it holds no instruction bytes to hash`,
		};
	}

	return { present: true, refusal: undefined };
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

	const instructions = await readInstructionsEntry(root);
	if (instructions.refusal !== undefined) {
		refusals.push(instructions.refusal);
	} else if (instructions.present) {
		try {
			const hashed = await hashCorpusFiles(source, [CORPUS_INSTRUCTIONS_PATH]);
			files.push(...hashed.map(({ path, sha256 }) => ({ path, sha256 })));
		} catch (error) {
			const unreadable =
				error instanceof Error && "code" in error
					? refusalForCode(String(error.code))
					: undefined;
			if (unreadable !== undefined) {
				refusals.push(unreadable);
			} else if (error instanceof SymlinkedEntryError) {
				refusals.push(redactAbsolutePaths(error.message));
			} else {
				throw error;
			}
		}
	}

	for (const directory of CORPUS_LAYOUT_DIRECTORIES) {
		const absolute = join(root, directory);
		if (!(await pathExists(absolute))) {
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
