import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PipelineDefinition } from "#benchmark/pipeline";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import { failureOf, recordOutput } from "#cli/cli-test-support";
import { runRunCommand } from "#cli/run-command";

const args = [
	"--target",
	"/nonexistent-target",
	"--model",
	"sonnet",
	"--judge-model",
	"opus",
	"--session-budget-usd",
	"1",
];

const pipeline: PipelineDefinition = {
	statuses: ["To Do", "Build", "Done"],
	target: { checks: [], integrityFiles: [] },
	stages: [{ name: "build", kind: "delivery", skill: "build", rubric: "b" }],
};

describe(runRunCommand.name, () => {
	const temporaryDirectories: string[] = [];

	afterEach(async () => {
		await Promise.all(
			temporaryDirectories
				.splice(0)
				.map((directory) => rm(directory, { force: true, recursive: true })),
		);
	});

	it("refuses before loading the pipeline when stdin is not a terminal", async () => {
		const loaded: string[] = [];
		const { output, stdout, stderr } = recordOutput();

		const failure = await failureOf(
			runRunCommand(
				{ args, json: false, stdinIsTerminal: false },
				{
					output,
					loadPipeline: (path) => {
						loaded.push(path);

						return Promise.reject(new Error("pipeline must not load"));
					},
					execute: () => Promise.reject(new Error("run must not start")),
				},
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure.message).toContain("review pause");
		expect(failure.message).toContain("ACT-26.3");
		expect(loaded).toEqual([]);
		expect(stdout).toEqual([]);
		expect(stderr).toEqual([]);
	});

	it("runs the confirmation group without a terminal when --yes answers the approval", async () => {
		const { output, stdout } = recordOutput();

		await runRunCommand(
			{
				args: [...args, "--confirm", "--yes"],
				json: false,
				stdinIsTerminal: false,
			},
			{
				output,
				loadPipeline: () => Promise.resolve(pipeline),
				execute: () =>
					Promise.resolve({
						kind: "confirmation" as const,
						recordFile: "/runs/report.json",
					}),
			},
		);

		expect(stdout.join("")).toBe("/runs/report.json\n");
	});

	it("refuses a confirmation group without a terminal when --yes is absent", async () => {
		const { output } = recordOutput();

		const failure = await failureOf(
			runRunCommand(
				{
					args: [...args, "--confirm"],
					json: false,
					stdinIsTerminal: false,
				},
				{
					output,
					loadPipeline: () =>
						Promise.reject(new Error("pipeline must not load")),
					execute: () => Promise.reject(new Error("run must not start")),
				},
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
	});

	it("prints the run artifact path on stdout and diagnostics on stderr", async () => {
		const { output, stdout, stderr } = recordOutput();

		await runRunCommand(
			{ args, json: false, stdinIsTerminal: true },
			{
				output,
				loadPipeline: () => Promise.resolve(pipeline),
				execute: (_config, commandOutput) => {
					commandOutput.stderr("Target: /nonexistent-target\n");

					return Promise.resolve({
						kind: "debug" as const,
						recordFile: "/runs/2026.json",
					});
				},
			},
		);

		expect(stdout.join("")).toBe("/runs/2026.json\n");
		expect(stderr.join("")).toBe("Target: /nonexistent-target\n");
	});

	it("warns once on stderr about a same-family Judge before loading the pipeline", async () => {
		const events: string[] = [];
		const { output, stdout } = recordOutput();

		await runRunCommand(
			{
				args: [
					"--target",
					"/nonexistent-target",
					"--model",
					"sonnet",
					"--judge-model",
					"claude-sonnet-4-6",
					"--session-budget-usd",
					"1",
				],
				json: false,
				stdinIsTerminal: true,
			},
			{
				output: {
					stdout: output.stdout,
					stderr: (text) => {
						events.push(text);
						output.stderr(text);
					},
				},
				loadPipeline: () => {
					events.push("load-pipeline");

					return Promise.resolve(pipeline);
				},
				execute: () =>
					Promise.resolve({
						kind: "debug" as const,
						recordFile: "/runs/2026.json",
					}),
			},
		);

		expect(
			events.filter((event) => event.includes("Self-preference warning")),
		).toHaveLength(1);
		expect(events.indexOf("load-pipeline")).toBe(1);
		expect(stdout.join("")).toBe("/runs/2026.json\n");
	});

	it("prints the run artifact's exact bytes on stdout with --json", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-run-json-"));
		temporaryDirectories.push(directory);
		const recordFile = join(directory, "artifact.json");
		const recordText = `${JSON.stringify({ schemaVersion: 1, status: "COMPLETE" }, null, 2)}\n`;
		await Bun.write(recordFile, recordText);
		const { output, stdout, stderr } = recordOutput();

		await runRunCommand(
			{ args, json: true, stdinIsTerminal: true },
			{
				output,
				loadPipeline: () => Promise.resolve(pipeline),
				execute: () => Promise.resolve({ kind: "debug" as const, recordFile }),
			},
		);

		expect(stdout.join("")).toBe(recordText);
		expect(stdout.join("")).toBe(await Bun.file(recordFile).text());
		expect(stderr).toEqual([]);
	});
});
