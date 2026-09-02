import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import type { Effort } from "./config";
import {
	judgeSelfPreferenceWarning,
	parseArgs,
	parseReplayArgs,
} from "./config";

interface SessionValues {
	readonly model: string;
	readonly effort: Effort | undefined;
	readonly judgeModel: string;
	readonly judgeEffort: Effort | undefined;
	readonly sessionBudgetUsd: number;
}

function sessionValues(
	config: ReturnType<typeof parseArgs> | ReturnType<typeof parseReplayArgs>,
): SessionValues {
	return {
		model: config.model,
		effort: config.effort,
		judgeModel: config.judgeModel,
		judgeEffort: config.judgeEffort,
		sessionBudgetUsd: config.sessionBudgetUsd,
	};
}

describe("run and replay session knobs", () => {
	it.each([
		{
			source: "explicit CLI values over the environment",
			sessionArgs: [
				"--model",
				"sonnet",
				"--effort",
				"high",
				"--judge-model",
				"haiku",
				"--judge-effort",
				"xhigh",
				"--session-budget-usd",
				"5",
			],
			env: {
				BENCHMARK_MODEL: "environment-model",
				BENCHMARK_EFFORT: "low",
				BENCHMARK_JUDGE_MODEL: "environment-judge",
				BENCHMARK_JUDGE_EFFORT: "medium",
				BENCHMARK_SESSION_BUDGET_USD: "9",
			},
			expected: {
				model: "sonnet",
				effort: "high",
				judgeModel: "haiku",
				judgeEffort: "xhigh",
				sessionBudgetUsd: 5,
			},
		},
		{
			source: "environment values",
			sessionArgs: [],
			env: {
				BENCHMARK_MODEL: "sonnet",
				BENCHMARK_EFFORT: "high",
				BENCHMARK_JUDGE_MODEL: "haiku",
				BENCHMARK_JUDGE_EFFORT: "xhigh",
				BENCHMARK_SESSION_BUDGET_USD: "5",
			},
			expected: {
				model: "sonnet",
				effort: "high",
				judgeModel: "haiku",
				judgeEffort: "xhigh",
				sessionBudgetUsd: 5,
			},
		},
	])("resolves identical $source", ({ sessionArgs, env, expected }) => {
		const runConfig = parseArgs(["--target", "./target", ...sessionArgs], env);
		const replayConfig = parseReplayArgs(
			["--run", "run-1", "--stage", "build", ...sessionArgs],
			env,
		);

		expect(sessionValues(runConfig)).toEqual(expected);
		expect(sessionValues(replayConfig)).toEqual(expected);
	});

	it.each([
		{
			condition: "the workflow model is missing",
			sessionArgs: ["--session-budget-usd", "5"],
			error: "Provide --model or BENCHMARK_MODEL",
		},
		{
			condition: "the session budget is missing",
			sessionArgs: ["--model", "sonnet"],
			error: "Provide --session-budget-usd or BENCHMARK_SESSION_BUDGET_USD",
		},
		{
			condition: "the session budget is non-numeric",
			sessionArgs: ["--model", "sonnet", "--session-budget-usd", "invalid"],
			error: "Session budget must be a positive number",
		},
		{
			condition: "the session budget is zero",
			sessionArgs: ["--model", "sonnet", "--session-budget-usd", "0"],
			error: "Session budget must be a positive number",
		},
		{
			condition: "the session budget is negative",
			sessionArgs: ["--model", "sonnet", "--session-budget-usd", "-1"],
			error: "Session budget must be a positive number",
		},
		{
			condition: "the workflow effort is unsupported",
			sessionArgs: [
				"--model",
				"sonnet",
				"--effort",
				"extreme",
				"--session-budget-usd",
				"5",
			],
			error:
				"Unsupported effort for workflow: extreme. Use low, medium, high, xhigh, or max",
		},
		{
			condition: "the Judge effort is unsupported",
			sessionArgs: [
				"--model",
				"sonnet",
				"--judge-effort",
				"extreme",
				"--session-budget-usd",
				"5",
			],
			error:
				"Unsupported effort for Judge: extreme. Use low, medium, high, xhigh, or max",
		},
	])("rejects identical errors when $condition", ({ sessionArgs, error }) => {
		expect(() =>
			parseArgs(["--target", "./target", ...sessionArgs], {}),
		).toThrow(error);
		expect(() =>
			parseReplayArgs(
				["--run", "run-1", "--stage", "build", ...sessionArgs],
				{},
			),
		).toThrow(error);
	});
});

describe(parseArgs.name, () => {
	it.each([
		{ model: "sonnet", judgeModel: "opus" },
		{ model: "haiku", judgeModel: "opus" },
		{ model: "external-model", judgeModel: "opus" },
		{ model: "vendor-opus-model", judgeModel: "opus" },
		{ model: "opus", judgeModel: "sonnet" },
		{ model: "claude-opus-4-8", judgeModel: "sonnet" },
	])(
		"defaults the Judge to $judgeModel when workflow model is $model",
		({ model, judgeModel }) => {
			const config = parseArgs(
				["--target", "./target", "--model", model, "--session-budget-usd", "5"],
				{},
			);

			expect(config.judgeModel).toBe(judgeModel);
		},
	);

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

	it("prioritizes the CLI Judge model over the environment", () => {
		const config = parseArgs(
			[
				"--target",
				"./target",
				"--model",
				"sonnet",
				"--judge-model",
				"haiku",
				"--session-budget-usd",
				"5",
			],
			{ BENCHMARK_JUDGE_MODEL: "opus" },
		);

		expect(config.judgeModel).toBe("haiku");
	});

	it("prioritizes the environment Judge model over the default", () => {
		const config = parseArgs(
			["--target", "./target", "--model", "opus", "--session-budget-usd", "5"],
			{ BENCHMARK_JUDGE_MODEL: "haiku" },
		);

		expect(config.judgeModel).toBe("haiku");
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
	it.each([
		{ model: "sonnet", judgeModel: "opus" },
		{ model: "haiku", judgeModel: "opus" },
		{ model: "external-model", judgeModel: "opus" },
		{ model: "vendor-opus-model", judgeModel: "opus" },
		{ model: "opus", judgeModel: "sonnet" },
		{ model: "claude-opus-4-8", judgeModel: "sonnet" },
	])(
		"defaults the Judge to $judgeModel when workflow model is $model",
		({ model, judgeModel }) => {
			const config = parseReplayArgs(
				[
					"--run",
					"run-1",
					"--stage",
					"build",
					"--model",
					model,
					"--session-budget-usd",
					"5",
				],
				{},
			);

			expect(config.judgeModel).toBe(judgeModel);
		},
	);

	it("resolves the replay knobs", () => {
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
			judgeModel: "opus",
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
			BENCHMARK_JUDGE_MODEL: "haiku",
			BENCHMARK_SESSION_BUDGET_USD: "3",
		});

		expect(config.model).toBe("sonnet");
		expect(config.judgeModel).toBe("haiku");
		expect(config.sessionBudgetUsd).toBe(3);
	});

	it("prioritizes the CLI Judge model over the environment", () => {
		const config = parseReplayArgs(
			[
				"--run",
				"run-1",
				"--stage",
				"build",
				"--model",
				"sonnet",
				"--judge-model",
				"haiku",
				"--session-budget-usd",
				"5",
			],
			{ BENCHMARK_JUDGE_MODEL: "opus" },
		);

		expect(config.judgeModel).toBe("haiku");
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

describe(judgeSelfPreferenceWarning.name, () => {
	it("warns when unrecognized model identifiers are equal", () => {
		expect(
			judgeSelfPreferenceWarning({
				model: "external-model",
				judgeModel: "external-model",
			}),
		).toContain("Self-preference warning");
	});

	it("does not warn when recognized model families differ", () => {
		expect(
			judgeSelfPreferenceWarning({ model: "sonnet", judgeModel: "opus" }),
		).toBeUndefined();
	});

	it("does not warn when unequal unrecognized identifiers share a family word", () => {
		expect(
			judgeSelfPreferenceWarning({
				model: "vendor-opus-model",
				judgeModel: "other-opus-model",
			}),
		).toBeUndefined();
	});
});
