import { afterEach, describe, expect, it } from "bun:test";
import {
	chmod,
	mkdir,
	mkdtemp,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	directorySource,
	RecordedRunsFixture,
} from "#benchmark/run-records-test-support";
import { SymlinkedEntryError } from "#benchmark/file-presence";
import { failureOf } from "#cli/cli-test-support";
import type { CorpusReport } from "./corpus-report";
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

	it("reports only the corpus layout, never a file beside it in the root", async () => {
		const root = await fullCorpusDirectory();
		await mkdir(join(root, "daemon"), { recursive: true });
		await writeFile(join(root, "daemon", "control.key"), "secret\n");
		await writeFile(join(root, ".claude.json"), "{}\n");
		const runs = await corpusDirectory();
		await new RecordedRunsFixture(runs).write();

		const report = await corpusReport(directorySource(root), runs);

		expect(report.files.map(({ path }) => path)).toEqual([
			"CLAUDE.md",
			"skills/build/SKILL.md",
			"skills/discuss/SKILL.md",
		]);
	});

	it("reports a rulebook file, since a stage session's corpus freezes rulebook whole", async () => {
		const root = await fullCorpusDirectory();
		await mkdir(join(root, "rulebook"), { recursive: true });
		await writeFile(join(root, "rulebook", "coding-style.md"), "style\n");
		const runs = await corpusDirectory();
		await new RecordedRunsFixture(runs).write();

		const report = await corpusReport(directorySource(root), runs);

		expect(report.files.map(({ path }) => path)).toContain(
			"rulebook/coding-style.md",
		);
	});

	describe("when a layout directory holds a symlink resolving outside the root", () => {
		async function reportOverEscapingSkills(): Promise<CorpusReport> {
			const root = await fullCorpusDirectory();
			const outside = await corpusDirectory();
			await writeFile(join(outside, "secret.md"), "secret bytes\n");
			await mkdir(join(root, "agents"), { recursive: true });
			await writeFile(join(root, "agents", "normal.md"), "an agent\n");
			await symlink(
				join(outside, "secret.md"),
				join(root, "skills", "escape.md"),
			);
			const runs = await corpusDirectory();
			await new RecordedRunsFixture(runs).write();

			return corpusReport(directorySource(root), runs);
		}

		it("reports every file under the layout directories that hashed whole, including one walked after the refusal", async () => {
			const report = await reportOverEscapingSkills();

			expect(report.files.map(({ path }) => path)).toEqual([
				"CLAUDE.md",
				"agents/normal.md",
			]);
		});

		it("names every offending entry in the directory, so an earlier one cannot hide a later one", async () => {
			const root = await fullCorpusDirectory();
			const outside = await corpusDirectory();
			await writeFile(join(outside, "secret.md"), "secret bytes\n");
			await mkdir(join(root, "agents"), { recursive: true });
			await symlink(
				join(root, "aardvark-gone.md"),
				join(root, "agents", "aardvark.md"),
			);
			await symlink(
				join(outside, "secret.md"),
				join(root, "agents", "escape.md"),
			);
			const runs = await corpusDirectory();
			await new RecordedRunsFixture(runs).write();

			const report = await corpusReport(directorySource(root), runs);

			expect(report.refusals).toEqual([
				"agents/aardvark.md is a link whose target is missing, so the bytes it names cannot be read",
				"agents/escape.md resolves outside the tree it is named under, so its bytes are not the ones that tree holds",
			]);
		});

		it("names the refused entry without an absolute path", async () => {
			const report = await reportOverEscapingSkills();

			expect(report.refusals).toEqual([
				"skills/escape.md resolves outside the tree it is named under, so its bytes are not the ones that tree holds",
			]);
		});

		it("carries no corpus root digest, since a digest over a partial tree names a corpus nobody holds", async () => {
			const report = await reportOverEscapingSkills();

			expect(report.digest).toBeUndefined();
		});
	});

	it("reports the refusal for a symlinked directory under a layout directory, rather than what it points at", async () => {
		const root = await fullCorpusDirectory();
		const outside = await corpusDirectory();
		await writeFile(join(outside, "control.key"), "secret bytes\n");
		await symlink(outside, join(root, "skills", "escape"));
		const runs = await corpusDirectory();
		await new RecordedRunsFixture(runs).write();

		const report = await corpusReport(directorySource(root), runs);

		expect(report.files.map(({ path }) => path)).toEqual(["CLAUDE.md"]);
		expect(report.refusals).toEqual([
			"skills/escape resolves outside the tree it is named under, so its bytes are not the ones that tree holds",
		]);
		expect(JSON.stringify(report.refusals)).not.toContain("control.key");
	});

	it("redacts an absolute path out of a refusal, since a refusal is served to a browser", async () => {
		const root = await fullCorpusDirectory();
		const outside = await corpusDirectory();
		await symlink(outside, join(root, "agents"));
		const runs = await corpusDirectory();
		await new RecordedRunsFixture(runs).write();

		const report = await corpusReport(directorySource(root), runs);

		expect(report.refusals).toEqual([
			"agents resolves outside the tree it is named under, so its bytes are not the ones that tree holds",
		]);
	});

	it("rejects when a layout directory cannot be read at all, rather than reporting the failure as a refusal", async () => {
		const root = await fullCorpusDirectory();
		await mkdir(join(root, "agents"), { recursive: true });
		await writeFile(join(root, "agents", "unreadable.md"), "an agent\n");
		await chmod(join(root, "agents", "unreadable.md"), 0o000);
		const runs = await corpusDirectory();
		await new RecordedRunsFixture(runs).write();

		const failure = await failureOf(corpusReport(directorySource(root), runs));

		expect(failure).not.toBeInstanceOf(SymlinkedEntryError);
		expect(failure.message).toContain("EACCES");
	});

	it("names the refusal rather than the read failure, so an unreadable file cannot hide an escaping one", async () => {
		const root = await fullCorpusDirectory();
		const outside = await corpusDirectory();
		await writeFile(join(outside, "secret.md"), "secret bytes\n");
		await mkdir(join(root, "agents"), { recursive: true });
		await symlink(
			join(outside, "secret.md"),
			join(root, "agents", "escape.md"),
		);
		await writeFile(join(root, "agents", "zz-unreadable.md"), "an agent\n");
		await chmod(join(root, "agents", "zz-unreadable.md"), 0o000);
		const runs = await corpusDirectory();
		await new RecordedRunsFixture(runs).write();

		const report = await corpusReport(directorySource(root), runs);

		expect(report.refusals).toEqual([
			"agents/escape.md resolves outside the tree it is named under, so its bytes are not the ones that tree holds",
		]);
		expect(JSON.stringify(report.refusals)).not.toContain("EACCES");
	});

	it("reports a rulebook file exactly once, not once per list that carries it", async () => {
		const root = await fullCorpusDirectory();
		await mkdir(join(root, "rulebook"), { recursive: true });
		await writeFile(join(root, "rulebook", "coding-style.md"), "style\n");
		const runs = await corpusDirectory();
		await new RecordedRunsFixture(runs).write();

		const report = await corpusReport(directorySource(root), runs);

		expect(
			report.files.filter(({ path }) => path === "rulebook/coding-style.md"),
		).toHaveLength(1);
	});

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
	it("refuses a corpus root whose CLAUDE.md is a symlink to a file outside it, naming it rather than throwing", async () => {
		const root = await corpusDirectory();
		const outside = await corpusDirectory();
		await writeFile(join(outside, "secret.md"), "SECRET BYTES\n");
		await symlink(join(outside, "secret.md"), join(root, "CLAUDE.md"));
		const runs = await runsDirectory();

		const report = await corpusReport(directorySource(root), runs);

		expect(report.refusals).toEqual([
			"Corpus file CLAUDE.md resolves outside the corpus source, which would hash bytes the corpus does not hold",
		]);
		expect(report.digest).toBeUndefined();
		expect(JSON.stringify(report)).not.toContain("SECRET BYTES");
	});

	it("refuses a CLAUDE.md whose link target is gone, rather than reporting the corpus as one that has none", async () => {
		const root = await corpusDirectory();
		await symlink(join(root, "does-not-exist.md"), join(root, "CLAUDE.md"));
		const runs = await runsDirectory();

		const report = await corpusReport(directorySource(root), runs);

		expect(report.refusals).toEqual([
			"Corpus file CLAUDE.md is a link whose target is missing, so the bytes it names cannot be read",
		]);
		expect(report.digest).toBeUndefined();
	});

	it("refuses a CLAUDE.md the harness cannot read, naming it rather than failing the screen", async () => {
		const root = await corpusDirectory();
		await writeFile(join(root, "CLAUDE.md"), "instructions\n");
		await chmod(join(root, "CLAUDE.md"), 0o000);
		const runs = await runsDirectory();

		const report = await corpusReport(directorySource(root), runs);

		expect(report.refusals).toEqual([
			"Corpus file CLAUDE.md cannot be read, so its bytes cannot be hashed",
		]);
		expect(report.digest).toBeUndefined();
	});

	it("refuses a CLAUDE.md that points at itself, rather than failing the screen with the loop error", async () => {
		const root = await corpusDirectory();
		await symlink(join(root, "CLAUDE.md"), join(root, "CLAUDE.md"));
		const runs = await runsDirectory();

		const report = await corpusReport(directorySource(root), runs);

		expect(report.refusals).toEqual([
			"Corpus file CLAUDE.md is a link that never resolves to a file, so it names no bytes",
		]);
		expect(report.digest).toBeUndefined();
	});

	it("refuses a CLAUDE.md that is a symlink to a directory, since a directory holds no instruction bytes", async () => {
		const root = await corpusDirectory();
		const outside = await corpusDirectory();
		await writeFile(join(outside, "secret.md"), "SECRET BYTES\n");
		await symlink(outside, join(root, "CLAUDE.md"));
		const runs = await runsDirectory();

		const report = await corpusReport(directorySource(root), runs);

		expect(report.refusals).toEqual([
			"Corpus file CLAUDE.md is a directory, so it holds no instruction bytes to hash",
		]);
		expect(report.digest).toBeUndefined();
	});

	it("reports no refusal for a corpus root that simply has no CLAUDE.md", async () => {
		const root = await corpusDirectory();
		await mkdir(join(root, "skills", "build"), { recursive: true });
		await writeFile(join(root, "skills", "build", "SKILL.md"), "a skill\n");

		const report = await corpusReport(
			directorySource(root),
			await runsDirectory(),
		);

		expect(report.refusals).toEqual([]);
		expect(report.files.map(({ path }) => path)).toEqual([
			"skills/build/SKILL.md",
		]);
	});

	it("reports a root reached through a symlinked parent directory, since the link does not leave the corpus", async () => {
		const parent = await corpusDirectory();
		const root = join(parent, "corpus");
		await mkdir(root, { recursive: true });
		await writeFile(join(root, "CLAUDE.md"), "instructions\n");
		const linkedParent = join(await corpusDirectory(), "link");
		await symlink(parent, linkedParent);

		const report = await corpusReport(
			directorySource(join(linkedParent, "corpus")),
			await runsDirectory(),
		);

		expect(report.files.map(({ path }) => path)).toEqual(["CLAUDE.md"]);
	});
});
