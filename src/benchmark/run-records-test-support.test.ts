import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCheckpointRecord } from "./checkpoint";
import { parseComparisonReport } from "./comparison-record";
import { parseConfirmationGroupRecord } from "./confirmation-record";
import { loadRunManifest } from "./manifest";
import { RecordedRunsFixture } from "./run-records-test-support";
import {
	benchmarkRunPaths,
	comparisonReportPaths,
	confirmationGroupPaths,
} from "./run-layout";
import { parseSessionAttemptRecord } from "./session-record";

describe(RecordedRunsFixture.name, () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
		);
	});

	async function writtenFixture(): Promise<RecordedRunsFixture> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-records-"));
		roots.push(root);
		const fixture = new RecordedRunsFixture(root);
		await fixture.write();

		return fixture;
	}

	it("writes a run manifest the manifest loader parses", async () => {
		const fixture = await writtenFixture();
		const paths = benchmarkRunPaths(
			fixture.runsDirectory,
			fixture.replayableRun,
		);

		const manifest = await loadRunManifest(paths.manifestFile);

		expect(manifest.caseId).toBe("audit-log");
		expect(manifest.pipeline.stages.map(({ name }) => name)).toEqual([
			"discuss",
			"build",
		]);
	});

	it("writes each checkpoint where the checkpoint parser reads it", async () => {
		const fixture = await writtenFixture();
		const paths = benchmarkRunPaths(
			fixture.runsDirectory,
			fixture.replayableRun,
		);

		const record = parseCheckpointRecord(
			await Bun.file(
				join(paths.checkpointDirectory("build"), "checkpoint.json"),
			).text(),
		);

		expect(record.stage).toBe("build");
		expect(record.corpusFiles).toHaveLength(1);
	});

	it("writes a run artifact holding one scorecard per declared stage", async () => {
		const fixture = await writtenFixture();
		const paths = benchmarkRunPaths(
			fixture.runsDirectory,
			fixture.replayableRun,
		);

		const artifact: unknown = JSON.parse(
			await Bun.file(paths.artifactFile).text(),
		);

		expect(artifact).toMatchObject({
			caseId: "audit-log",
			status: "COMPLETE",
			stageScorecards: [{ stage: "discuss" }, { stage: "build" }],
		});
	});

	it("writes a run directory with no manifest as the unreplayable run", async () => {
		const fixture = await writtenFixture();
		const paths = benchmarkRunPaths(
			fixture.runsDirectory,
			fixture.unreplayableRun,
		);

		expect(await Bun.file(paths.manifestFile).exists()).toBe(false);
		expect(await Bun.file(paths.artifactFile).exists()).toBe(true);
	});

	it("writes a confirmation group the group parser reads at its layout path", async () => {
		const fixture = await writtenFixture();
		const paths = confirmationGroupPaths(
			fixture.runsDirectory,
			fixture.groupId,
		);

		const record = parseConfirmationGroupRecord(
			await Bun.file(paths.groupFile).text(),
		);

		expect(record.caseId).toBe("audit-log");
		expect(record.reps).toBe(record.repRecords.length);
	});

	it("writes a comparison report the report parser reads at its digest path", async () => {
		const fixture = await writtenFixture();
		const paths = comparisonReportPaths(
			fixture.runsDirectory,
			fixture.comparisonDigest,
		);

		const report = parseComparisonReport(
			await Bun.file(paths.reportFile).text(),
		);

		expect(report.cases).toHaveLength(2);
	});

	it("writes a session attempt the attempt parser reads under its case and uuid", async () => {
		const fixture = await writtenFixture();

		const record = parseSessionAttemptRecord(
			await Bun.file(fixture.sessionAttemptFile).text(),
		);

		expect(record.caseId).toBe(fixture.sessionAttempt.caseId);
		expect(record.outcome).toBe("SUCCESSFUL");
	});
});
