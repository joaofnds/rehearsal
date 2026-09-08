import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	directorySource,
	RecordedRunsFixture,
} from "#benchmark/run-records-test-support";
import { corpusReport } from "./corpus-report";

describe(corpusReport.name, () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
		);
	});

	async function corpusDirectory(): Promise<string> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-corpus-report-"));
		roots.push(root);

		return root;
	}

	async function fullCorpusDirectory(): Promise<string> {
		const root = await corpusDirectory();
		await mkdir(join(root, "skills", "build"), { recursive: true });
		await mkdir(join(root, "skills", "discuss"), { recursive: true });
		await writeFile(join(root, "CLAUDE.md"), "instructions\n");
		await writeFile(join(root, "skills", "build", "SKILL.md"), "build skill\n");
		await writeFile(
			join(root, "skills", "discuss", "SKILL.md"),
			"discuss skill\n",
		);

		return root;
	}

	async function runsDirectory(): Promise<string> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-corpus-report-runs-"));
		roots.push(root);

		return root;
	}

	it("lists a live corpus file with a read count of zero when no checkpoint recorded it", async () => {
		const corpus = await corpusDirectory();
		await writeFile(join(corpus, "CLAUDE.md"), "instructions");

		const report = await corpusReport(
			directorySource(corpus),
			await runsDirectory(),
		);

		expect(report.files).toEqual([
			expect.objectContaining({ path: "CLAUDE.md", readBy: 0 }),
		]);
	});

	it("counts the run once when two of its stages both recorded the same file, since read-by is a run count", async () => {
		const corpus = await fullCorpusDirectory();
		const runs = await runsDirectory();

		const fixture = new RecordedRunsFixture(runs);
		await fixture.write();
		await fixture.recordCorpusFrom(directorySource(corpus));

		const report = await corpusReport(directorySource(corpus), runs);

		const instructions = report.files.find((file) => file.path === "CLAUDE.md");
		expect(instructions?.readBy).toBe(1);
	});

	it("reports a run whose checkpoint directory holds no checkpoint.json as read-by zero, rather than throwing", async () => {
		const corpus = await corpusDirectory();
		await writeFile(join(corpus, "CLAUDE.md"), "instructions");
		const runs = await runsDirectory();
		const fixture = new RecordedRunsFixture(runs);
		await fixture.writeEmptyCheckpointDirectory("discuss");

		const report = await corpusReport(directorySource(corpus), runs);

		const instructions = report.files.find((file) => file.path === "CLAUDE.md");
		expect(instructions?.readBy).toBe(0);
	});
});
