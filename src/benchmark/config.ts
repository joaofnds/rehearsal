import { relative, resolve } from "node:path";
import { z } from "zod";

export const CONTROL_DIR = resolve(import.meta.dir, "../..");
export const REQUIRED_BUN_VERSION = "1.4.0";
export const TEST_CONFIG_PATH = "src/config/test.yaml";
export const COMMAND_TIMEOUT_MS = 5 * 60 * 1_000;
export const CLAUDE_TIMEOUT_MS = 30 * 60 * 1_000;
export const MAX_STAGE_TURNS = 20;
export const CHECK_PATHS = [
	"package.json",
	"tsconfig.json",
	"biome.json",
] as const;
export const WORKFLOW_PATHS = ["backlog", ".boris"] as const;
export const HARNESS_RUBRIC_IDS = ["check-integrity", "local-checks"] as const;
export const MAX_CONTEXT_FILE_BYTES = 256 * 1024;
export const MAX_CONTEXT_TOTAL_BYTES = 1024 * 1024;

export const DEFAULT_PIPELINE_PATH = "pipelines/default.json";

export const effortSchema = z.enum(["low", "medium", "high", "xhigh", "max"]);

export type Effort = z.infer<typeof effortSchema>;
export type WorkflowStage = string;

export interface BenchmarkConfig {
	readonly sourceDir: string;
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly judgeModel: string;
	readonly judgeEffort?: Effort | undefined;
	readonly sessionBudgetUsd: number;
	readonly pipelinePath: string;
}

function flagValues(args: readonly string[]) {
	const values = new Map<string, string>();

	for (let index = 0; index < args.length; index += 2) {
		const key = args[index];
		const value = args[index + 1];

		if (!key?.startsWith("--") || !value) {
			throw new Error(
				`Invalid argument sequence near ${key ?? "end of input"}`,
			);
		}

		values.set(key, value);
	}

	return values;
}

export function parseArgs(
	args: readonly string[],
	env: Record<string, string | undefined> = Bun.env,
): BenchmarkConfig {
	const values = flagValues(args);

	const sourceDir = values.get("--target") ?? env["BENCHMARK_TARGET_DIR"];
	const model = values.get("--model") ?? env["BENCHMARK_MODEL"];
	const budgetText =
		values.get("--session-budget-usd") ?? env["BENCHMARK_SESSION_BUDGET_USD"];

	if (!sourceDir) throw new Error("Provide --target or BENCHMARK_TARGET_DIR");
	if (!model) throw new Error("Provide --model or BENCHMARK_MODEL");
	if (!budgetText) {
		throw new Error(
			"Provide --session-budget-usd or BENCHMARK_SESSION_BUDGET_USD",
		);
	}

	const judgeModel =
		values.get("--judge-model") ?? env["BENCHMARK_JUDGE_MODEL"] ?? model;
	const effort = parseEffort(
		values.get("--effort") ?? env["BENCHMARK_EFFORT"],
		"workflow",
	);
	const judgeEffort = parseEffort(
		values.get("--judge-effort") ?? env["BENCHMARK_JUDGE_EFFORT"] ?? effort,
		"Judge",
	);
	const sessionBudgetUsd = Number(budgetText);

	if (!Number.isFinite(sessionBudgetUsd) || sessionBudgetUsd <= 0) {
		throw new Error("Session budget must be a positive number");
	}

	return {
		sourceDir: resolve(sourceDir),
		model,
		effort,
		judgeModel,
		judgeEffort,
		sessionBudgetUsd,
		pipelinePath: controlRelativePath(
			values.get("--pipeline") ??
				env["BENCHMARK_PIPELINE"] ??
				DEFAULT_PIPELINE_PATH,
		),
	};
}

export interface ReplayCliConfig {
	readonly runName: string;
	readonly stage: string;
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly judgeModel: string;
	readonly judgeEffort?: Effort | undefined;
	readonly sessionBudgetUsd: number;
}

/**
 * Replay shares the run's model, effort, judge, and budget knobs and their
 * environment fallbacks; what it adds is naming the recorded run and the
 * stage to replay from it.
 */
export function parseReplayArgs(
	args: readonly string[],
	env: Record<string, string | undefined> = Bun.env,
): ReplayCliConfig {
	const values = flagValues(args);

	const runName = values.get("--run");
	const stage = values.get("--stage");
	const model = values.get("--model") ?? env["BENCHMARK_MODEL"];
	const budgetText =
		values.get("--session-budget-usd") ?? env["BENCHMARK_SESSION_BUDGET_USD"];

	if (!runName) throw new Error("Provide --run with the run's name");
	if (!stage) throw new Error("Provide --stage with the stage to replay");
	if (!model) throw new Error("Provide --model or BENCHMARK_MODEL");
	if (!budgetText) {
		throw new Error(
			"Provide --session-budget-usd or BENCHMARK_SESSION_BUDGET_USD",
		);
	}

	const effort = parseEffort(
		values.get("--effort") ?? env["BENCHMARK_EFFORT"],
		"workflow",
	);
	const judgeEffort = parseEffort(
		values.get("--judge-effort") ?? env["BENCHMARK_JUDGE_EFFORT"] ?? effort,
		"Judge",
	);
	const sessionBudgetUsd = Number(budgetText);

	if (!Number.isFinite(sessionBudgetUsd) || sessionBudgetUsd <= 0) {
		throw new Error("Session budget must be a positive number");
	}

	return {
		runName,
		stage,
		model,
		...(effort === undefined ? {} : { effort }),
		judgeModel:
			values.get("--judge-model") ?? env["BENCHMARK_JUDGE_MODEL"] ?? model,
		...(judgeEffort === undefined ? {} : { judgeEffort }),
		sessionBudgetUsd,
	};
}

/**
 * A run artifact records the pipeline path so two runs can be compared, which
 * only works when the same pipeline yields the same string on every machine.
 * An absolute path and a path through ".." both name a file that a plain
 * relative path names too, so the path is reduced to that one form here, at the
 * boundary, rather than left for every later reader to normalise.
 */
function controlRelativePath(pipelinePath: string) {
	return relative(CONTROL_DIR, resolve(CONTROL_DIR, pipelinePath));
}

function parseEffort(value: string | undefined, role: string) {
	if (value === undefined) return undefined;

	const parsed = effortSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(
			`Unsupported effort for ${role}: ${value}. Use low, medium, high, xhigh, or max`,
		);
	}

	return parsed.data;
}
