import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { CaseDeclaration, SessionCaseDeclaration } from "./case";
import { listCases } from "./case";
import type { CheckpointRecord, HashedFile } from "./checkpoint";
import {
	captureStageCorpus,
	corpusDifferences,
	deriveStaleness,
	INITIAL_CHECKPOINT_STAGE,
	parseCheckpointRecord,
} from "./checkpoint";
import type { Effort } from "./config";
import type { CorpusRoot } from "./corpus-file";
import {
	CorpusFileError,
	hashCorpusFiles,
	resolveCorpusFile,
} from "./corpus-file";
import { loadRunManifest } from "./manifest";
import type { RunManifest } from "./manifest";
import {
	benchmarkRunPaths,
	checkpointRecordFile,
	recordedRunNames,
	sessionAttemptIds,
	sessionAttemptPaths,
} from "./run-layout";
import { parseSessionAttemptRecord } from "./session-record";

/**
 * One record an edit invalidated, named by the id `show` accepts back and by
 * every reason it went stale. A caller prints these; nothing here formats.
 */
export interface StaleRecord {
	readonly id: string;
	readonly causes: readonly string[];
}

/**
 * A record the report could not read, named by the id `show` accepts back and
 * by the reason. One half-written attempt must not hide every other answer, so
 * it is collected here rather than thrown: the `case list` precedent, which
 * `list` already follows for every kind it reads.
 */
export interface UnreadableStaleRecord {
	readonly id: string;
	readonly reason: string;
}

export interface StalenessReport {
	readonly records: readonly StaleRecord[];
	readonly unreadable: readonly UnreadableStaleRecord[];
}

/**
 * The model and effort the session is about to replay with, which is what a
 * recorded checkpoint is compared against. Comparing a checkpoint to the
 * manifest that produced it answers the question tautologically, so a knob the
 * caller did not name asserts nothing: the run's own value stands in and that
 * half of the comparison stays silent, while a named one reports exactly what
 * `replay` would report for the same flags.
 */
export interface CurrentSessionKnobs {
	readonly model?: string | undefined;
	readonly effort?: Effort | undefined;
}

/**
 * Staleness needs the corpus hashed, never installed, so `stale` needs no
 * worktree, no git, and no session: `captureStageCorpus` reads the roots it is
 * given and nothing else. The skills of a resolved corpus source live under
 * its root; its CLAUDE.md is wherever the corpus-file resolver says, because
 * the live install's instructions are the control root's, not `~/.claude`'s.
 */
function skillRootsOf(source: CorpusRoot): readonly string[] {
	return [join(source.root, "skills")];
}

async function currentStageCorpus(
	manifest: RunManifest,
	chain: readonly CheckpointRecord[],
	source: CorpusRoot,
	instructions: string,
): Promise<ReadonlyMap<string, readonly HashedFile[]>> {
	const corpus = new Map<string, readonly HashedFile[]>();
	const roots = skillRootsOf(source);

	for (const record of chain) {
		if (record.stage === INITIAL_CHECKPOINT_STAGE) {
			continue;
		}

		const definition = manifest.pipeline.stages.find(
			({ name }) => name === record.stage,
		);
		if (definition === undefined) {
			continue;
		}

		corpus.set(
			record.stage,
			await captureStageCorpus(definition.skill, instructions, roots),
		);
	}

	return corpus;
}

async function checkpointChain(
	runsDirectory: string,
	run: string,
	stages: readonly string[],
): Promise<readonly CheckpointRecord[]> {
	const paths = benchmarkRunPaths(runsDirectory, run);
	const chain: CheckpointRecord[] = [];

	for (const stage of stages) {
		const file = Bun.file(
			checkpointRecordFile(paths.checkpointDirectory(stage)),
		);
		if (await file.exists()) {
			chain.push(parseCheckpointRecord(await file.text()));
		}
	}

	return chain;
}

/**
 * A corpus needs a CLAUDE.md only to answer for a checkpoint, and
 * `resolveCorpusSource` accepts a directory holding any one corpus kind, so a
 * corpus of styles alone is valid. Reading it lazily lets the case half answer
 * for such a corpus, and the failure arrives in the caller's terms rather than
 * as a raw ENOENT.
 */
async function projectInstructions(source: CorpusRoot): Promise<string> {
	const path = resolveCorpusFile(source, "CLAUDE.md");
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new CorpusFileError(
			`Corpus file CLAUDE.md does not exist at ${path}`,
		);
	}

	return file.text();
}

/**
 * Every checkpoint of every recorded run whose recorded inputs no longer match
 * the corpus under test. A run whose manifest cannot be read contributes
 * nothing rather than failing the report: it was never replayable, so nothing
 * about it can go stale.
 */
export async function staleCheckpoints(
	runsDirectory: string,
	source: CorpusRoot,
	knobs: CurrentSessionKnobs = {},
): Promise<readonly StaleRecord[]> {
	const stale: StaleRecord[] = [];

	for (const run of await recordedRunNames(runsDirectory)) {
		const paths = benchmarkRunPaths(runsDirectory, run);
		const manifestFile = Bun.file(paths.manifestFile);
		if (!(await manifestFile.exists())) {
			continue;
		}

		const manifest = await loadRunManifest(paths.manifestFile);
		const instructions = await projectInstructions(source);
		const chain = await checkpointChain(
			runsDirectory,
			run,
			manifest.pipeline.stages.map(({ name }) => name),
		);
		const current = await currentStageCorpus(
			manifest,
			chain,
			source,
			instructions,
		);

		for (const staleness of deriveStaleness(chain, current, {
			model: knobs.model ?? manifest.model,
			effort: knobs.effort ?? manifest.effort,
		})) {
			if (staleness.stale) {
				stale.push({
					id: `checkpoint:${run}/${staleness.stage}`,
					causes: staleness.causes,
				});
			}
		}
	}

	return stale;
}

const CASE_STALENESS_WORDING = {
	modified: (path: string) => `${path} changed`,
	missingFromRight: (path: string) => `${path} removed`,
	missingFromLeft: (path: string) => `${path} added`,
};

interface LatestAttempt {
	readonly recorded: readonly HashedFile[] | undefined;
	readonly unreadable: readonly UnreadableStaleRecord[];
}

/**
 * The most recent attempt whose record parses, with every record that did not
 * named beside it. A record read fails on the whole file, so an unreadable one
 * cannot be the answer for its case; taking the newest readable record keeps
 * the case's answer available while the reader still hears about the file that
 * was lost.
 */
async function latestAttemptRecord(
	runsDirectory: string,
	caseId: string,
): Promise<LatestAttempt> {
	const everyAttempt = await sessionAttemptIds(runsDirectory);
	const attempts = everyAttempt.filter(
		(candidate) => candidate.caseId === caseId,
	);
	const unreadable: UnreadableStaleRecord[] = [];
	let latest:
		| { readonly at: number; readonly record: readonly HashedFile[] }
		| undefined;

	for (const attempt of attempts) {
		const { recordFile: file } = sessionAttemptPaths(runsDirectory, attempt);
		const stats = await stat(file).catch(() => undefined);
		if (stats === undefined) {
			continue;
		}

		try {
			const record = parseSessionAttemptRecord(await Bun.file(file).text());
			if (latest === undefined || stats.mtimeMs > latest.at) {
				latest = {
					at: stats.mtimeMs,
					record: record.corpusFiles.map(({ path, sha256 }) => ({
						path,
						sha256,
					})),
				};
			}
		} catch (error) {
			unreadable.push({
				id: `attempt:session:${caseId}/${attempt.uuid}`,
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return { recorded: latest?.record, unreadable };
}

function sessionCases(
	declarations: readonly CaseDeclaration[],
): readonly SessionCaseDeclaration[] {
	return declarations.filter(
		(declaration): declaration is SessionCaseDeclaration =>
			declaration.kind === "session",
	);
}

/**
 * A declared corpus file the corpus under test no longer holds invalidates the
 * measurement as surely as an edit does — the case cannot even run against
 * this corpus — so it is a cause rather than a failure that hides every other
 * case's answer.
 */
async function caseStaleness(
	declaration: SessionCaseDeclaration,
	recorded: readonly HashedFile[],
	source: CorpusRoot,
): Promise<readonly string[]> {
	try {
		const current = await hashCorpusFiles(source, declaration.corpusFiles);

		return corpusDifferences(
			recorded,
			current.map(({ path, sha256 }) => ({ path, sha256 })),
			CASE_STALENESS_WORDING,
		);
	} catch (error) {
		if (error instanceof CorpusFileError) {
			return [error.message];
		}

		throw error;
	}
}

/**
 * A session case is stale when its most recent attempt recorded corpus digests
 * the corpus no longer matches. A case with no attempt is not stale: staleness
 * claims a prior measurement no longer describes the corpus, and with no
 * measurement there is nothing to invalidate.
 */
export async function staleCases(
	runsDirectory: string,
	source: CorpusRoot,
): Promise<StalenessReport> {
	const listing = await listCases();
	const records: StaleRecord[] = [];
	const unreadable: UnreadableStaleRecord[] = [];

	for (const declaration of sessionCases(listing.declarations)) {
		const latest = await latestAttemptRecord(runsDirectory, declaration.id);
		unreadable.push(...latest.unreadable);
		if (latest.recorded === undefined) {
			continue;
		}

		const causes = await caseStaleness(declaration, latest.recorded, source);
		if (causes.length > 0) {
			records.push({ id: `case:${declaration.id}`, causes });
		}
	}

	return { records, unreadable };
}
