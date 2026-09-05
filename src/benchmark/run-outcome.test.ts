import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RecordedRunsFixture } from "./run-records-test-support";
import { stoppedStage } from "./run-outcome";

describe(stoppedStage.name, () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
		);
	});

	async function fixture(): Promise<RecordedRunsFixture> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-run-outcome-"));
		roots.push(root);

		return new RecordedRunsFixture(root);
	}

	it("names the stage whose file holds a stop record among several stage files", async () => {
		const runs = await fixture();
		await runs.writeStoppedRun();

		const found = await stoppedStage(runs.runsDirectory, runs.stoppedRun);

		expect(found).toEqual({
			stage: "build",
			error: "build stage graded F; minimum grade is B",
		});
	});

	it("finds nothing for a run whose stages all judged clean", async () => {
		const runs = await fixture();
		await runs.write();

		expect(
			await stoppedStage(runs.runsDirectory, runs.replayableRun),
		).toBeUndefined();
	});

	it("finds nothing for a run with no stage files at all", async () => {
		const runs = await fixture();
		await runs.writeNoRecordRun();

		expect(
			await stoppedStage(runs.runsDirectory, runs.noRecordRun),
		).toBeUndefined();
	});
});
