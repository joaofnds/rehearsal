import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONTROL_DIR, DEFAULT_CASE_ID } from "#benchmark/config";
import { benchmarkRunsDirectory } from "#benchmark/run-layout";
import { RecordedRunsFixture } from "#benchmark/run-records-test-support";
import { failureOf, recordOutput } from "#cli/cli-test-support";
import { UsageError } from "#cli/commands";
import { runList } from "#cli/list-command";
import { parseRecordId } from "#cli/record-id";

function lines(stdout: readonly string[]): readonly string[] {
	const text = stdout.join("");

	return text === "" ? [] : text.trimEnd().split("\n");
}

function ids(stdout: readonly string[]): readonly string[] {
	return lines(stdout).map((line) => line.split("\t")[0] ?? "");
}

describe(runList.name, () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
		);
	});

	async function writtenFixture(): Promise<RecordedRunsFixture> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-list-"));
		roots.push(root);
		const fixture = new RecordedRunsFixture(root);
		await fixture.write();

		return fixture;
	}

	async function emptyRunsDirectory(): Promise<string> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-list-empty-"));
		roots.push(root);

		return root;
	}

	it("prints one line per declared case with its id and title", async () => {
		const recorder = recordOutput();

		await runList(
			{ kind: "cases", runsDirectory: await emptyRunsDirectory() },
			recorder.output,
		);

		expect(ids(recorder.stdout)).toContain(`case:${DEFAULT_CASE_ID}`);
		expect(ids(recorder.stdout)).toContain("case:smoke");
	});

	it("marks a run without a manifest as not replayable", async () => {
		const fixture = await writtenFixture();
		const recorder = recordOutput();

		await runList(
			{ kind: "runs", runsDirectory: fixture.runsDirectory },
			recorder.output,
		);

		expect(lines(recorder.stdout)).toEqual([
			`run:${fixture.unreplayableRun}\taudit-log\tFAILED\tnot replayable`,
			`run:${fixture.replayableRun}\taudit-log\tCOMPLETE\treplayable`,
		]);
	});

	it("prints one line per checkpoint of every recorded run", async () => {
		const fixture = await writtenFixture();
		const recorder = recordOutput();

		await runList(
			{ kind: "checkpoints", runsDirectory: fixture.runsDirectory },
			recorder.output,
		);

		expect(lines(recorder.stdout)).toEqual([
			`checkpoint:${fixture.replayableRun}/build\tbuild\tlineage-build`,
			`checkpoint:${fixture.replayableRun}/discuss\tdiscuss\tlineage-discuss`,
		]);
	});

	it("prints one line per confirmation group with its case, mode, and rep count", async () => {
		const fixture = await writtenFixture();
		const recorder = recordOutput();

		await runList(
			{ kind: "groups", runsDirectory: fixture.runsDirectory },
			recorder.output,
		);

		expect(lines(recorder.stdout)).toEqual([
			`group:${fixture.groupId}\taudit-log\tstage\t2 reps`,
		]);
	});

	it("prints one line per comparison report with its case and rep counts", async () => {
		const fixture = await writtenFixture();
		const recorder = recordOutput();

		await runList(
			{ kind: "comparisons", runsDirectory: fixture.runsDirectory },
			recorder.output,
		);

		expect(lines(recorder.stdout)).toEqual([
			`comparison:${fixture.comparisonDigest}\t2 cases\t4 reps`,
		]);
	});

	it("prints one line per session attempt with its case, outcome, and model", async () => {
		const fixture = await writtenFixture();
		const recorder = recordOutput();

		await runList(
			{ kind: "attempts", runsDirectory: fixture.runsDirectory },
			recorder.output,
		);

		expect(lines(recorder.stdout)).toEqual([
			`attempt:session:${fixture.sessionAttempt.caseId}/${fixture.sessionAttempt.uuid}\tsmoke\tSUCCESSFUL\tsonnet`,
		]);
	});

	it("prints every id in a form show accepts back", async () => {
		const fixture = await writtenFixture();

		for (const kind of [
			"cases",
			"runs",
			"checkpoints",
			"attempts",
			"groups",
			"comparisons",
		] as const) {
			const recorder = recordOutput();
			await runList(
				{ kind, runsDirectory: fixture.runsDirectory },
				recorder.output,
			);

			expect(ids(recorder.stdout).length).toBeGreaterThan(0);
			for (const id of ids(recorder.stdout)) {
				expect(() => parseRecordId(id)).not.toThrow();
			}
		}
	});

	describe("when one record cannot be read", () => {
		it("still prints the valid lines and names the unreadable one on stderr", async () => {
			const fixture = await writtenFixture();
			await fixture.writeUnreadableGroup("group-broken");
			await fixture.writeGroupWithoutCaseId("group-2");
			const recorder = recordOutput();

			await runList(
				{ kind: "groups", runsDirectory: fixture.runsDirectory },
				recorder.output,
			);

			expect(ids(recorder.stdout)).toEqual([
				`group:${fixture.groupId}`,
				"group:group-2",
			]);
			expect(recorder.stderr.join("")).toContain("group:group-broken");
		});
	});

	describe("when nothing has been recorded", () => {
		it.each([
			"runs",
			"checkpoints",
			"attempts",
			"groups",
			"comparisons",
		] as const)("prints nothing for %s", async (kind) => {
			const recorder = recordOutput();

			await runList(
				{ kind, runsDirectory: join(await emptyRunsDirectory(), "absent") },
				recorder.output,
			);

			expect(recorder.stdout).toEqual([]);
		});
	});

	describe("when the kind is not one of the six", () => {
		it("refuses it as a usage error naming the accepted kinds", async () => {
			const recorder = recordOutput();

			const failure = await failureOf(
				runList(
					{ kind: "bogus", runsDirectory: await emptyRunsDirectory() },
					recorder.output,
				),
			);

			expect(failure).toBeInstanceOf(UsageError);
			expect(failure.message).toContain("cases");
			expect(failure.message).toContain("comparisons");
			expect(recorder.stdout).toEqual([]);
		});
	});
});

describe("list attempts over the repository's own runs directory", () => {
	it("prints the eight recorded attempts and names the three without a record", async () => {
		const recorder = recordOutput();

		await runList(
			{
				kind: "attempts",
				runsDirectory: benchmarkRunsDirectory(CONTROL_DIR),
			},
			recorder.output,
		);

		expect(lines(recorder.stdout)).toHaveLength(8);
		expect(recorder.stderr).toHaveLength(3);
		for (const id of ids(recorder.stdout)) {
			expect(parseRecordId(id).kind).toBe("attempt:session");
		}
	});
});
