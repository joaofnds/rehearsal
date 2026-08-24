import { resolve } from "node:path";
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
export const CONTEXT_PATHS = [
	"package.json",
	"src/app.module.ts",
	"src/database/module.ts",
	"src/queue/queue.module.ts",
	"src/user/http/controller.ts",
	"src/user/http/module.ts",
	"src/user/persistence/user.schema.ts",
	"src/user/persistence/module.ts",
	"src/user/queue/user-created.queue.ts",
	"src/user/queue/module.ts",
	"src/user/worker/user-created.worker.ts",
	"src/user/worker/module.ts",
] as const;

export const RUBRIC_IDS = [
	"tests",
	"validation",
	"persistence",
	"location",
	"entity",
	"endpoint",
	"queue",
	"worker",
	"migration",
	"wiring",
	"behavior-coverage",
	"forbidden-tools",
	"check-integrity",
	"local-checks",
] as const;

export const WORKFLOW_STAGES = ["discuss", "grill", "plan", "build"] as const;

export const effortSchema = z.enum(["low", "medium", "high", "xhigh", "max"]);

export type Effort = z.infer<typeof effortSchema>;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export interface BenchmarkConfig {
	readonly sourceDir: string;
	readonly model: string;
	readonly effort?: Effort;
	readonly judgeModel: string;
	readonly judgeEffort?: Effort;
	readonly sessionBudgetUsd: number;
}

export function parseArgs(
	args: readonly string[],
	env: Record<string, string | undefined> = Bun.env,
): BenchmarkConfig {
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

	const sourceDir = values.get("--target") ?? env.BENCHMARK_TARGET_DIR;
	const model = values.get("--model") ?? env.BENCHMARK_MODEL;
	const budgetText =
		values.get("--session-budget-usd") ?? env.BENCHMARK_SESSION_BUDGET_USD;

	if (!sourceDir) throw new Error("Provide --target or BENCHMARK_TARGET_DIR");
	if (!model) throw new Error("Provide --model or BENCHMARK_MODEL");
	if (!budgetText) {
		throw new Error(
			"Provide --session-budget-usd or BENCHMARK_SESSION_BUDGET_USD",
		);
	}

	const judgeModel =
		values.get("--judge-model") ?? env.BENCHMARK_JUDGE_MODEL ?? model;
	const effort = parseEffort(
		values.get("--effort") ?? env.BENCHMARK_EFFORT,
		"workflow",
	);
	const judgeEffort = parseEffort(
		values.get("--judge-effort") ?? env.BENCHMARK_JUDGE_EFFORT ?? effort,
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
	};
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
