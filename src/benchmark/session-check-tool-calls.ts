import { z } from "zod";
import type { Immutable } from "./contracts";
import type { ToolUse } from "./transcript";
import type { CheckResult } from "./session-check-result";

export const toolCallsCheckSchema = z
	.object({
		kind: z.literal("tool-calls"),
		min: z.number().int().nonnegative().optional(),
		max: z.number().int().nonnegative().optional(),
		names: z.array(z.string().min(1)).min(1).optional(),
	})
	.strict()
	.refine(
		(check) =>
			check.min !== undefined ||
			check.max !== undefined ||
			check.names !== undefined,
		"A tool-calls check declares at least one of min, max, and names",
	);

export type ToolCallsCheck = z.infer<typeof toolCallsCheckSchema>;

function countFailure(
	check: Immutable<ToolCallsCheck>,
	calls: number,
): string | undefined {
	if (check.min !== undefined && calls < check.min) {
		return `${String(calls)} tool calls, fewer than ${String(check.min)}`;
	}
	if (check.max !== undefined && calls > check.max) {
		return `${String(calls)} tool calls, more than ${String(check.max)}`;
	}

	return undefined;
}

function undeclaredNames(
	check: Immutable<ToolCallsCheck>,
	toolUses: Immutable<readonly ToolUse[]>,
): readonly string[] {
	const { names } = check;
	if (names === undefined) {
		return [];
	}

	return [
		...new Set(
			toolUses.map(({ name }) => name).filter((name) => !names.includes(name)),
		),
	];
}

export function evaluateToolCalls(
	check: Immutable<ToolCallsCheck>,
	toolUses: Immutable<readonly ToolUse[]>,
): CheckResult {
	const offending = undeclaredNames(check, toolUses);
	if (offending.length > 0) {
		return {
			kind: check.kind,
			status: "FAIL",
			detail: `undeclared tool called: ${offending.join(", ")}`,
		};
	}

	const failure = countFailure(check, toolUses.length);

	return {
		kind: check.kind,
		status: failure === undefined ? "PASS" : "FAIL",
		detail: failure ?? `${String(toolUses.length)} tool calls`,
	};
}
