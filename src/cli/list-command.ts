import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { listCases } from "#benchmark/case";
import { parseCheckpointRecord } from "#benchmark/checkpoint";
import { unhandled } from "#benchmark/contracts";
import { parseComparisonReport } from "#benchmark/comparison-record";
import { parseConfirmationGroupRecord } from "#benchmark/confirmation-record";
import { parseRunSummaryRecord } from "#benchmark/record-summary";
import { readReplayRecord } from "#benchmark/replay";
import {
	benchmarkRunPaths,
	comparisonDigests,
	comparisonReportPaths,
	confirmationGroupIds,
	confirmationGroupPaths,
	recordedRunNames,
	replayAttemptIds,
	replayRecordFile,
	sessionAttemptIds,
} from "#benchmark/run-layout";
import { parseSessionAttemptRecord } from "#benchmark/session-record";
import { UsageError } from "#cli/commands";
import type { CommandOutput } from "#cli/output";
import type { RecordId } from "#cli/record-id";
import { formatRecordId } from "#cli/record-id";

const ATTEMPT_FILE = "attempt.json";

export const LIST_KINDS = [
	"cases",
	"runs",
	"checkpoints",
	"attempts",
	"groups",
	"comparisons",
] as const;

export type ListKind = (typeof LIST_KINDS)[number];

export interface ListedRecord {
	readonly id: string;
	readonly fields: readonly string[];
}

export interface UnreadableRecord {
	readonly id: string;
	readonly reason: string;
}

export interface RecordListing {
	readonly entries: readonly ListedRecord[];
	readonly unreadable: readonly UnreadableRecord[];
}

function parseListKind(kind: string | undefined): ListKind {
	const found = LIST_KINDS.find((candidate) => candidate === kind);
	if (found === undefined) {
		throw new UsageError(
			`List kind ${kind ?? "(none)"} is not one of ${LIST_KINDS.join(", ")}`,
		);
	}

	return found;
}

/**
 * One unreadable record must not hide the valid ones: a half-written group or
 * an attempt directory whose run died before it wrote anything is reported by
 * id and reason while every record that parses still prints. This is the
 * `case list` precedent, and it is why each listing collects rather than
 * throws.
 */
async function collect<Named>(
	named: readonly Named[],
	idOf: (name: Named) => RecordId,
	read: (name: Named) => Promise<readonly string[]>,
): Promise<RecordListing> {
	const entries: ListedRecord[] = [];
	const unreadable: UnreadableRecord[] = [];

	for (const name of named) {
		const id = formatRecordId(idOf(name));
		try {
			entries.push({ id, fields: await read(name) });
		} catch (error) {
			unreadable.push({
				id,
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return { entries, unreadable };
}

async function listDeclaredCases(): Promise<RecordListing> {
	const listing = await listCases();

	return {
		entries: listing.declarations.map((declaration) => ({
			id: formatRecordId({ kind: "case", caseId: declaration.id }),
			fields: [declaration.title],
		})),
		unreadable: listing.unreadable.map(({ id, reason }) => ({
			id: formatRecordId({ kind: "case", caseId: id }),
			reason,
		})),
	};
}

async function listRuns(runsDirectory: string): Promise<RecordListing> {
	const names = await recordedRunNames(runsDirectory);

	return collect(
		names,
		(run) => ({ kind: "run", run }),
		async (run) => {
			const paths = benchmarkRunPaths(runsDirectory, run);
			const record = parseRunSummaryRecord(
				await Bun.file(paths.artifactFile).text(),
			);
			const replayable = await Bun.file(paths.manifestFile).exists();

			return [
				record.caseId,
				record.status,
				replayable ? "replayable" : "not replayable",
			];
		},
	);
}

interface RunCheckpoint {
	readonly run: string;
	readonly stage: string;
}

async function recordedCheckpoints(
	runsDirectory: string,
): Promise<readonly RunCheckpoint[]> {
	const checkpoints: RunCheckpoint[] = [];

	for (const run of await recordedRunNames(runsDirectory)) {
		const paths = benchmarkRunPaths(runsDirectory, run);
		const stages = await stageDirectories(paths.checkpointsDirectory);
		checkpoints.push(...stages.map((stage) => ({ run, stage })));
	}

	return checkpoints;
}

async function stageDirectories(
	checkpointsDirectory: string,
): Promise<readonly string[]> {
	const entries = await readdir(checkpointsDirectory, {
		withFileTypes: true,
	}).catch(() => []);

	return entries
		.filter((entry) => entry.isDirectory())
		.map(({ name }) => name)
		.toSorted((left, right) => (left < right ? -1 : 1));
}

async function listCheckpoints(runsDirectory: string): Promise<RecordListing> {
	const checkpoints = await recordedCheckpoints(runsDirectory);

	return collect(
		checkpoints,
		({ run, stage }) => ({ kind: "checkpoint", run, stage }),
		async ({ run, stage }) => {
			const paths = benchmarkRunPaths(runsDirectory, run);
			const record = parseCheckpointRecord(
				await Bun.file(
					join(paths.checkpointDirectory(stage), "checkpoint.json"),
				).text(),
			);

			return [record.stage, record.lineage];
		},
	);
}

async function listGroups(runsDirectory: string): Promise<RecordListing> {
	const groupIds = await confirmationGroupIds(runsDirectory);

	return collect(
		groupIds,
		(groupId) => ({ kind: "group", groupId }),
		async (groupId) => {
			const paths = confirmationGroupPaths(runsDirectory, groupId);
			const record = parseConfirmationGroupRecord(
				await Bun.file(paths.groupFile).text(),
			);

			return [record.caseId, record.mode, `${String(record.reps)} reps`];
		},
	);
}

async function listComparisons(runsDirectory: string): Promise<RecordListing> {
	const digests = await comparisonDigests(runsDirectory);

	return collect(
		digests,
		(manifestDigest) => ({ kind: "comparison", manifestDigest }),
		async (manifestDigest) => {
			const paths = comparisonReportPaths(runsDirectory, manifestDigest);
			const report = parseComparisonReport(
				await Bun.file(paths.reportFile).text(),
			);

			return [
				`${String(report.cases.length)} cases`,
				`${String(report.reps)} reps`,
			];
		},
	);
}

/**
 * Both kinds the glossary's Attempt entry names: one session of a session case,
 * and one stage replayed from a checkpoint. They are one listing because a
 * session choosing what to re-run wants every prior measurement, and the id's
 * kind is what keeps the two apart.
 */
async function listAttempts(runsDirectory: string): Promise<RecordListing> {
	const sessions = await collect(
		await sessionAttemptIds(runsDirectory),
		({ caseId, uuid }) => ({ kind: "attempt:session", caseId, uuid }),
		async ({ caseId, uuid }) => {
			const record = parseSessionAttemptRecord(
				await Bun.file(
					join(runsDirectory, "sessions", caseId, uuid, ATTEMPT_FILE),
				).text(),
			);

			return [record.caseId, record.outcome, record.model];
		},
	);
	const replays = await collect(
		await replayAttemptIds(runsDirectory),
		({ lineage, timestamp }) => ({ kind: "attempt:stage", lineage, timestamp }),
		async ({ lineage, timestamp }) => {
			const record = await readReplayRecord(
				replayRecordFile(runsDirectory, lineage, timestamp),
			);

			return [
				record.stage,
				`${record.scorecard.grade.grade} ${record.scorecard.grade.verdict}`,
				record.model,
			];
		},
	);

	return {
		entries: [...sessions.entries, ...replays.entries],
		unreadable: [...sessions.unreadable, ...replays.unreadable],
	};
}

export function listRecords(
	kind: ListKind,
	runsDirectory: string,
): Promise<RecordListing> {
	switch (kind) {
		case "cases": {
			return listDeclaredCases();
		}
		case "runs": {
			return listRuns(runsDirectory);
		}
		case "checkpoints": {
			return listCheckpoints(runsDirectory);
		}
		case "attempts": {
			return listAttempts(runsDirectory);
		}
		case "groups": {
			return listGroups(runsDirectory);
		}
		case "comparisons": {
			return listComparisons(runsDirectory);
		}
		default: {
			return unhandled(kind, "list kind");
		}
	}
}

export interface ListRequest {
	readonly kind: string | undefined;
	readonly runsDirectory: string;
}

export async function runList(
	request: ListRequest,
	output: CommandOutput,
): Promise<void> {
	const listing = await listRecords(
		parseListKind(request.kind),
		request.runsDirectory,
	);

	for (const { id, reason } of listing.unreadable) {
		output.stderr(`${id}: ${reason}\n`);
	}
	for (const { id, fields } of listing.entries) {
		output.stdout(`${[id, ...fields].join("\t")}\n`);
	}
}
