import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { costFromRate } from "#benchmark/context-evidence-contract";
import { committedRateCatalog, rateFor } from "#benchmark/rate-catalog";

const recordedAttemptSchema = z.object({
	attemptPath: z.string().min(1),
	transcriptModel: z.string().min(1),
	recordModelLabel: z.string().min(1),
	inputTokens: z.number().int().nonnegative(),
	outputTokens: z.number().int().nonnegative(),
	cacheReadTokens: z.number().int().nonnegative(),
	cacheWrite1hTokens: z.number().int().nonnegative(),
	recordedCostUsd: z.number().nonnegative(),
});

const recordedCostsSchema = z.object({
	measuredOn: z.string().min(1),
	note: z.string().min(1),
	attempts: z.array(recordedAttemptSchema).nonempty(),
});

async function recordedAttempts(): Promise<
	readonly z.infer<typeof recordedAttemptSchema>[]
> {
	const parsed = recordedCostsSchema.parse(
		await Bun.file(
			new URL("__fixtures__/recorded-attempt-costs.json", import.meta.url),
		).json(),
	);

	return parsed.attempts;
}

describe("committedRateCatalog", () => {
	it("re-derives every recorded attempt cost from the catalogued rates", async () => {
		const attempts = await recordedAttempts();

		const drifted = attempts.filter((attempt) => {
			const rate = rateFor(committedRateCatalog, attempt.transcriptModel);
			if (rate === undefined) {
				return true;
			}
			const derived = costFromRate(
				{
					inputTokens: attempt.inputTokens,
					outputTokens: attempt.outputTokens,
					cacheReadTokens: attempt.cacheReadTokens,
					cacheWrite5mTokens: 0,
					cacheWrite1hTokens: attempt.cacheWrite1hTokens,
				},
				rate,
			);

			return Math.abs(derived - attempt.recordedCostUsd) > 1e-12;
		});

		expect(drifted.map((attempt) => attempt.attemptPath)).toEqual([]);
	});

	it("keys its rates on the transcript model string rather than the record's label", async () => {
		const attempts = await recordedAttempts();

		const labels = [
			...new Set(attempts.map((attempt) => attempt.recordModelLabel)),
		];

		expect(committedRateCatalog.models.map((rate) => rate.model)).toEqual([
			"claude-sonnet-5",
			"claude-opus-5",
		]);
		for (const label of labels) {
			expect(rateFor(committedRateCatalog, label)).toBeUndefined();
		}
	});

	it("marks the 5m cache-write rate as publication-backed and the rest as corpus-measured", () => {
		expect(committedRateCatalog.provenance).toEqual({
			inputUsdPerMillion: "corpus-measured",
			outputUsdPerMillion: "corpus-measured",
			cacheReadUsdPerMillion: "corpus-measured",
			cacheWrite1hUsdPerMillion: "corpus-measured",
			cacheWrite5mUsdPerMillion: "publication-backed",
		});
	});
});
