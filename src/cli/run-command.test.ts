import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BenchmarkCase } from "#benchmark/case";
import { parseArgs } from "#benchmark/config";
import type { PipelineDefinition } from "#benchmark/pipeline";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import { failureOf, recordOutput } from "#cli/cli-test-support";
import { buildConfirmationRequest, runRunCommand } from "#cli/run-command";

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

const auditLogCase: BenchmarkCase = {
	kind: "pipeline",
	declaration: {
		id: "audit-log",
		kind: "pipeline",
		title: "Audit log",
		task: "backlog-seed.md",
		productBrief: "product-brief.md",
		finalRubric: "rubric.md",
		pipeline: "pipelines/default.json",
		rubrics: "rubrics",
		target: { path: "/declared/target" },
	},
	task: "Task",
	productBrief: "Brief",
	finalRubric: "Rubric",
	finalRubricPath: "/control/cases/audit-log/rubric.md",
	rubricsDirectory: "/control/cases/audit-log/rubrics",
	pipelinePath: "cases/audit-log/pipelines/default.json",
	pipeline,
	stageRubrics: {},
	targetPath: "/declared/target",
};

interface CaseLoader {
	readonly loaded: readonly string[];
	readonly requireCase: (id: string) => Promise<BenchmarkCase>;
}

function loadsAuditLog(): CaseLoader {
	const loaded: string[] = [];

	return {
		loaded,
		requireCase: (id) => {
			loaded.push(id);

			return Promise.resolve(auditLogCase);
		},
	};
}

describe(runRunCommand.name, () => {
	const temporaryDirectories: string[] = [];

	afterEach(async () => {
		await Promise.all(
			temporaryDirectories
				.splice(0)
				.map((directory) => rm(directory, { force: true, recursive: true })),
		);
	});

	it("refuses before the run starts when stdin is not a terminal", async () => {
		const { output, stdout, stderr } = recordOutput();

		const failure = await failureOf(
			runRunCommand(
				{ args, json: false, stdinIsTerminal: false },
				{
					output,
					requireCase: loadsAuditLog().requireCase,
					execute: () => Promise.reject(new Error("run must not start")),
				},
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure.message).toContain("review pause");
		expect(failure.message).toContain("ACT-26.3");
		expect(stdout).toEqual([]);
		expect(stderr).toEqual([]);
	});

	it("loads the case --case names, and audit-log when the flag is absent", async () => {
		const loader = loadsAuditLog();
		const { output } = recordOutput();
		const dependencies = {
			output,
			requireCase: loader.requireCase,
			execute: () =>
				Promise.resolve({
					kind: "debug" as const,
					recordFile: "/runs/2026.json",
				}),
		};

		await runRunCommand(
			{ args, json: false, stdinIsTerminal: true },
			dependencies,
		);
		await runRunCommand(
			{
				args: [...args, "--case", "other"],
				json: false,
				stdinIsTerminal: true,
			},
			dependencies,
		);

		expect(loader.loaded).toEqual(["audit-log", "other"]);
	});

	it("refuses an unknown case before the run starts", async () => {
		const { output, stdout } = recordOutput();

		const failure = await failureOf(
			runRunCommand(
				{
					args: [...args, "--case", "missing"],
					json: false,
					stdinIsTerminal: true,
				},
				{
					output,
					requireCase: (id) =>
						Promise.reject(new RefusedPreconditionError(`Unknown case ${id}`)),
					execute: () => Promise.reject(new Error("run must not start")),
				},
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure.message).toContain("missing");
		expect(stdout).toEqual([]);
	});

	it("runs the target the case declares when no flag or environment names one", async () => {
		const targets: string[] = [];
		const { output } = recordOutput();

		await runRunCommand(
			{
				args: ["--model", "sonnet", "--session-budget-usd", "1"],
				json: false,
				stdinIsTerminal: true,
			},
			{
				output,
				requireCase: loadsAuditLog().requireCase,
				execute: (config) => {
					targets.push(config.sourceDir);

					return Promise.resolve({
						kind: "debug" as const,
						recordFile: "/runs/2026.json",
					});
				},
			},
		);

		expect(targets).toEqual(["/declared/target"]);
	});

	it("hands the run the case it loaded, with the case's own pipeline", async () => {
		const executed: BenchmarkCase[] = [];
		const { output } = recordOutput();

		await runRunCommand(
			{ args, json: false, stdinIsTerminal: true },
			{
				output,
				requireCase: loadsAuditLog().requireCase,
				execute: (_config, _commandOutput, benchmarkCase) => {
					executed.push(benchmarkCase);

					return Promise.resolve({
						kind: "debug" as const,
						recordFile: "/runs/2026.json",
					});
				},
			},
		);

		expect(executed).toEqual([auditLogCase]);
	});

	it("records the overriding pipeline path when --pipeline names another file", async () => {
		const recorded: string[] = [];
		const { output } = recordOutput();

		await runRunCommand(
			{
				args: [...args, "--pipeline", "cases/audit-log/pipelines/other.json"],
				json: false,
				stdinIsTerminal: true,
			},
			{
				output,
				requireCase: () =>
					Promise.resolve({
						...auditLogCase,
						pipelinePath: "cases/audit-log/pipelines/other.json",
					}),
				execute: (config) => {
					recorded.push(config.pipelinePath);

					return Promise.resolve({
						kind: "debug" as const,
						recordFile: "/runs/2026.json",
					});
				},
			},
		);

		expect(recorded).toEqual(["cases/audit-log/pipelines/other.json"]);
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
				requireCase: loadsAuditLog().requireCase,
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
					requireCase: loadsAuditLog().requireCase,
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
				requireCase: loadsAuditLog().requireCase,
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

	it("warns once on stderr about a same-family Judge before the run starts", async () => {
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
				requireCase: (id) => {
					events.push("load-case");

					return Promise.resolve({
						...auditLogCase,
						declaration: { ...auditLogCase.declaration, id },
					});
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
		expect(events[0]).toBe("load-case");
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
				requireCase: loadsAuditLog().requireCase,
				execute: () => Promise.resolve({ kind: "debug" as const, recordFile }),
			},
		);

		expect(stdout.join("")).toBe(recordText);
		expect(stdout.join("")).toBe(await Bun.file(recordFile).text());
		expect(stderr).toEqual([]);
	});
});

describe(buildConfirmationRequest.name, () => {
	it("names the case the loaded case declares", () => {
		const followUp: BenchmarkCase = {
			...auditLogCase,
			declaration: { ...auditLogCase.declaration, id: "audit-log-follow-up" },
		};

		const request = buildConfirmationRequest({
			benchmarkCase: followUp,
			config: {
				...parseArgs(
					args,
					{},
					{
						caseId: "audit-log-follow-up",
						pipelinePath: auditLogCase.pipelinePath,
						targetPath: auditLogCase.targetPath,
					},
				),
				caseId: "audit-log-follow-up",
			},
			confirmation: {
				reps: 2,
				projectedCost: {
					reps: 2,
					perRepMaximumUsd: 1,
					totalMaximumUsd: 2,
				},
				approvalMethod: "yes",
			},
			controlSha: "a".repeat(40),
			source: { root: "/target", sha: "b".repeat(40), origin: undefined },
			instructions: "Frozen instructions\n",
		});

		expect(request.caseId).toBe("audit-log-follow-up");
	});
});
