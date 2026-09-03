import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CorpusSourceDependencies } from "#benchmark/corpus-source";
import { RecordedRunsFixture } from "#benchmark/run-records-test-support";
import { failureOf, recordOutput } from "#cli/cli-test-support";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import { runStale } from "#cli/stale-command";

const HALF_WRITTEN_UUID = "0f6b6f2a-0000-4000-8000-00000000000f";

interface RecordedRunner {
	readonly dependencies: CorpusSourceDependencies;
	readonly commands: readonly (readonly string[])[];
}

/**
 * `stale` must reach no provider and no git, so the one command seam it could
 * use is faked and asserted empty rather than left to the real runner.
 */
function refusingRunner(): RecordedRunner {
	const commands: (readonly string[])[] = [];

	return {
		commands,
		dependencies: {
			runCommand: (command) => {
				commands.push(command);

				return Promise.reject(new Error("stale ran a command"));
			},
			dotfilesDirectory: "/nowhere",
		},
	};
}

async function treeOf(root: string): Promise<readonly string[]> {
	const entries = await readdir(root, { recursive: true });

	return entries.toSorted((left, right) => (left < right ? -1 : 1));
}

describe(runStale.name, () => {
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
		const root = await temporaryDirectory("rehearsal-stale-cli-corpus-");
		for (const skill of ["build", "discuss", "doctrine"]) {
			await mkdir(join(root, "skills", skill), { recursive: true });
			await Bun.write(
				join(root, "skills", skill, "SKILL.md"),
				skill === "build" ? buildSkill : `${skill} skill\n`,
			);
		}
		await mkdir(join(root, "output-styles"), { recursive: true });
		await Bun.write(join(root, "output-styles", "brief.md"), "brief style\n");
		await Bun.write(join(root, "CLAUDE.md"), "the instructions\n");

		return root;
	}

	async function fixtureRecordedAgainst(
		corpusRoot: string,
	): Promise<RecordedRunsFixture> {
		const root = await temporaryDirectory("rehearsal-stale-cli-");
		const fixture = new RecordedRunsFixture(root);
		await fixture.write();
		await fixture.recordCorpusFrom(corpusRoot);
		await fixture.writeAttemptReading(corpusRoot, "smoke", [
			"output-styles/brief.md",
		]);

		return fixture;
	}

	it("names each stale checkpoint with its causes, and no fresh one", async () => {
		const fixture = await fixtureRecordedAgainst(
			await corpusDirectory("build skill\n"),
		);
		const runner = refusingRunner();
		const recorder = recordOutput();

		await runStale(
			{
				corpus: await corpusDirectory("build skill, edited\n"),
				runsDirectory: fixture.runsDirectory,
			},
			{ output: recorder.output, corpusSource: runner.dependencies },
		);

		const printed = recorder.stdout.join("").trimEnd().split("\n");
		expect(printed).toHaveLength(1);
		expect(printed.at(0)).toContain(
			`checkpoint:${fixture.replayableRun}/build`,
		);
		expect(printed.at(0)).toContain("skills/build/SKILL.md changed");
	});

	it("names no checkpoint when the corpus holds the recorded bytes", async () => {
		const corpus = await corpusDirectory("build skill\n");
		const fixture = await fixtureRecordedAgainst(corpus);
		const recorder = recordOutput();

		await runStale(
			{
				corpus,
				runsDirectory: fixture.runsDirectory,
			},
			{ output: recorder.output, corpusSource: refusingRunner().dependencies },
		);

		expect(recorder.stdout).toEqual([]);
	});

	it("names a stale session case beside the stale checkpoints", async () => {
		const fixture = await fixtureRecordedAgainst(
			await corpusDirectory("build skill\n"),
		);
		const edited = await corpusDirectory("build skill, edited\n");
		await Bun.write(
			join(edited, "output-styles", "brief.md"),
			"brief style, edited\n",
		);
		const recorder = recordOutput();

		await runStale(
			{
				corpus: edited,
				runsDirectory: fixture.runsDirectory,
			},
			{ output: recorder.output, corpusSource: refusingRunner().dependencies },
		);

		const printed = recorder.stdout.join("").trimEnd().split("\n");
		expect(printed.map((line) => line.split("\t")[0])).toEqual([
			`checkpoint:${fixture.replayableRun}/build`,
			"case:smoke",
		]);
		expect(printed.at(1)).toContain("output-styles/brief.md changed");
	});

	it("starts no session, runs no command, and writes no file", async () => {
		const corpus = await corpusDirectory("build skill, edited\n");
		const fixture = await fixtureRecordedAgainst(
			await corpusDirectory("build skill\n"),
		);
		const runner = refusingRunner();
		const before = await treeOf(fixture.runsDirectory);

		await runStale(
			{
				corpus,
				runsDirectory: fixture.runsDirectory,
			},
			{ output: recordOutput().output, corpusSource: runner.dependencies },
		);

		expect(runner.commands).toEqual([]);
		expect(await treeOf(fixture.runsDirectory)).toEqual(before);
	});

	describe("when the session names a model the run was not recorded at", () => {
		it("names every checkpoint stale on the model, corpus unchanged", async () => {
			const corpus = await corpusDirectory("build skill\n");
			const fixture = await fixtureRecordedAgainst(corpus);
			const recorder = recordOutput();

			await runStale(
				{
					corpus,
					model: "opus",
					effort: undefined,
					runsDirectory: fixture.runsDirectory,
				},
				{
					output: recorder.output,
					corpusSource: refusingRunner().dependencies,
				},
			);

			const printed = recorder.stdout.join("").trimEnd().split("\n");
			expect(printed.map((line) => line.split("\t")[0])).toEqual([
				`checkpoint:${fixture.replayableRun}/discuss`,
				`checkpoint:${fixture.replayableRun}/build`,
			]);
			expect(printed.at(0)).toContain("model sonnet is now opus");
		});
	});

	describe("when one attempt record cannot be read", () => {
		it("still prints the stale checkpoints and names it on stderr", async () => {
			const fixture = await fixtureRecordedAgainst(
				await corpusDirectory("build skill\n"),
			);
			await fixture.writeUnreadableAttempt("smoke", HALF_WRITTEN_UUID);
			const recorder = recordOutput();

			await runStale(
				{
					corpus: await corpusDirectory("build skill, edited\n"),
					runsDirectory: fixture.runsDirectory,
				},
				{
					output: recorder.output,
					corpusSource: refusingRunner().dependencies,
				},
			);

			expect(
				recorder.stdout
					.join("")
					.trimEnd()
					.split("\n")
					.map((printed) => printed.split("\t")[0]),
			).toEqual([`checkpoint:${fixture.replayableRun}/build`]);
			expect(recorder.stderr.join("")).toContain(
				`attempt:session:smoke/${HALF_WRITTEN_UUID}`,
			);
		});
	});

	describe("when --corpus names a directory that does not exist", () => {
		it("refuses the precondition and prints nothing on stdout", async () => {
			const fixture = await fixtureRecordedAgainst(
				await corpusDirectory("build skill\n"),
			);
			const recorder = recordOutput();

			const failure = await failureOf(
				runStale(
					{
						corpus: join(await temporaryDirectory("rehearsal-absent-"), "gone"),
						model: undefined,
						effort: undefined,
						runsDirectory: fixture.runsDirectory,
					},
					{
						output: recorder.output,
						corpusSource: refusingRunner().dependencies,
					},
				),
			);

			expect(failure).toBeInstanceOf(RefusedPreconditionError);
			expect(failure.message).toContain("gone");
			expect(recorder.stdout).toEqual([]);
		});
	});
});
