import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sessionAttemptRecordSchema } from "#benchmark/session-record";
import { sessionAttemptPaths } from "#benchmark/run-layout";
import {
	readSessionAttemptHistory,
	SessionHistoryReaderError,
} from "#server/session-history-reader";

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
	);
});

async function writtenAttempt(): Promise<{
	readonly runsDirectory: string;
	readonly caseId: string;
	readonly uuid: string;
}> {
	const root = await mkdtemp(join(tmpdir(), "rehearsal-history-reader-"));
	roots.push(root);
	const runsDirectory = join(root, ".benchmark-runs");
	const caseId = "case-a";
	const uuid = "attempt-a";
	const paths = sessionAttemptPaths(runsDirectory, { caseId, uuid });
	await mkdir(paths.directory, { recursive: true });
	const transcript = [
		JSON.stringify({
			type: "assistant",
			cwd: "/work",
			message: {
				content: [
					{
						type: "tool_use",
						id: "read-1",
						name: "Read",
						input: { file_path: "/work/CLAUDE.md" },
					},
				],
			},
		}),
		JSON.stringify({
			type: "user",
			message: {
				content: [
					{
						type: "tool_result",
						tool_use_id: "read-1",
						content: "1\tproject instructions",
					},
				],
			},
		}),
	].join("\n");
	const record = sessionAttemptRecordSchema.parse({
		schemaVersion: 1,
		caseId,
		lineage: "lineage-a",
		model: "sonnet",
		sessionBudgetUsd: 1,
		corpusFiles: [],
		prompt: "inspect",
		reply: "done",
		transcriptFile: "/outside/must-not-be-read.jsonl",
		transcriptDiagnostics: {
			state: "complete",
			prefixLinesExcluded: 0,
			sourceLineCount: 2,
			measuredLineCount: 2,
			toolUseOccurrences: {
				total: 1,
				byName: [{ name: "Read", count: 1 }],
			},
			toolErrors: [],
			repeatedBashCommands: [],
			issues: [],
		},
		outcome: "SUCCESSFUL",
		checks: [{ kind: "word-band", status: "PASS", detail: "1 word" }],
		elapsedMs: 1,
	});
	await Bun.write(paths.recordFile, `${JSON.stringify(record, null, 2)}\n`);
	await Bun.write(join(paths.directory, "transcript.jsonl"), transcript);

	return { runsDirectory, caseId, uuid };
}

describe(readSessionAttemptHistory.name, () => {
	it("reads the verified sibling transcript", async () => {
		const fixture = await writtenAttempt();

		const report = await readSessionAttemptHistory(fixture);

		expect(report.attempt.caseId).toBe(fixture.caseId);
		expect(report.attempt.id).toBe(fixture.uuid);
		expect(report.attempt.model).toBe("sonnet");
		expect(report.attempt.outcome).toBe("SUCCESSFUL");
		expect(report.attemptEvents.map(({ id, state }) => ({ id, state }))).toEqual([
			{ id: "1:1", state: "invoked" },
			{ id: "2:1", state: "delivered" },
		]);
	});

	it("refuses traversal identities before reading the filesystem", async () => {
		const fixture = await writtenAttempt();

		expect(
			readSessionAttemptHistory({ ...fixture, uuid: "../attempt-a" }),
		).rejects.toBeInstanceOf(SessionHistoryReaderError);
	});

	it("refuses a transcript symlink even when its target is a regular file", async () => {
		const fixture = await writtenAttempt();
		const paths = sessionAttemptPaths(fixture.runsDirectory, fixture);
		const outside = join(fixture.runsDirectory, "outside.jsonl");
		await Bun.write(outside, "secret");
		await rm(paths.transcriptFile);
		await symlink(outside, paths.transcriptFile);

		expect(readSessionAttemptHistory(fixture)).rejects.toBeInstanceOf(
			SessionHistoryReaderError,
		);
	});

	it("refuses a symlink in the saved-attempt directory chain", async () => {
		const fixture = await writtenAttempt();
		const paths = sessionAttemptPaths(fixture.runsDirectory, fixture);
		const outside = join(fixture.runsDirectory, "outside-attempt");
		await mkdir(outside);
		await Bun.write(join(outside, "attempt.json"), "{}");
		await rm(paths.directory, { recursive: true });
		await symlink(outside, paths.directory);

		expect(readSessionAttemptHistory(fixture)).rejects.toBeInstanceOf(
			SessionHistoryReaderError,
		);
	});
});
