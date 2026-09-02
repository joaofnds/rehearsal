import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ComparisonEvidenceFixture } from "#benchmark/comparison-evidence-test-support";
import { parseComparisonReport } from "#benchmark/comparison-record";
import { runCompare } from "#cli/compare-command";
import { UsageError } from "#cli/commands";
import type { OutputRecorder } from "#cli/cli-test-support";
import { recordOutput } from "#cli/cli-test-support";

describe(runCompare.name, () => {
	let temporaryDirectory: string;
	let runsDirectory: string;
	let fixture: ComparisonEvidenceFixture;
	let recorder: OutputRecorder;

	beforeEach(async () => {
		recorder = recordOutput();
		temporaryDirectory = await mkdtemp(
			join(tmpdir(), "rehearsal-compare-cli-"),
		);
		runsDirectory = join(temporaryDirectory, "runs");
		await mkdir(runsDirectory);
		fixture = new ComparisonEvidenceFixture(temporaryDirectory);
		await fixture.write();
	});

	afterEach(async () => {
		await rm(temporaryDirectory, { force: true, recursive: true });
	});

	it("prints only the report path when --json is absent", async () => {
		await runCompare(
			{ manifestPath: fixture.manifestFile, runsDirectory, json: false },
			recorder.output,
		);

		const reportFile = recorder.stdout.join("").trim();
		expect(recorder.stdout.join("")).toBe(`${reportFile}\n`);
		expect(dirname(dirname(reportFile))).toBe(
			join(runsDirectory, "comparisons"),
		);
		expect(
			parseComparisonReport(await Bun.file(reportFile).text()).cases,
		).toHaveLength(2);
	});

	it("prints the report file's exact bytes on stdout with --json", async () => {
		await runCompare(
			{ manifestPath: fixture.manifestFile, runsDirectory, json: true },
			recorder.output,
		);

		const printed = recorder.stdout.join("");
		const report = parseComparisonReport(printed);
		const reportFile = join(
			runsDirectory,
			"comparisons",
			report.manifest.sha256,
			"report.json",
		);
		expect(printed).toBe(await Bun.file(reportFile).text());
		expect(recorder.stderr).toEqual([]);
	});

	it("refuses a missing manifest argument as a usage error", () => {
		expect(
			runCompare(
				{ manifestPath: undefined, runsDirectory, json: false },
				recorder.output,
			),
		).rejects.toThrow(UsageError);
	});
});
