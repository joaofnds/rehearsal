import { join } from "node:path";
import { caseDeclarationPath, casesRoot } from "#benchmark/case";
import { parseComparisonReport } from "#benchmark/comparison-record";
import { parseConfirmationGroupRecord } from "#benchmark/confirmation-record";
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
	comparisonReportPaths,
	confirmationGroupPaths,
	replayRecordFile,
} from "#benchmark/run-layout";
import { UsageError } from "#cli/commands";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import type { CommandOutput } from "#cli/output";
import type { RecordId } from "#cli/record-id";
import { parseRecordId, recordIdForms } from "#cli/record-id";

const CHECKPOINT_FILE = "checkpoint.json";
const ATTEMPT_FILE = "attempt.json";

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

			return join(paths.checkpointDirectory(id.stage), CHECKPOINT_FILE);
		}
		case "attempt:session": {
			return join(runsDirectory, "sessions", id.caseId, id.uuid, ATTEMPT_FILE);
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
 */
async function recordText(id: string, file: string): Promise<string> {
	const record = Bun.file(file);
	if (!(await record.exists())) {
		throw new RefusedPreconditionError(`No record ${id} at ${file}`);
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
	if (id.kind === "run") {
		return runSummary(id.run, parseRunSummaryRecord(text));
	}
	if (id.kind === "group") {
		const paths = confirmationGroupPaths(runsDirectory, id.groupId);
		const report = parseGroupReportSummaryRecord(
			await recordText(`group:${id.groupId}`, paths.reportFile),
		);

		return groupSummary(parseConfirmationGroupRecord(text), report);
	}
	if (id.kind === "comparison") {
		return comparisonSummary(id.manifestDigest, parseComparisonReport(text));
	}

	return text;
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
