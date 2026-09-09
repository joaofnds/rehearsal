import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionCase } from "./case";
import {
	parseConfirmationGroupRecord,
	parseConfirmationRepRecord,
} from "./confirmation-record";
import { parseSessionAttemptRecord } from "./session-record";
import {
	runSessionConfirmation,
	SessionInvocationError,
} from "./session-confirmation";

const metrics = {
	costUsd: 0.02,
	inputTokens: 10,
	outputTokens: 2,
	cacheReadTokens: 3,
	cacheWriteTokens: 4,
	turns: 1,
};

function requiredPath(path: string | undefined): string {
	if (path === undefined) {
		throw new Error("Expected a frozen session path");
	}

	return path;
}

describe(runSessionConfirmation.name, () => {
	const temporaryDirectories: string[] = [];

	afterEach(async () => {
		await Promise.all(
			temporaryDirectories
				.splice(0)
				.map((directory) => rm(directory, { force: true, recursive: true })),
		);
	});

	it("runs every rep from one frozen input set and records a provider failure", async () => {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-session-group-"));
		temporaryDirectories.push(root);
		const fixturePath = join(root, "source-fixture");
		const transcriptPath = join(root, "source-transcript.jsonl");
		const corpusRoot = join(root, "source-corpus");
		await mkdir(join(corpusRoot, "output-styles"), { recursive: true });
		await mkdir(fixturePath, { recursive: true });
		await Bun.write(join(fixturePath, "fixture.txt"), "original fixture\n");
		await Bun.write(transcriptPath, "original transcript\n");
		await Bun.write(
			join(corpusRoot, "output-styles", "brief.md"),
			"original corpus\n",
		);
		const transcriptSha = new Bun.CryptoHasher("sha256")
			.update("original transcript\n")
			.digest("hex");
		const sessionCase: SessionCase = {
			kind: "session",
			declaration: {
				id: "smoke",
				kind: "session",
				title: "Smoke",
				fixture: "fixture",
				prompt: "Reply with OK.",
				transcript: {
					file: "prefix.jsonl",
					sha256: transcriptSha,
					sourceSession: "source-session",
					cut: 1,
				},
				tools: [],
				corpusFiles: ["output-styles/brief.md"],
				projectFiles: ["fixture.txt"],
				checks: [{ kind: "word-band", max: 1 }],
			},
			fixturePath,
			transcriptPath,
			prompt: "Reply with OK.",
			tools: [],
			settings: undefined,
			agents: undefined,
			corpusFiles: ["output-styles/brief.md"],
			projectFiles: ["fixture.txt"],
			checks: [{ kind: "word-band", max: 1 }],
		};
		const observedInputs: string[] = [];
		const completed: number[] = [];

		const outcome = await runSessionConfirmation(
			{
				executeAttempt: async (plan) => {
					const observed = [
						await Bun.file(
							join(requiredPath(plan.sessionCase.fixturePath), "fixture.txt"),
						).text(),
						await Bun.file(
							requiredPath(plan.sessionCase.transcriptPath),
						).text(),
						await Bun.file(
							join(plan.corpusSnapshot.root, "output-styles", "brief.md"),
						).text(),
					].join("|");
					observedInputs.push(`${plan.lineage}:${observed}`);
					if (plan.ordinal === 1) {
						await Bun.write(
							join(fixturePath, "fixture.txt"),
							"mutated fixture\n",
						);
						await Bun.write(transcriptPath, "mutated transcript\n");
						await Bun.write(
							join(corpusRoot, "output-styles", "brief.md"),
							"mutated corpus\n",
						);
					}

					const transcriptFile = join(plan.recordDirectory, "transcript.jsonl");
					await Bun.write(transcriptFile, `rep ${plan.ordinal}\n`);
					const attempt = {
						attemptDirectory: join(plan.recordDirectory, "execution"),
						reply: "OK",
						transcriptFile,
						metrics,
						outcome: "SUCCESSFUL" as const,
						checks: [
							{
								kind: "word-band" as const,
								status: "PASS" as const,
								detail: "1 word",
							},
						],
						contextManifest: undefined,
					};
					if (plan.ordinal === 2) {
						throw new SessionInvocationError("provider rejected rep 2", {
							...attempt,
							reply: undefined,
							outcome: "EXECUTION_FAILED",
							checks: [],
						});
					}

					completed.push(plan.ordinal);

					return attempt;
				},
			},
			{
				runsDirectory: join(root, "runs"),
				groupId: "session-group",
				reps: 3,
				projectedCost: {
					reps: 3,
					perRepMaximumUsd: 0.2,
					preflightMaximumUsd: 0.1,
					totalMaximumUsd: 0.7,
				},
				approvalMethod: "yes",
				sessionCase,
				corpus: corpusRoot,
				model: "sonnet",
				sessionBudgetUsd: 0.2,
				preflight: { status: "COMPLETE", call: { metrics } },
			},
		);

		const group = parseConfirmationGroupRecord(
			await Bun.file(outcome.groupRecordFile).text(),
		);
		const reps = await Promise.all(
			outcome.repRecordFiles.map(async (path) =>
				parseConfirmationRepRecord(await Bun.file(path).text()),
			),
		);
		const failedAttempt = parseSessionAttemptRecord(
			await Bun.file(
				join(
					root,
					"runs",
					"confirmations",
					"session-group",
					"reps",
					"session-group-rep-2",
					"attempt.json",
				),
			).text(),
		);

		expect(observedInputs).toHaveLength(3);
		expect(new Set(observedInputs)).toHaveLength(1);
		expect(observedInputs[0]).toContain(
			"original fixture\n|original transcript\n|original corpus\n",
		);
		expect(completed.toSorted((left, right) => left - right)).toEqual([1, 3]);
		expect(group.repRecords.map(({ ordinal }) => ordinal)).toEqual([1, 2, 3]);
		expect(reps.map(({ outcome: repOutcome }) => repOutcome)).toEqual([
			"SUCCESSFUL",
			"UNSUCCESSFUL",
			"SUCCESSFUL",
		]);
		expect(reps[1]?.stages[0]?.status).toBe("EXECUTION_FAILED");
		expect(failedAttempt).toMatchObject({
			outcome: "EXECUTION_FAILED",
			error: "provider rejected rep 2",
		});
	});
});
