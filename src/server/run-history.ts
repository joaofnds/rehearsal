import { readCheckpointRecord } from "#benchmark/checkpoint";
import type { CorpusRoot } from "#benchmark/corpus-file";
import { loadRunManifest } from "#benchmark/manifest";
import {
	benchmarkRunPaths,
	checkpointStageNames,
	recordedRunNames,
	runEventsDatabaseFile,
} from "#benchmark/run-layout";
import type { RunEventStore } from "#benchmark/run-events";
import { openRunEventStore } from "#benchmark/run-events";
import { parseRunSummaryRecord } from "#benchmark/record-summary";
import { stoppedStage } from "#benchmark/run-outcome";
import { staleCheckpoints } from "#benchmark/staleness-report";
import { corpusDigest } from "./corpus-digest";
import { redactAbsolutePaths } from "./redact-path";

/**
 * One run-history row, in decision-5's code vocabulary (`run`, `caseId`,
 * `stage`), never the design's task/step labels. This is the single place
 * that owns the read API's response shape for a run-history row: no other
 * card owns it.
 */
export interface RunHistoryRow {
	readonly run: string;
	readonly caseId: string;
	readonly status: string;
	readonly stage: string | undefined;
	readonly grade: string | undefined;
	readonly corpus: { readonly digest: string } | undefined;
	readonly stale: boolean;
	readonly staleCauses: readonly string[];
}

/**
 * The last checkpoint a run recorded, in pipeline order rather than
 * alphabetical: `checkpointStageNames` sorts by name, which is not the order
 * stages run in, so "latest" is read off the manifest's own stage sequence
 * intersected with what the run actually recorded.
 */
async function latestCheckpointStage(
	runsDirectory: string,
	run: string,
): Promise<string | undefined> {
	const paths = benchmarkRunPaths(runsDirectory, run);
	const manifestFile = Bun.file(paths.manifestFile);
	if (!(await manifestFile.exists())) {
		return undefined;
	}

	const manifest = await loadRunManifest(paths.manifestFile);
	const recorded = new Set(await checkpointStageNames(runsDirectory, run));
	const ordered = manifest.pipeline.stages
		.map(({ name }) => name)
		.filter((name) => recorded.has(name));

	return ordered.at(-1);
}

interface RunIdentity {
	readonly status: string;
	readonly caseId: string;
	readonly gradeByStage: ReadonlyMap<string, string>;
}

async function statusAndCaseId(
	runsDirectory: string,
	run: string,
	runEvents: RunEventStore,
): Promise<RunIdentity | undefined> {
	const paths = benchmarkRunPaths(runsDirectory, run);
	if (await Bun.file(paths.artifactFile).exists()) {
		const record = parseRunSummaryRecord(
			await Bun.file(paths.artifactFile).text(),
		);

		return {
			status: record.status,
			caseId: record.caseId,
			gradeByStage: new Map(
				record.stageScorecards.map((scorecard) => [
					scorecard.stage,
					scorecard.grade.grade,
				]),
			),
		};
	}

	const stopped = await stoppedStage(runsDirectory, run);
	if (stopped !== undefined) {
		if (!(await Bun.file(paths.manifestFile).exists())) {
			throw new Error(`incomplete: no manifest.json at ${paths.manifestFile}`);
		}

		const manifest = await loadRunManifest(paths.manifestFile);

		return {
			status: `STOPPED:${stopped.stage}`,
			caseId: manifest.caseId,
			gradeByStage: new Map(),
		};
	}

	/**
	 * A kill -9 leaves no artifact and no STAGE_JUDGE_FAILED file: nothing
	 * runs to write one. The reconciliation pass is the only thing that ever
	 * marks such a run, in the event stream rather than on disk, so this is
	 * the one status this reader derives from SQLite instead of a file.
	 */
	if (runEvents.latestEvent(run)?.kind === "run-interrupted") {
		if (!(await Bun.file(paths.manifestFile).exists())) {
			throw new Error(`incomplete: no manifest.json at ${paths.manifestFile}`);
		}

		const manifest = await loadRunManifest(paths.manifestFile);

		return {
			status: "INTERRUPTED",
			caseId: manifest.caseId,
			gradeByStage: new Map(),
		};
	}

	return undefined;
}

async function rowFor(
	runsDirectory: string,
	run: string,
	staleByCheckpointId: ReadonlyMap<string, readonly string[]>,
	runEvents: RunEventStore,
): Promise<RunHistoryRow | undefined> {
	const identity = await statusAndCaseId(runsDirectory, run, runEvents);
	if (identity === undefined) {
		return undefined;
	}

	const { status, caseId, gradeByStage } = identity;
	const stage = await latestCheckpointStage(runsDirectory, run);
	if (stage === undefined) {
		return {
			run,
			status,
			caseId,
			stage: undefined,
			grade: undefined,
			corpus: undefined,
			stale: false,
			staleCauses: [],
		};
	}

	const paths = benchmarkRunPaths(runsDirectory, run);
	const checkpoint = await readCheckpointRecord(
		paths.checkpointDirectory(stage),
	);
	const causes = staleByCheckpointId.get(`checkpoint:${run}/${stage}`) ?? [];

	return {
		run,
		status,
		caseId,
		stage,
		grade: gradeByStage.get(stage),
		corpus: { digest: corpusDigest(checkpoint.corpusFiles) },
		stale: causes.length > 0,
		staleCauses: causes,
	};
}

export interface UnreadableRun {
	readonly id: string;
	readonly reason: string;
}

export interface RunHistoryReport {
	readonly rows: readonly RunHistoryRow[];
	readonly unreadable: readonly UnreadableRun[];
}

/**
 * Every recorded run rendered as a run-history row, staleness recomputed
 * against `source` on every call rather than cached: a stale badge that is
 * silently wrong is worse than the cost of hashing the corpus.
 *
 * One run's failure to read, a malformed artifact, a missing manifest, a
 * corpus file `staleCheckpoints` cannot resolve, is collected rather than
 * thrown: the `list runs` precedent (`src/cli/list-command.ts`'s `collect`)
 * is what this follows, so a single bad run cannot blank the whole response
 * the way an uncaught throw would. The reason is redacted the same way,
 * since a filesystem error can name a path under the corpus root or the
 * target repository, neither of which lives under `CONTROL_DIR`.
 */
export async function runHistoryReport(
	runsDirectory: string,
	source: CorpusRoot,
): Promise<RunHistoryReport> {
	const stale = await staleCheckpoints(runsDirectory, source);
	const staleByCheckpointId = new Map(
		stale.map((record) => [record.id, record.causes]),
	);

	const runEvents = await openRunEventStore(
		runEventsDatabaseFile(runsDirectory),
	);
	try {
		const rows: RunHistoryRow[] = [];
		const unreadable: UnreadableRun[] = [];
		for (const run of await recordedRunNames(runsDirectory)) {
			try {
				const row = await rowFor(
					runsDirectory,
					run,
					staleByCheckpointId,
					runEvents,
				);
				if (row !== undefined) {
					rows.push(row);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				unreadable.push({
					id: `run:${run}`,
					reason: redactAbsolutePaths(message),
				});
			}
		}

		return { rows, unreadable };
	} finally {
		runEvents.close();
	}
}
