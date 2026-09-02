import { z } from "zod";
import type { Immutable } from "./contracts";
import type { CheckResult } from "./session-check-result";

export const wordBandCheckSchema = z
	.object({
		kind: z.literal("word-band"),
		min: z.number().int().nonnegative().optional(),
		max: z.number().int().nonnegative().optional(),
	})
	.strict()
	.refine(
		(check) => check.min !== undefined || check.max !== undefined,
		"A word band declares at least one of min and max",
	);

export type WordBandCheck = z.infer<typeof wordBandCheckSchema>;

export function countWords(reply: string): number {
	return reply.split(/\s+/u).filter((word) => word !== "").length;
}

function band(check: Immutable<WordBandCheck>): string {
	if (check.min === undefined) {
		return `at most ${String(check.max)}`;
	}
	if (check.max === undefined) {
		return `at least ${String(check.min)}`;
	}

	return `${String(check.min)} to ${String(check.max)}`;
}

export function evaluateWordBand(
	check: Immutable<WordBandCheck>,
	reply: string,
): CheckResult {
	const words = countWords(reply);
	const inside =
		(check.min === undefined || words >= check.min) &&
		(check.max === undefined || words <= check.max);

	return {
		kind: check.kind,
		status: inside ? "PASS" : "FAIL",
		detail: inside
			? `${String(words)} words within ${band(check)}`
			: `${String(words)} words outside ${band(check)}`,
	};
}
