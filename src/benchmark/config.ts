import { relative, resolve } from "node:path";
import { z } from "zod";

export const CONTROL_DIR = resolve(import.meta.dir, "../..");
export const REQUIRED_BUN_VERSION = "1.4.0";
export const COMMAND_TIMEOUT_MS = 5 * 60 * 1000;
export const CLAUDE_TIMEOUT_MS = 30 * 60 * 1000;
export const MAX_STAGE_TURNS = 20;
export const WORKFLOW_PATHS = ["backlog", ".boris"] as const;
export const HARNESS_RUBRIC_IDS = ["check-integrity", "local-checks"] as const;
export const MAX_CONTEXT_FILE_BYTES = 256 * 1024;
export const MAX_CONTEXT_TOTAL_BYTES = 1024 * 1024;

export const DEFAULT_PIPELINE_PATH = "pipelines/default.json";

const MODEL_FAMILIES = ["opus", "sonnet", "haiku"] as const;
type ModelFamily = (typeof MODEL_FAMILIES)[number];

export const effortSchema = z.enum(["low", "medium", "high", "xhigh", "max"]);

export type Effort = z.infer<typeof effortSchema>;
export type WorkflowStage = string;

export interface ConfirmationConfig {
	readonly reps: number;
	readonly approved: boolean;
}

export interface BenchmarkConfig {
	readonly sourceDir: string;
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly judgeModel: string;
	readonly judgeEffort?: Effort | undefined;
	readonly sessionBudgetUsd: number;
	readonly pipelinePath: string;
	readonly confirmation?: ConfirmationConfig | undefined;
}

interface ParsedFlags {
	readonly values: ReadonlyMap<string, string>;
	readonly switches: ReadonlySet<string>;
}

function modelFamily(model: string): ModelFamily | undefined {
	const terms = model.toLowerCase().split(/[^a-z0-9]+/u);

	return MODEL_FAMILIES.find((family) => terms.includes(family));
}

function defaultJudgeModel(workflowModel: string): string {
	return modelFamily(workflowModel) === "opus" ? "sonnet" : "opus";
}

function resolveJudgeModel(
	values: ReadonlyMap<string, string>,
	env: Readonly<Record<string, string | undefined>>,
	workflowModel: string,
): string {
	return (
		values.get("--judge-model") ??
		env["BENCHMARK_JUDGE_MODEL"] ??
		defaultJudgeModel(workflowModel)
	);
}

export function judgeSelfPreferenceWarning(config: {
	readonly model: string;
	readonly judgeModel: string;
}): string | undefined {
	if (config.model === config.judgeModel) {
		return `Self-preference warning: Judge and workflow both use model ${config.model}; grades may favor the workflow output.`;
	}

	const workflowFamily = modelFamily(config.model);
	if (
		workflowFamily === undefined ||
		workflowFamily !== modelFamily(config.judgeModel)
	) {
		return undefined;
	}

	return `Self-preference warning: Judge model ${config.judgeModel} and workflow model ${config.model} are both in the ${workflowFamily} family; grades may favor the workflow output.`;
}

const SWITCH_FLAGS = new Set(["--confirm", "--yes"]);

function flagValues(args: readonly string[]): ParsedFlags {
	const values = new Map<string, string>();
	const switches = new Set<string>();

	for (let index = 0; index < args.length;) {
		const key = args[index];
		if (key === undefined || !key.startsWith("--")) {
			throw new Error(
				`Invalid argument sequence near ${key ?? "end of input"}`,
			);
		}
		if (SWITCH_FLAGS.has(key)) {
			switches.add(key);
			index += 1;
			continue;
		}

		const value = args[index + 1];
		if (value === undefined || value === "") {
			throw new Error(`Invalid argument sequence near ${key}`);
		}

		values.set(key, value);
		index += 2;
	}

	return { values, switches };
}

function parseConfirmation(flags: ParsedFlags): ConfirmationConfig | undefined {
	const confirmation = flags.switches.has("--confirm");
	const approved = flags.switches.has("--yes");
	const repsText = flags.values.get("--reps");

	if (!confirmation) {
		if (repsText !== undefined || approved) {
			throw new Error("Use --reps and --yes only with --confirm");
		}

		return undefined;
	}

	const reps = repsText === undefined ? 5 : Number(repsText);
	if (!Number.isInteger(reps) || reps < 2) {
		throw new Error("Confirmation reps must be an integer of at least 2");
	}

	return { reps, approved };
}

function withConfirmation<Config extends object>(
	config: Config,
	confirmation: ConfirmationConfig | undefined,
): Config & { readonly confirmation?: ConfirmationConfig | undefined } {
	if (confirmation === undefined) {
		return config;
	}

	return { ...config, confirmation };
}

export function parseArgs(
	args: readonly string[],
	env: Readonly<Record<string, string | undefined>> = Bun.env,
): BenchmarkConfig {
	const flags = flagValues(args);
	const { values } = flags;

	const sourceDir = values.get("--target") ?? env["BENCHMARK_TARGET_DIR"];
	const model = values.get("--model") ?? env["BENCHMARK_MODEL"];
	const budgetText =
		values.get("--session-budget-usd") ?? env["BENCHMARK_SESSION_BUDGET_USD"];

	if (sourceDir === undefined || sourceDir === "") {
		throw new Error("Provide --target or BENCHMARK_TARGET_DIR");
	}
	if (model === undefined || model === "") {
		throw new Error("Provide --model or BENCHMARK_MODEL");
	}
	if (budgetText === undefined || budgetText === "") {
		throw new Error(
			"Provide --session-budget-usd or BENCHMARK_SESSION_BUDGET_USD",
		);
	}

	const judgeModel = resolveJudgeModel(values, env, model);
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
	const confirmation = parseConfirmation(flags);

	return withConfirmation(
		{
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
		},
		confirmation,
	);
}

export interface ReplayCliConfig {
	readonly runName: string;
	readonly stage: string;
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly judgeModel: string;
	readonly judgeEffort?: Effort | undefined;
	readonly sessionBudgetUsd: number;
	readonly confirmation?: ConfirmationConfig | undefined;
}

/**
 * Replay shares the run's model, effort, judge, and budget knobs and their
 * environment fallbacks; what it adds is naming the recorded run and the
 * stage to replay from it.
 */
export function parseReplayArgs(
	args: readonly string[],
	env: Readonly<Record<string, string | undefined>> = Bun.env,
): ReplayCliConfig {
	const flags = flagValues(args);
	const { values } = flags;

	const runName = values.get("--run");
	const stage = values.get("--stage");
	const model = values.get("--model") ?? env["BENCHMARK_MODEL"];
	const budgetText =
		values.get("--session-budget-usd") ?? env["BENCHMARK_SESSION_BUDGET_USD"];

	if (runName === undefined || runName === "") {
		throw new Error("Provide --run with the run's name");
	}
	if (stage === undefined || stage === "") {
		throw new Error("Provide --stage with the stage to replay");
	}
	if (model === undefined || model === "") {
		throw new Error("Provide --model or BENCHMARK_MODEL");
	}
	if (budgetText === undefined || budgetText === "") {
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
	const confirmation = parseConfirmation(flags);

	return withConfirmation(
		{
			runName,
			stage,
			model,
			effort,
			judgeModel: resolveJudgeModel(values, env, model),
			judgeEffort,
			sessionBudgetUsd,
		},
		confirmation,
	);
}

/**
 * A run artifact records the pipeline path so two runs can be compared, which
 * only works when the same pipeline yields the same string on every machine.
 * An absolute path and a path through ".." both name a file that a plain
 * relative path names too, so the path is reduced to that one form here, at the
 * boundary, rather than left for every later reader to normalise.
 */
function controlRelativePath(pipelinePath: string): string {
	return relative(CONTROL_DIR, resolve(CONTROL_DIR, pipelinePath));
}

function parseEffort(
	value: string | undefined,
	role: string,
): Effort | undefined {
	if (value === undefined) {
		return undefined;
	}

	const parsed = effortSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(
			`Unsupported effort for ${role}: ${value}. Use low, medium, high, xhigh, or max`,
		);
	}

	return parsed.data;
}
