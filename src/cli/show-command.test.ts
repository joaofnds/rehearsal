import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { caseDeclarationPath, casesRoot } from "#benchmark/case";
import { CONTROL_DIR, DEFAULT_CASE_ID } from "#benchmark/config";
import {
	benchmarkRunPaths,
	benchmarkRunsDirectory,
	comparisonReportPaths,
	confirmationGroupPaths,
} from "#benchmark/run-layout";
import { RecordedRunsFixture } from "#benchmark/run-records-test-support";
import { failureOf, recordOutput } from "#cli/cli-test-support";
import { UsageError } from "#cli/commands";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import { LIST_KINDS, runList } from "#cli/list-command";
import { runShow } from "#cli/show-command";

describe("naming a record a session pastes onto a card", () => {
	/**
	 * A card is read by people who are not on this machine, and the README tells
	 * a session to paste this output onto one. An absolute path under the
	 * control root discloses the home directory and names the same file the
	 * control-relative path does.
	 */
	it("names an absent record's path relative to the control root", async () => {
		const recorder = recordOutput();

		const failure = await failureOf(
			runShow(
				{
					id: "run:absent",
					json: true,
					runsDirectory: benchmarkRunsDirectory(CONTROL_DIR),
				},
				recorder.output,
			),
		);

		expect(failure.message).toContain(".benchmark-runs/absent.json");
		expect(failure.message).not.toContain(homedir());
	});
});

describe(runShow.name, () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
		);
	});

	async function writtenFixture(): Promise<RecordedRunsFixture> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-show-"));
		roots.push(root);
		const fixture = new RecordedRunsFixture(root);
		await fixture.write();

		return fixture;
	}

	async function printed(
		id: string,
		json: boolean,
		runsDirectory: string,
	): Promise<string> {
		const recorder = recordOutput();
		await runShow({ id, json, runsDirectory }, recorder.output);

		return recorder.stdout.join("");
	}

	it("prints exactly the run artifact's bytes with --json", async () => {
		const fixture = await writtenFixture();
		const paths = benchmarkRunPaths(
			fixture.runsDirectory,
			fixture.replayableRun,
		);

		const stdout = await printed(
			`run:${fixture.replayableRun}`,
			true,
			fixture.runsDirectory,
		);

		expect(stdout).toBe(await Bun.file(paths.artifactFile).text());
		expect(() => {
			JSON.parse(stdout);
		}).not.toThrow();
	});

	it("prints exactly the checkpoint record's bytes with --json", async () => {
		const fixture = await writtenFixture();
		const paths = benchmarkRunPaths(
			fixture.runsDirectory,
			fixture.replayableRun,
		);

		const stdout = await printed(
			`checkpoint:${fixture.replayableRun}/build`,
			true,
			fixture.runsDirectory,
		);

		expect(stdout).toBe(
			await Bun.file(
				join(paths.checkpointDirectory("build"), "checkpoint.json"),
			).text(),
		);
	});

	it("prints exactly the group record's bytes with --json", async () => {
		const fixture = await writtenFixture();
		const paths = confirmationGroupPaths(
			fixture.runsDirectory,
			fixture.groupId,
		);

		const stdout = await printed(
			`group:${fixture.groupId}`,
			true,
			fixture.runsDirectory,
		);

		expect(stdout).toBe(await Bun.file(paths.groupFile).text());
	});

	it("prints exactly the comparison report's bytes with --json", async () => {
		const fixture = await writtenFixture();
		const paths = comparisonReportPaths(
			fixture.runsDirectory,
			fixture.comparisonDigest,
		);

		const stdout = await printed(
			`comparison:${fixture.comparisonDigest}`,
			true,
			fixture.runsDirectory,
		);

		expect(stdout).toBe(await Bun.file(paths.reportFile).text());
	});

	it("prints exactly the case declaration's bytes with --json", async () => {
		const fixture = await writtenFixture();

		const stdout = await printed(
			`case:${DEFAULT_CASE_ID}`,
			true,
			fixture.runsDirectory,
		);

		expect(stdout).toBe(
			await Bun.file(caseDeclarationPath(DEFAULT_CASE_ID, casesRoot())).text(),
		);
	});

	it("prints exactly the session attempt record's bytes with --json", async () => {
		const fixture = await writtenFixture();

		const stdout = await printed(
			`attempt:session:${fixture.sessionAttempt.caseId}/${fixture.sessionAttempt.uuid}`,
			true,
			fixture.runsDirectory,
		);

		expect(stdout).toBe(await Bun.file(fixture.sessionAttemptFile).text());
	});

	it("prints exactly the stage replay record's bytes with --json", async () => {
		const fixture = await writtenFixture();

		const stdout = await printed(
			`attempt:stage:${fixture.stageAttempt.lineage}/${fixture.stageAttempt.timestamp}`,
			true,
			fixture.runsDirectory,
		);

		expect(stdout).toBe(await Bun.file(fixture.stageAttemptFile).text());
	});

	it("prints a run's stages, grades, verdict, and total cost without --json", async () => {
		const fixture = await writtenFixture();

		const stdout = await printed(
			`run:${fixture.replayableRun}`,
			false,
			fixture.runsDirectory,
		);

		expect(stdout).toContain("| stage | grade | verdict | cost |");
		expect(stdout).toContain("| build | B | CONTINUE | $2.00 |");
		expect(stdout).toContain("Final verdict PASS.");
		expect(stdout).toContain("Total cost $4.75.");
		expect(() => {
			JSON.parse(stdout);
		}).toThrow();
	});

	it("prints a comparison's paired deltas beside the control arm without --json", async () => {
		const fixture = await writtenFixture();

		const stdout = await printed(
			`comparison:${fixture.comparisonDigest}`,
			false,
			fixture.runsDirectory,
		);

		expect(stdout).toContain("| candidate − baseline | build |");
		expect(stdout).toContain("| candidate − control | build |");
		expect(stdout).toContain("| baseline − control | build |");
	});

	describe("when the group record was written without a case id", () => {
		it("names the legacy default case in its summary", async () => {
			const fixture = await writtenFixture();
			await fixture.writeGroupWithoutCaseId("group-legacy");
			await fixture.writeGroupReport("group-legacy");

			const stdout = await printed(
				"group:group-legacy",
				false,
				fixture.runsDirectory,
			);

			expect(stdout).toContain("Case audit-log");
			expect(stdout).toContain("success rate");
			expect(stdout).toContain("pass^k");
		});
	});

	describe("when the id is missing or malformed", () => {
		it("refuses no argument by naming every id form", async () => {
			const fixture = await writtenFixture();

			const failure = await failureOf(
				runShow(
					{
						id: undefined,
						json: false,
						runsDirectory: fixture.runsDirectory,
					},
					recordOutput().output,
				),
			);

			expect(failure).toBeInstanceOf(UsageError);
			expect(failure.message).toContain("checkpoint:<run>/<stage>");
		});

		it("refuses an unknown prefix as a usage error", async () => {
			const fixture = await writtenFixture();

			const failure = await failureOf(
				runShow(
					{ id: "nonsense", json: false, runsDirectory: fixture.runsDirectory },
					recordOutput().output,
				),
			);

			expect(failure).toBeInstanceOf(UsageError);
		});

		it("names the form a known prefix takes when its body is wrong", async () => {
			const fixture = await writtenFixture();

			const failure = await failureOf(
				runShow(
					{
						id: "checkpoint:only-one-part",
						json: false,
						runsDirectory: fixture.runsDirectory,
					},
					recordOutput().output,
				),
			);

			expect(failure).toBeInstanceOf(UsageError);
			expect(failure.message).toContain("checkpoint:<run>/<stage>");
		});
	});

	describe("when a well-formed id names no record", () => {
		it("refuses the precondition and prints nothing on stdout", async () => {
			const fixture = await writtenFixture();
			const recorder = recordOutput();

			const failure = await failureOf(
				runShow(
					{
						id: "run:absent",
						json: false,
						runsDirectory: fixture.runsDirectory,
					},
					recorder.output,
				),
			);

			expect(failure).toBeInstanceOf(RefusedPreconditionError);
			expect(failure.message).toContain("run:absent");
			expect(recorder.stdout).toEqual([]);
		});
	});
});

describe("list and show are read-only", () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
		);
	});

	async function digestOfTree(root: string): Promise<readonly string[]> {
		const entries = await readdir(root, {
			recursive: true,
			withFileTypes: true,
		});
		const digests: string[] = [];

		for (const entry of entries.toSorted((left, right) =>
			left.name < right.name ? -1 : 1,
		)) {
			const path = join(entry.parentPath, entry.name);
			digests.push(
				entry.isFile()
					? `${path}:${new Bun.CryptoHasher("sha256")
							.update(await Bun.file(path).bytes())
							.digest("hex")}`
					: `${path}:directory`,
			);
		}

		return digests.toSorted();
	}

	it("leaves every file under the runs directory byte-identical", async () => {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-readonly-"));
		roots.push(root);
		const fixture = new RecordedRunsFixture(root);
		await fixture.write();
		const before = await digestOfTree(root);
		const recorder = recordOutput();

		for (const kind of LIST_KINDS) {
			await runList({ kind, runsDirectory: root }, recorder.output);
		}
		for (const id of [
			`run:${fixture.replayableRun}`,
			`checkpoint:${fixture.replayableRun}/build`,
			`group:${fixture.groupId}`,
			`comparison:${fixture.comparisonDigest}`,
			`attempt:session:${fixture.sessionAttempt.caseId}/${fixture.sessionAttempt.uuid}`,
			`attempt:stage:${fixture.stageAttempt.lineage}/${fixture.stageAttempt.timestamp}`,
		]) {
			await runShow({ id, json: true, runsDirectory: root }, recorder.output);
			await runShow({ id, json: false, runsDirectory: root }, recorder.output);
		}

		expect(await digestOfTree(root)).toEqual(before);
	});
});
