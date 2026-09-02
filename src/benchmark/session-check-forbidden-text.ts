import { z } from "zod";
import type { Immutable } from "./contracts";
import type { CheckResult } from "./session-check-result";

export const forbiddenTextCheckSchema = z
	.object({
		kind: z.literal("forbidden-text"),
		strings: z.array(z.string().min(1)).min(1),
	})
	.strict();

export type ForbiddenTextCheck = z.infer<typeof forbiddenTextCheckSchema>;

export function evaluateForbiddenText(
	check: Immutable<ForbiddenTextCheck>,
	reply: string,
): CheckResult {
	const present = check.strings.filter((forbidden) =>
		reply.includes(forbidden),
	);
	if (present.length === 0) {
		return {
			kind: check.kind,
			status: "PASS",
			detail: `none of ${String(check.strings.length)} forbidden strings present`,
		};
	}

	return {
		kind: check.kind,
		status: "FAIL",
		detail: `reply contains ${present.map((forbidden) => JSON.stringify(forbidden)).join(", ")}`,
	};
}
