import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RecordedRunsFixture } from "./run-records-test-support";
import { staleCases, staleCheckpoints } from "./staleness-report";

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
		await fixture.recordCorpusFrom(await corpusDirectory("build skill\n"));

		const stale = await staleCheckpoints(fixture.runsDirectory, {
			kind: "directory",
			root: corpus,
		});

		expect(stale.map(({ id }) => id)).toEqual([
			`checkpoint:${fixture.replayableRun}/build`,
		]);
		expect(stale.at(0)?.causes.join(" ")).toContain("skills/build/SKILL.md");
	});

	it("names no checkpoint when the corpus still holds the recorded bytes", async () => {
		const fixture = await writtenFixture();
		const corpus = await corpusDirectory("build skill\n");
		await fixture.recordCorpusFrom(corpus);

		const stale = await staleCheckpoints(fixture.runsDirectory, {
			kind: "directory",
			root: corpus,
		});

		expect(stale).toEqual([]);
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

		const stale = await staleCases(runsDirectory, {
			kind: "directory",
			root: await styleCorpus("the brief style, edited\n"),
		});

		expect(stale.map(({ id }) => id)).toEqual(["case:smoke"]);
		expect(stale.at(0)?.causes).toEqual(["output-styles/brief.md changed"]);
	});

	it("names no case when the corpus still holds the recorded bytes", async () => {
		const corpus = await styleCorpus("the brief style\n");
		const runsDirectory = await runsWithSmokeAttempt(corpus);

		const stale = await staleCases(runsDirectory, {
			kind: "directory",
			root: corpus,
		});

		expect(stale).toEqual([]);
	});

	describe("when a case has no recorded attempt", () => {
		it("names no case, because nothing was invalidated", async () => {
			const root = await mkdtemp(join(tmpdir(), "rehearsal-case-none-"));
			roots.push(root);

			const stale = await staleCases(root, {
				kind: "directory",
				root: await styleCorpus("the brief style\n"),
			});

			expect(stale).toEqual([]);
		});
	});
});
