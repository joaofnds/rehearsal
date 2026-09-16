import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCheckpointRecord } from "./checkpoint";
import { CONTROL_DIR } from "./config";
import { currentStageSettingsReference } from "./current-stage-settings";
import {
	DEFAULT_STAGE_SETTINGS_FILE,
	loadStageSettings,
	stageSettingsSchema,
} from "./stage-settings";
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

/**
 * The canonical digest of a settings file, computed the way the harness's own
 * loader defines it, over JSON re-serialized from the parsed document rather
 * than over the file's raw bytes. Written here independently of
 * `loadStageSettings` so the contract test below compares two computations
 * instead of one with itself.
 */
async function canonicalDigestOf(path: string): Promise<string> {
	const document: unknown = JSON.parse(await Bun.file(path).text());

	return new Bun.CryptoHasher("sha256")
		.update(JSON.stringify(stageSettingsSchema.parse(document)))
		.digest("hex");
}

describe(RecordedRunsFixture.name, () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
		);
	});

	async function writtenFixture(): Promise<RecordedRunsFixture> {
		const root = await mkdtemp(join(tmpdir(), "rehearse-records-"));
		roots.push(root);
		const fixture = new RecordedRunsFixture(root);
		await fixture.write();

		return fixture;
	}

	it("records the settings evidence it was constructed with on an ordinary checkpoint", async () => {
		const root = await mkdtemp(join(tmpdir(), "rehearse-records-"));
		roots.push(root);
		const settingsFile = {
			path: "stage-settings.json",
			sha256: "b".repeat(64),
		};
		const fixture = new RecordedRunsFixture(root, { settingsFile });

		await fixture.write();

		const paths = benchmarkRunPaths(
			fixture.runsDirectory,
			fixture.replayableRun,
		);
		const record = parseCheckpointRecord(
			await Bun.file(
				join(paths.checkpointDirectory("build"), "checkpoint.json"),
			).text(),
		);
		expect(record.settingsFile).toEqual(settingsFile);
	});

	/**
	 * The one declared place the production default is proven to reach a fresh
	 * ordinary checkpoint. Every other fixture record carries a literal, so if
	 * this test goes, nothing observes that the settings a run would really be
	 * given are the settings a checkpoint records.
	 *
	 * The expected digest is hashed here from the committed root file rather
	 * than taken from `loadStageSettings`, because an expectation derived from
	 * the call under test moves with it and can never disagree.
	 */
	it("records the production default selection and digest on an ordinary checkpoint", async () => {
		const root = await mkdtemp(join(tmpdir(), "rehearse-records-"));
		roots.push(root);
		const reference = await currentStageSettingsReference("audit-log");
		const selected = await loadStageSettings(reference.sourcePath);
		const fixture = new RecordedRunsFixture(root, {
			settingsFile: selected.hashed,
		});

		await fixture.write();

		const paths = benchmarkRunPaths(
			fixture.runsDirectory,
			fixture.replayableRun,
		);
		const record = parseCheckpointRecord(
			await Bun.file(
				join(paths.checkpointDirectory("build"), "checkpoint.json"),
			).text(),
		);
		expect(record.settingsFile).toEqual({
			path: DEFAULT_STAGE_SETTINGS_FILE,
			sha256: await canonicalDigestOf(
				join(CONTROL_DIR, DEFAULT_STAGE_SETTINGS_FILE),
			),
		});
	});

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
