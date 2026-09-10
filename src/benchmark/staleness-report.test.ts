import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CASES_DIRECTORY } from "./case";
import { CONTROL_DIR } from "./config";
import { resolveCorpusSource } from "./corpus-source";
import {
	directorySource,
	RecordedRunsFixture,
} from "./run-records-test-support";
import { TestResources } from "./test-support";
import { staleCases, staleCheckpoints } from "./staleness-report";

const HALF_WRITTEN_UUID = "0f6b6f2a-0000-4000-8000-00000000000f";
const EARLY = new Date("2026-09-01T00:00:00.000Z");
const LATE = new Date("2026-09-02T00:00:00.000Z");

describe(staleCheckpoints.name, () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
		);
	});

	async function temporaryDirectory(prefix: string): Promise<string> {
		const root = await mkdtemp(join(tmpdir(), prefix));
		roots.push(root);

		return root;
	}

	async function corpusDirectory(buildSkill: string): Promise<string> {
		const root = await temporaryDirectory("rehearsal-stale-corpus-");
		await mkdir(join(root, "skills", "build"), { recursive: true });
		await mkdir(join(root, "skills", "discuss"), { recursive: true });
		await mkdir(join(root, "skills", "doctrine"), { recursive: true });
		await Bun.write(join(root, "CLAUDE.md"), "the instructions\n");
		await Bun.write(join(root, "skills", "build", "SKILL.md"), buildSkill);
		await Bun.write(
			join(root, "skills", "discuss", "SKILL.md"),
			"discuss skill\n",
		);
		await Bun.write(
			join(root, "skills", "doctrine", "principles.md"),
			"the doctrine\n",
		);

		return root;
	}

	async function writtenFixture(): Promise<RecordedRunsFixture> {
		const root = await temporaryDirectory("rehearsal-stale-");
		const fixture = new RecordedRunsFixture(root);
		await fixture.write();

		return fixture;
	}

	it("names the stage whose recorded corpus no longer matches, with its cause", async () => {
		const fixture = await writtenFixture();
		const corpus = await corpusDirectory("build skill, edited\n");
		await fixture.recordCorpusFrom(
			directorySource(await corpusDirectory("build skill\n")),
		);

		const stale = await staleCheckpoints(
			fixture.runsDirectory,
			directorySource(corpus),
		);

		expect(stale.map(({ id }) => id)).toEqual([
			`checkpoint:${fixture.replayableRun}/build`,
		]);
		expect(stale.at(0)?.causes.join(" ")).toContain("skills/build/SKILL.md");
	});

	it("names no checkpoint when the corpus still holds the recorded bytes", async () => {
		const fixture = await writtenFixture();
		const corpus = await corpusDirectory("build skill\n");
		await fixture.recordCorpusFrom(directorySource(corpus));

		const stale = await staleCheckpoints(
			fixture.runsDirectory,
			directorySource(corpus),
		);

		expect(stale).toEqual([]);
	});

	describe("when no corpus is named, which is the live install", () => {
		it("answers over a runs directory holding no run, reaching no skill", async () => {
			const runsDirectory = await temporaryDirectory("rehearsal-stale-live-");

			const stale = await staleCheckpoints(
				runsDirectory,
				await resolveCorpusSource(undefined),
			);

			expect(stale).toEqual([]);
		});
	});

	describe("when the corpus holds no CLAUDE.md", () => {
		it("answers for the runs it can read without reading instructions", async () => {
			const root = await temporaryDirectory("rehearsal-stale-styles-");
			await Bun.write(join(root, "output-styles", "brief.md"), "brief style\n");
			const runsDirectory = await temporaryDirectory("rehearsal-stale-empty-");

			const stale = await staleCheckpoints(runsDirectory, {
				kind: "directory",
				root,
			});

			expect(stale).toEqual([]);
		});
	});

	describe("when a corpus directory holds a symlink out of the tree", () => {
		it("stales the stage that reads it, naming the entry as the cause", async () => {
			const fixture = await writtenFixture();
			const corpus = await corpusDirectory("build skill\n");
			await fixture.recordCorpusFrom(directorySource(corpus));
			await symlink(
				join(corpus, "CLAUDE.md"),
				join(corpus, "skills", "build", "escape.md"),
			);

			const stale = await staleCheckpoints(
				fixture.runsDirectory,
				directorySource(corpus),
			);

			expect(stale.map(({ id }) => id)).toEqual([
				`checkpoint:${fixture.replayableRun}/build`,
			]);
			expect(stale.at(0)?.causes.join(" ")).toContain("skills/build/escape.md");
		});

		it("judges a stage that does not read the broken tree normally", async () => {
			const fixture = await writtenFixture();
			const corpus = await corpusDirectory("build skill\n");
			await fixture.recordCorpusFrom(directorySource(corpus));
			await symlink(
				join(corpus, "CLAUDE.md"),
				join(corpus, "skills", "build", "escape.md"),
			);

			const stale = await staleCheckpoints(
				fixture.runsDirectory,
				directorySource(corpus),
			);

			expect(stale.map(({ id }) => id)).not.toContain(
				`checkpoint:${fixture.replayableRun}/discuss`,
			);
		});

		it("names no absolute filesystem path in the cause", async () => {
			const fixture = await writtenFixture();
			const corpus = await corpusDirectory("build skill\n");
			await fixture.recordCorpusFrom(directorySource(corpus));
			await symlink(
				join(corpus, "CLAUDE.md"),
				join(corpus, "skills", "build", "escape.md"),
			);

			const stale = await staleCheckpoints(
				fixture.runsDirectory,
				directorySource(corpus),
			);

			expect(stale.flatMap(({ causes }) => causes).join(" ")).not.toContain(
				corpus,
			);
		});
	});

	describe("when the session about to replay names another model", () => {
		it("names every checkpoint the recorded model no longer matches", async () => {
			const fixture = await writtenFixture();
			const corpus = await corpusDirectory("build skill\n");
			await fixture.recordCorpusFrom(directorySource(corpus));

			const stale = await staleCheckpoints(
				fixture.runsDirectory,
				directorySource(corpus),
				{ model: "opus" },
			);

			expect(stale.map(({ id }) => id)).toEqual([
				`checkpoint:${fixture.replayableRun}/discuss`,
				`checkpoint:${fixture.replayableRun}/build`,
			]);
			expect(stale.at(0)?.causes).toContain("model sonnet is now opus");
		});
	});

	describe("when the session about to replay names another effort", () => {
		it("names every checkpoint the recorded effort no longer matches", async () => {
			const fixture = await writtenFixture();
			const corpus = await corpusDirectory("build skill\n");
			await fixture.recordCorpusFrom(directorySource(corpus));

			const stale = await staleCheckpoints(
				fixture.runsDirectory,
				directorySource(corpus),
				{ effort: "high" },
			);

			expect(stale.at(0)?.causes).toContain("effort none is now high");
		});
	});
});

describe(staleCases.name, () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
		);
	});

	async function styleCorpus(brief: string): Promise<string> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-case-corpus-"));
		roots.push(root);
		await mkdir(join(root, "output-styles"), { recursive: true });
		await Bun.write(join(root, "output-styles", "brief.md"), brief);

		return root;
	}

	async function runsWithSmokeAttempt(corpusRoot: string): Promise<string> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-case-stale-"));
		roots.push(root);
		const fixture = new RecordedRunsFixture(root);
		await fixture.writeAttemptReading(corpusRoot, "smoke", [
			"output-styles/brief.md",
		]);

		return root;
	}

	it("names each declared corpus file whose digest the attempt no longer matches", async () => {
		const runsDirectory = await runsWithSmokeAttempt(
			await styleCorpus("the brief style\n"),
		);

		const report = await staleCases(
			runsDirectory,
			directorySource(await styleCorpus("the brief style, edited\n")),
		);

		expect(report.records.map(({ id }) => id)).toEqual(["case:smoke"]);
		expect(report.records.at(0)?.causes).toEqual([
			"output-styles/brief.md changed",
		]);
	});

	it("names no case when the corpus still holds the recorded bytes", async () => {
		const corpus = await styleCorpus("the brief style\n");
		const runsDirectory = await runsWithSmokeAttempt(corpus);

		const report = await staleCases(runsDirectory, directorySource(corpus));

		expect(report.records).toEqual([]);
	});

	it("names an out-of-extent live file as a stale cause instead of freshness", async () => {
		const recordedCorpus = await styleCorpus("the brief style\n");
		const runsDirectory = await runsWithSmokeAttempt(recordedCorpus);
		const root = await mkdtemp(join(tmpdir(), "rehearsal-live-install-"));
		const backingRoot = await mkdtemp(join(tmpdir(), "rehearsal-live-backing-"));
		const outside = await styleCorpus("FOREIGN STYLE\n");
		roots.push(root, backingRoot);
		await mkdir(join(root, "output-styles"), { recursive: true });
		await symlink(
			join(outside, "output-styles", "brief.md"),
			join(root, "output-styles", "brief.md"),
		);

		const report = await staleCases(runsDirectory, {
			kind: "live",
			root,
			backingRoot,
		});

		expect(report.records).toEqual([
			{
				id: "case:smoke",
				causes: [
					"Corpus file output-styles/brief.md resolves outside the live corpus extent, which would hash bytes the corpus does not hold",
				],
			},
		]);
	});

	describe("when a case has two attempts", () => {
		const OLDER = "0f6b6f2a-0000-4000-8000-00000000000a";
		const NEWER = "0f6b6f2a-0000-4000-8000-00000000000b";

		/**
		 * Recency is decided by the record file's modification time, because the
		 * attempt record carries no timestamp and a uuid gives no order. Setting
		 * both times explicitly is what makes the choice observable rather than
		 * an accident of which uuid `readdir` happened to yield first.
		 */
		async function twoAttempts(
			olderCorpus: string,
			newerCorpus: string,
		): Promise<string> {
			const root = await mkdtemp(join(tmpdir(), "rehearsal-case-two-"));
			roots.push(root);
			const fixture = new RecordedRunsFixture(root);
			const older = await fixture.writeAttemptAt(OLDER, olderCorpus, "smoke", [
				"output-styles/brief.md",
			]);
			const newer = await fixture.writeAttemptAt(NEWER, newerCorpus, "smoke", [
				"output-styles/brief.md",
			]);
			await utimes(older, EARLY, EARLY);
			await utimes(newer, LATE, LATE);

			return root;
		}

		it("answers from the most recent one", async () => {
			const corpus = await styleCorpus("the brief style\n");
			const runsDirectory = await twoAttempts(
				await styleCorpus("some older style\n"),
				corpus,
			);

			const report = await staleCases(runsDirectory, directorySource(corpus));

			expect(report.records).toEqual([]);
		});

		it("ignores the older one even when the corpus still matches it", async () => {
			const older = await styleCorpus("some older style\n");
			const runsDirectory = await twoAttempts(
				older,
				await styleCorpus("the brief style\n"),
			);

			const report = await staleCases(runsDirectory, directorySource(older));

			expect(report.records.map(({ id }) => id)).toEqual(["case:smoke"]);
		});
	});

	describe("when one attempt record cannot be read", () => {
		it("names it as unreadable and still answers for the case", async () => {
			const corpus = await styleCorpus("the brief style\n");
			const runsDirectory = await runsWithSmokeAttempt(corpus);
			const fixture = new RecordedRunsFixture(runsDirectory);
			await fixture.writeUnreadableAttempt("smoke", HALF_WRITTEN_UUID);

			const report = await staleCases(
				runsDirectory,
				directorySource(await styleCorpus("the brief style, edited\n")),
			);

			expect(report.records.map(({ id }) => id)).toEqual(["case:smoke"]);
			expect(report.unreadable.map(({ id }) => id)).toEqual([
				`attempt:session:smoke/${HALF_WRITTEN_UUID}`,
			]);
		});
	});

	describe("when a case declaration cannot be read", () => {
		const resources = TestResources.forEachTest();

		it("names it as unreadable rather than reading as fresh", async () => {
			const stray = join(CONTROL_DIR, CASES_DIRECTORY, "zz-stale-probe");
			resources.track(stray);
			await mkdir(stray, { recursive: true });
			const root = await mkdtemp(join(tmpdir(), "rehearsal-case-unread-"));
			roots.push(root);

			const report = await staleCases(
				root,
				directorySource(await styleCorpus("the brief style\n")),
			);

			expect(report.unreadable.map(({ id }) => id)).toEqual([
				"case:zz-stale-probe",
			]);
		});
	});

	describe("when a case has no recorded attempt", () => {
		it("names no case, because nothing was invalidated", async () => {
			const root = await mkdtemp(join(tmpdir(), "rehearsal-case-none-"));
			roots.push(root);

			const report = await staleCases(
				root,
				directorySource(await styleCorpus("the brief style\n")),
			);

			expect(report.records).toEqual([]);
		});
	});
});
