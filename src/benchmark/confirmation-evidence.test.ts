import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	collectConfirmationMetrics,
	settleCompletedConfirmationRep,
} from "./confirmation-evidence";
import type { ClaudeCallMetrics } from "./contracts";
import { TestResources } from "./test-support";

const testResources = TestResources.forEachTest();

describe(collectConfirmationMetrics.name, () => {
	it("retains available calls while marking every metric-less required attempt", () => {
		const metric: ClaudeCallMetrics = {
			costUsd: 0.25,
			inputTokens: 100,
			outputTokens: 20,
			cacheReadTokens: 30,
			cacheWriteTokens: 40,
			turns: 2,
		};

		const evidence = collectConfirmationMetrics({
			worker: [{ metrics: metric }, {}],
			productOwner: [{ metrics: metric }, {}],
			stageJudge: [{ metrics: metric }, {}],
			finalJudge: [{ metrics: metric }, {}],
		});

		expect(evidence).toEqual({
			metrics: {
				status: "MISSING",
				calls: [
					{ role: "worker", metrics: metric },
					{ role: "product-owner", metrics: metric },
					{ role: "stage-judge", metrics: metric },
					{ role: "final-judge", metrics: metric },
				],
				missing: [
					"worker call metrics",
					"product-owner call metrics",
					"stage-judge call metrics",
					"final-judge call metrics",
				],
			},
			workerTrajectorySteps: 2,
		});
	});
});

describe(settleCompletedConfirmationRep.name, () => {
	it("leaves no rep record or cleanup after retention fails", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-settlement-"));
		testResources.track(directory);
		const worktreePath = join(directory, "worktree");
		await mkdir(worktreePath);
		const recordFile = join(directory, "rep.json");
		let removed = false;

		const settlement = settleCompletedConfirmationRep({
			targetRoot: directory,
			retentionName: "group/rep",
			resultSha: "a".repeat(40),
			recordFile,
			recordContent: "{}\n",
			worktreePath,
			recordRetentionRef: () => Promise.reject(new Error("retention failed")),
			removeWorktree: () => {
				removed = true;

				return Promise.resolve();
			},
		});

		expect(settlement).rejects.toThrow("retention failed");
		expect(
			await stat(recordFile).then(
				() => true,
				() => false,
			),
		).toBe(false);
		expect(await stat(worktreePath).then((entry) => entry.isDirectory())).toBe(
			true,
		);
		expect(removed).toBe(false);
	});
});
