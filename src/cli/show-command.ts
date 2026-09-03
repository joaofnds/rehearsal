import { caseDeclarationPath, casesRoot } from "#benchmark/case";
import { parseComparisonReport } from "#benchmark/comparison-record";
import { parseConfirmationGroupRecord } from "#benchmark/confirmation-record";
import { displayPath } from "#benchmark/config";
import { unhandled } from "#benchmark/contracts";
import {
	comparisonSummary,
	groupSummary,
	parseGroupReportSummaryRecord,
	parseRunSummaryRecord,
	runSummary,
} from "#benchmark/record-summary";
import {
	benchmarkRunPaths,
	checkpointRecordFile,
	comparisonReportPaths,
	confirmationGroupPaths,
	replayRecordFile,
	sessionAttemptPaths,
} from "#benchmark/run-layout";
import { UsageError } from "#cli/commands";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import type { CommandOutput } from "#cli/output";
import type { RecordId } from "#cli/record-id";
import { parseRecordId, recordIdForms } from "#cli/record-id";

function recordFileFor(id: RecordId, runsDirectory: string): string {
	switch (id.kind) {
		case "case": {
			return caseDeclarationPath(id.caseId, casesRoot());
		}
		case "run": {
			return benchmarkRunPaths(runsDirectory, id.run).artifactFile;
		}
		case "checkpoint": {
			const paths = benchmarkRunPaths(runsDirectory, id.run);

			return checkpointRecordFile(paths.checkpointDirectory(id.stage));
		}
		case "attempt:session": {
			return sessionAttemptPaths(runsDirectory, id).recordFile;
		}
		case "attempt:stage": {
			return replayRecordFile(runsDirectory, id.lineage, id.timestamp);
		}
		case "group": {
			return confirmationGroupPaths(runsDirectory, id.groupId).groupFile;
		}
		case "comparison": {
			return comparisonReportPaths(runsDirectory, id.manifestDigest).reportFile;
		}
		default: {
			return unhandled(id, "record id kind");
		}
	}
}

/**
 * A well-formed id naming no record is a precondition the command refuses, not
 * a malformed command line: the same distinction `case show` already draws.
 * The path is named the way a session can paste it onto a card, which is what
 * the README tells one to do with this output.
 */
async function recordText(id: string, file: string): Promise<string> {
	const record = Bun.file(file);
	if (!(await record.exists())) {
		throw new RefusedPreconditionError(
			`No record ${id} at ${displayPath(file)}`,
		);
	}

	return record.text();
}

/**
 * A record whose kind has no summary prints its own bytes: the markdown exists
 * for the three records a session pastes onto a card, and inventing a summary
 * for a case declaration or a checkpoint would render less than the record it
 * replaced.
 */
async function summaryOf(
	id: RecordId,
	text: string,
	runsDirectory: string,
): Promise<string> {
	if (id.kind === "group") {
		const summary = await groupSummaryOf(id.groupId, text, runsDirectory);

		return summary;
	}
	if (id.kind === "run") {
		return runSummary(id.run, parseRunSummaryRecord(text));
	}
	if (id.kind === "comparison") {
		return comparisonSummary(id.manifestDigest, parseComparisonReport(text));
	}

	return text;
}

/**
 * The reliability half of a group's summary lives in the report it writes
 * beside its record, so a group whose record reads but whose report does not
 * is a missing report, not a missing group: saying "No record group:<id>"
 * would deny a group that is there and that `--json` prints.
 */
async function groupSummaryOf(
	groupId: string,
	text: string,
	runsDirectory: string,
): Promise<string> {
	const { reportFile } = confirmationGroupPaths(runsDirectory, groupId);
	const file = Bun.file(reportFile);
	if (!(await file.exists())) {
		throw new RefusedPreconditionError(
			`No report for group:${groupId} at ${displayPath(reportFile)}; its record reads, so --json prints it`,
		);
	}

	return groupSummary(
		parseConfirmationGroupRecord(text),
		parseGroupReportSummaryRecord(await file.text()),
	);
}

export interface ShowRequest {
	readonly id: string | undefined;
	readonly json: boolean;
	readonly runsDirectory: string;
}

export async function runShow(
	request: ShowRequest,
	output: CommandOutput,
): Promise<void> {
	if (request.id === undefined) {
		throw new UsageError(
			`Provide the record id: rehearsal show <${recordIdForms().join(" | ")}>`,
		);
	}

	const id = parseRecordId(request.id);
	const text = await recordText(
		request.id,
		recordFileFor(id, request.runsDirectory),
	);

	output.stdout(
		request.json ? text : await summaryOf(id, text, request.runsDirectory),
	);
}
