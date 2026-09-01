import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { parseArgs, parseReplayArgs } from "./config";

describe(parseArgs.name, () => {
	it("resolves explicit configuration", () => {
		const config = parseArgs(
			[
				"--target",
				"./target",
				"--model",
				"sonnet",
				"--effort",
				"high",
				"--judge-model",
				"sonnet",
				"--judge-effort",
				"high",
				"--session-budget-usd",
				"5",
			],
			{},
		);

		expect(config).toEqual({
			sourceDir: join(process.cwd(), "target"),
			model: "sonnet",
			effort: "high",
			judgeModel: "sonnet",
			judgeEffort: "high",
			sessionBudgetUsd: 5,
			pipelinePath: "pipelines/default.json",
		});
	});

	it("selects a pipeline definition file", () => {
		const config = parseArgs(
			[
				"--target",
				"./target",
				"--model",
				"sonnet",
				"--session-budget-usd",
				"5",
				"--pipeline",
				"pipelines/three-stage.json",
			],
			{},
		);

		expect(config.pipelinePath).toBe("pipelines/three-stage.json");
	});

	it("defaults the pipeline to the four-stage definition", () => {
		const config = parseArgs(
			[
				"--target",
				"./target",
				"--model",
				"sonnet",
				"--session-budget-usd",
				"5",
			],
			{},
		);

		expect(config.pipelinePath).toBe("pipelines/default.json");
	});

	it("selects a five-rep confirmation explicitly", () => {
		const config = parseArgs(
			[
				"--target",
				"./target",
				"--model",
				"sonnet",
				"--session-budget-usd",
				"5",
				"--confirm",
			],
			{},
		);

		expect(config.confirmation).toEqual({ reps: 5, approved: false });
	});

	it.each([
		{ flags: ["--reps", "3"], error: "only with --confirm" },
		{ flags: ["--yes"], error: "only with --confirm" },
		{
			flags: ["--confirm", "--reps", "1"],
			error: "integer of at least 2",
		},
	])("rejects invalid confirmation flags: $flags", ({ flags, error }) => {
		expect(() =>
			parseArgs(
				[
					"--target",
					"./target",
					"--model",
					"sonnet",
					"--session-budget-usd",
					"5",
					...flags,
				],
				{},
			),
		).toThrow(error);
	});

	it("defaults Judge effort to workflow effort", () => {
		const config = parseArgs(
			[
				"--target",
				"./target",
				"--model",
				"sonnet",
				"--effort",
				"xhigh",
				"--session-budget-usd",
				"5",
			],
			{},
		);

		expect(config.judgeModel).toBe("sonnet");
		expect(config.judgeEffort).toBe("xhigh");
	});

	it("resolves configuration from environment variables", () => {
		const config = parseArgs([], {
			BENCHMARK_TARGET_DIR: "./target",
			BENCHMARK_MODEL: "sonnet",
			BENCHMARK_SESSION_BUDGET_USD: "5",
		});

		expect(config.sourceDir).toBe(join(process.cwd(), "target"));
		expect(config.model).toBe("sonnet");
		expect(config.sessionBudgetUsd).toBe(5);
	});

	it("rejects unsupported effort levels", () => {
		expect(() =>
			parseArgs(
				[
					"--target",
					"./target",
					"--model",
					"sonnet",
					"--effort",
					"extreme",
					"--session-budget-usd",
					"5",
				],
				{},
			),
		).toThrow("Unsupported effort");
	});

	it("rejects missing spend limits", () => {
		expect(() =>
			parseArgs(["--target", "./target", "--model", "claude-opus-4-8"], {}),
		).toThrow("Provide --session-budget-usd");
	});
});

describe(parseReplayArgs.name, () => {
	it("resolves the replay knobs and defaults the judge to the model", () => {
		const config = parseReplayArgs(
			[
				"--run",
				"2026-08-30T10-00-00.000Z",
				"--stage",
				"discuss",
				"--model",
				"sonnet",
				"--effort",
				"high",
				"--session-budget-usd",
				"5",
			],
			{},
		);

		expect(config).toEqual({
			runName: "2026-08-30T10-00-00.000Z",
			stage: "discuss",
			model: "sonnet",
			effort: "high",
			judgeModel: "sonnet",
			judgeEffort: "high",
			sessionBudgetUsd: 5,
		});
	});

	it("overrides confirmation reps and accepts noninteractive approval", () => {
		const config = parseReplayArgs(
			[
				"--run",
				"run-1",
				"--stage",
				"build",
				"--model",
				"sonnet",
				"--session-budget-usd",
				"5",
				"--confirm",
				"--reps",
				"7",
				"--yes",
			],
			{},
		);

		expect(config.confirmation).toEqual({ reps: 7, approved: true });
	});

	it("falls back to the benchmark environment variables", () => {
		const config = parseReplayArgs(["--run", "r", "--stage", "build"], {
			BENCHMARK_MODEL: "sonnet",
			BENCHMARK_JUDGE_MODEL: "opus",
			BENCHMARK_SESSION_BUDGET_USD: "3",
		});

		expect(config.model).toBe("sonnet");
		expect(config.judgeModel).toBe("opus");
		expect(config.sessionBudgetUsd).toBe(3);
	});

	it("requires the run and the stage", () => {
		expect(() =>
			parseReplayArgs(
				["--stage", "build", "--model", "m", "--session-budget-usd", "5"],
				{},
			),
		).toThrow("Provide --run");
		expect(() =>
			parseReplayArgs(
				["--run", "r", "--model", "m", "--session-budget-usd", "5"],
				{},
			),
		).toThrow("Provide --stage");
	});
});
