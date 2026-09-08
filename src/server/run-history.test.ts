import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONTROL_DIR } from "#benchmark/config";
import {
	directorySource,
	RecordedRunsFixture,
} from "#benchmark/run-records-test-support";
import { runHistoryReport } from "./run-history";

describe(runHistoryReport.name, () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
		);
	});

	async function corpusDirectory(buildSkill: string): Promise<string> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-run-history-corpus-"));
		roots.push(root);
		await mkdir(join(root, "skills", "build"), { recursive: true });
		await mkdir(join(root, "skills", "discuss"), { recursive: true });
		await Bun.write(join(root, "CLAUDE.md"), "the instructions\n");
		await Bun.write(join(root, "skills", "build", "SKILL.md"), buildSkill);
		await Bun.write(
			join(root, "skills", "discuss", "SKILL.md"),
			"discuss skill\n",
		);

		return root;
	}

	async function writtenFixture(): Promise<RecordedRunsFixture> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-run-history-"));
		roots.push(root);
		const fixture = new RecordedRunsFixture(root);
		await fixture.write();

		return fixture;
	}

	it("names a run's status, stage, and corpus digest from its own recorded corpus files", async () => {
		const fixture = await writtenFixture();
		const corpus = await corpusDirectory("build skill\n");
		await fixture.recordCorpusFrom(directorySource(corpus));

		const { rows } = await runHistoryReport(
			fixture.runsDirectory,
			directorySource(corpus),
		);

		const row = rows.find(
			(candidate) => candidate.run === fixture.replayableRun,
		);
		expect(row).toMatchObject({
			run: fixture.replayableRun,
			caseId: "audit-log",
			status: "COMPLETE",
			stage: "build",
			grade: "B",
		});
		expect(row?.corpus?.digest).toMatch(/^[0-9a-f]{6}$/u);
	});

	it("changes a run's rendered corpus digest when one corpus byte changes", async () => {
		const fixture = await writtenFixture();
		const before = await corpusDirectory("build skill\n");
		await fixture.recordCorpusFrom(directorySource(before));
		const { rows: beforeRows } = await runHistoryReport(
			fixture.runsDirectory,
			directorySource(before),
		);
		const beforeDigest = beforeRows.find(
			(candidate) => candidate.run === fixture.replayableRun,
		)?.corpus?.digest;

		const after = await corpusDirectory("build skill, edited\n");
		await fixture.recordCorpusFrom(directorySource(after));
		const { rows: afterRows } = await runHistoryReport(
			fixture.runsDirectory,
			directorySource(after),
		);
		const afterDigest = afterRows.find(
			(candidate) => candidate.run === fixture.replayableRun,
		)?.corpus?.digest;

		expect(afterDigest).not.toBe(beforeDigest);
	});

	it("marks a row stale when its latest checkpoint's corpus no longer matches", async () => {
		const fixture = await writtenFixture();
		const recorded = await corpusDirectory("build skill\n");
		await fixture.recordCorpusFrom(directorySource(recorded));
		const edited = await corpusDirectory("build skill, edited\n");

		const { rows } = await runHistoryReport(
			fixture.runsDirectory,
			directorySource(edited),
		);

		const row = rows.find(
			(candidate) => candidate.run === fixture.replayableRun,
		);
		expect(row?.stale).toBe(true);
		expect(row?.staleCauses.join(" ")).toContain("skills/build/SKILL.md");
	});

	it("marks a row clean when its latest checkpoint's corpus still matches", async () => {
		const fixture = await writtenFixture();
		const corpus = await corpusDirectory("build skill\n");
		await fixture.recordCorpusFrom(directorySource(corpus));

		const { rows } = await runHistoryReport(
			fixture.runsDirectory,
			directorySource(corpus),
		);

		const row = rows.find(
			(candidate) => candidate.run === fixture.replayableRun,
		);
		expect(row?.stale).toBe(false);
		expect(row?.staleCauses).toEqual([]);
	});

	it("reports a run stopped mid-stage with STOPPED:<stage> and no corpus digest when it recorded no checkpoint", async () => {
		const fixture = await writtenFixture();
		await fixture.writeStoppedRun();

		const { rows } = await runHistoryReport(
			fixture.runsDirectory,
			directorySource(await corpusDirectory("build skill\n")),
		);

		const row = rows.find((candidate) => candidate.run === fixture.stoppedRun);
		expect(row).toMatchObject({ status: "STOPPED:build" });
		expect(row?.corpus).toBeUndefined();
		expect(row?.stale).toBe(false);
		expect(row?.grade).toBeUndefined();
	});

	it("reports a run reconciled to INTERRUPTED, which today's checkpoint- and stage-file reads alone leave invisible", async () => {
		const fixture = await writtenFixture();
		await fixture.writeInterruptedRun();

		const { rows } = await runHistoryReport(
			fixture.runsDirectory,
			directorySource(await corpusDirectory("build skill\n")),
		);

		const row = rows.find(
			(candidate) => candidate.run === fixture.interruptedRun,
		);
		expect(row).toMatchObject({ status: "INTERRUPTED" });
	});

	it("collects a run stopped mid-stage with no manifest as unreadable, matching list runs, rather than dropping it silently", async () => {
		const fixture = await writtenFixture();
		await fixture.writeStoppedRunWithoutManifest();

		const { rows, unreadable } = await runHistoryReport(
			fixture.runsDirectory,
			directorySource(await corpusDirectory("build skill\n")),
		);

		expect(rows.some((row) => row.run === fixture.stoppedRun)).toBe(false);
		expect(
			unreadable.some((entry) => entry.id === `run:${fixture.stoppedRun}`),
		).toBe(true);
	});

	it("reads an empty runs directory as no rows, not an error", async () => {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-run-history-empty-"));
		roots.push(root);

		const { rows } = await runHistoryReport(
			root,
			directorySource(await corpusDirectory("build skill\n")),
		);

		expect(rows).toEqual([]);
	});

	it("collects a run whose artifact fails to parse as unreadable, without dropping the other rows", async () => {
		const fixture = await writtenFixture();
		const corpus = await corpusDirectory("build skill\n");
		await fixture.recordCorpusFrom(directorySource(corpus));
		await writeFile(
			join(fixture.runsDirectory, `${fixture.replayableRun}.json`),
			"{ not json\n",
		);

		const { rows, unreadable } = await runHistoryReport(
			fixture.runsDirectory,
			directorySource(corpus),
		);

		expect(rows.some((row) => row.run === fixture.replayableRun)).toBe(false);
		expect(rows.some((row) => row.run === fixture.unreplayableRun)).toBe(true);
		expect(unreadable).toHaveLength(1);
		expect(unreadable.at(0)?.id).toBe(`run:${fixture.replayableRun}`);
		expect(unreadable.at(0)?.reason.length).toBeGreaterThan(0);
	});

	it("names no absolute filesystem path in an unreadable run's reason", async () => {
		const fixture = await writtenFixture();
		const corpus = await corpusDirectory("build skill\n");
		await fixture.recordCorpusFrom(directorySource(corpus));
		await writeFile(
			join(fixture.runsDirectory, `${fixture.replayableRun}.json`),
			"{ not json\n",
		);

		const { unreadable } = await runHistoryReport(
			fixture.runsDirectory,
			directorySource(corpus),
		);

		const reason = unreadable.at(0)?.reason ?? "";
		expect(reason).not.toContain(CONTROL_DIR);
		expect(reason).not.toMatch(/\/(?<segment>Users|home|var|tmp)\//u);
	});
});
