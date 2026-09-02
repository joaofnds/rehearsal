import { describe, expect, it } from "bun:test";
import type { PipelineDefinition } from "#benchmark/pipeline";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import type { CommandOutput } from "#cli/output";
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

interface OutputRecorder {
	readonly output: CommandOutput;
	readonly stdout: readonly string[];
	readonly stderr: readonly string[];
}

function recorder(): OutputRecorder {
	const stdout: string[] = [];
	const stderr: string[] = [];

	return {
		stdout,
		stderr,
		output: {
			stdout: (text) => {
				stdout.push(text);
			},
			stderr: (text) => {
				stderr.push(text);
			},
		},
	};
}

async function failureOf(work: Promise<void>): Promise<Error> {
	try {
		await work;
	} catch (error) {
		return error instanceof Error ? error : new Error(String(error));
	}

	throw new Error("Expected the command to fail");
}

const pipeline: PipelineDefinition = {
	statuses: ["To Do", "Build", "Done"],
	target: { checks: [], integrityFiles: [] },
	stages: [{ name: "build", kind: "delivery", skill: "build", rubric: "b" }],
};

describe(runRunCommand.name, () => {
	it("refuses before loading the pipeline when stdin is not a terminal", async () => {
		const loaded: string[] = [];
		const { output, stdout, stderr } = recorder();

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

	it("prints the run artifact path on stdout and diagnostics on stderr", async () => {
		const { output, stdout, stderr } = recorder();

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
});
