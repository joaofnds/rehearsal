import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import { failureOf, recordOutput } from "#cli/cli-test-support";
import { runReplayCommand } from "#cli/replay-command";

const sessionArgs = [
	"--model",
	"sonnet",
	"--judge-model",
	"opus",
	"--session-budget-usd",
	"1",
];

describe(runReplayCommand.name, () => {
	const temporaryDirectories: string[] = [];

	afterEach(async () => {
		await Promise.all(
			temporaryDirectories
				.splice(0)
				.map((directory) => rm(directory, { force: true, recursive: true })),
		);
	});

	it("refuses a confirmation without --yes before resolving the run, when stdin is not a terminal", async () => {
		const resolved: string[] = [];
		const { output, stdout, stderr } = recordOutput();

		const failure = await failureOf(
			runReplayCommand(
				{
					args: [
						"--run",
						"any-name",
						"--stage",
						"shape",
						...sessionArgs,
						"--confirm",
					],
					json: false,
					stdinIsTerminal: false,
				},
				{
					output,
					resolveRunDirectory: (name) => {
						resolved.push(name);

						return Promise.resolve("/runs/any-name");
					},
					execute: () => Promise.reject(new Error("replay must not run")),
				},
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(resolved).toEqual([]);
		expect(stdout).toEqual([]);
		expect(stderr.join("")).not.toContain("Projected maximum cost");
	});

	it("does not check for a terminal when --yes answers the approval", async () => {
		const resolved: string[] = [];
		const { output } = recordOutput();

		const failure = await failureOf(
			runReplayCommand(
				{
					args: [
						"--run",
						"any-name",
						"--stage",
						"shape",
						...sessionArgs,
						"--confirm",
						"--yes",
					],
					json: false,
					stdinIsTerminal: false,
				},
				{
					output,
					resolveRunDirectory: (name) => {
						resolved.push(name);

						return Promise.reject(new Error(`No replayable run named ${name}`));
					},
					execute: () => Promise.reject(new Error("replay must not run")),
				},
			),
		);

		expect(failure).not.toBeInstanceOf(RefusedPreconditionError);
		expect(String(failure)).toContain("No replayable run named any-name");
		expect(resolved).toEqual(["any-name"]);
	});

	it("does not check for a terminal for a single debug rep", async () => {
		const resolved: string[] = [];
		const { output } = recordOutput();

		const failure = await failureOf(
			runReplayCommand(
				{
					args: ["--run", "any-name", "--stage", "shape", ...sessionArgs],
					json: false,
					stdinIsTerminal: false,
				},
				{
					output,
					resolveRunDirectory: (name) => {
						resolved.push(name);

						return Promise.reject(new Error(`No replayable run named ${name}`));
					},
					execute: () => Promise.reject(new Error("replay must not run")),
				},
			),
		);

		expect(failure).not.toBeInstanceOf(RefusedPreconditionError);
		expect(resolved).toEqual(["any-name"]);
	});

	it("prints the replay record's exact bytes on stdout with --json", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-replay-json-"));
		temporaryDirectories.push(directory);
		const recordPath = join(directory, "replay.json");
		const recordText = `${JSON.stringify({ schemaVersion: 1, stage: "shape" }, null, 2)}\n`;
		await Bun.write(recordPath, recordText);
		const { output, stdout } = recordOutput();

		await runReplayCommand(
			{
				args: ["--run", "any-name", "--stage", "shape", ...sessionArgs],
				json: true,
				stdinIsTerminal: false,
			},
			{
				output,
				resolveRunDirectory: () => Promise.resolve("/runs/any-name"),
				execute: (_config, _paths, commandOutput) => {
					commandOutput.stderr("Replay progress\n");

					return Promise.resolve({
						kind: "debug" as const,
						evidence: { recordPath, lineage: "lineage-1" },
					});
				},
			},
		);

		expect(stdout.join("")).toBe(recordText);
		expect(stdout.join("")).toBe(await Bun.file(recordPath).text());
	});
});

describe("--corpus on a stage replay", () => {
	/**
	 * A replayed stage's corpus is the skill it invokes, and a project-level
	 * skill does not shadow the user-level one, so a replay against a corpus
	 * source would record bytes the harness cannot deliver.
	 */
	it("refuses before the run directory is resolved, naming ACT-28", async () => {
		const resolved: string[] = [];
		const { output, stdout } = recordOutput();

		const failure = await failureOf(
			runReplayCommand(
				{
					args: [
						"--run",
						"any-name",
						"--stage",
						"shape",
						...sessionArgs,
						"--corpus",
						"/some/corpus",
					],
					json: false,
					stdinIsTerminal: true,
				},
				{
					output,
					resolveRunDirectory: (name) => {
						resolved.push(name);

						return Promise.resolve("/runs/any-name");
					},
					execute: () => Promise.reject(new Error("replay must not run")),
				},
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure.message).toContain("ACT-28");
		expect(resolved).toEqual([]);
		expect(stdout).toEqual([]);
	});
});
