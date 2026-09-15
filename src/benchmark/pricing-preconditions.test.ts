import { describe, expect, it } from "bun:test";
import type { UnpricedState } from "#benchmark/context-evidence-contract";
import {
	UNPRICED_REASONS,
	UNPRICED_STATES,
} from "#benchmark/context-evidence-contract";
import type { JsonValue } from "#benchmark/json-value";
import type { SessionHistoryAttemptCost } from "#benchmark/session-history";
import {
	sessionHistoryAttemptCost,
	sessionHistoryRequestSeries,
} from "#benchmark/session-history";
import { committedRateCatalog } from "#benchmark/rate-catalog";

function assistantRow(message: Readonly<Record<string, JsonValue>>): string {
	return JSON.stringify({
		type: "assistant",
		timestamp: "2026-09-14T00:00:01.000Z",
		cwd: "/work",
		requestId: "req-attempt",
		message: { content: [{ type: "text", text: "reply" }], ...message },
	});
}

function usage(cacheCreation: JsonValue, cacheWriteTokens = 10): JsonValue {
	return {
		input_tokens: 5,
		output_tokens: 7,
		cache_read_input_tokens: 3,
		cache_creation_input_tokens: cacheWriteTokens,
		cache_creation: cacheCreation,
	};
}

const completeSplit = {
	ephemeral_1h_input_tokens: 10,
	ephemeral_5m_input_tokens: 0,
};

function calculatedReading(
	transcript: string,
): SessionHistoryAttemptCost["calculated"] {
	return sessionHistoryAttemptCost({
		series: sessionHistoryRequestSeries({
			transcript,
			prefixLinesExcluded: 0,
		}),
		reportedCostUsd: 1,
		rates: committedRateCatalog,
	}).calculated;
}

const preconditions: readonly {
	readonly state: UnpricedState;
	readonly reason: string;
	readonly transcript: string;
}[] = [
	{
		state: "usage-conflict",
		reason: "usage is in conflict",
		transcript: [
			assistantRow({ model: "claude-sonnet-5", usage: usage(completeSplit) }),
			assistantRow({
				model: "claude-sonnet-5",
				usage: usage(completeSplit, 99),
			}),
		].join("\n"),
	},
	{
		state: "model-conflict",
		reason: "the executing model is in conflict",
		transcript: [
			assistantRow({ model: "claude-sonnet-5", usage: usage(completeSplit) }),
			assistantRow({ model: "claude-opus-5", usage: usage(completeSplit) }),
		].join("\n"),
	},
	{
		state: "model-missing",
		reason: "the row names no model",
		transcript: assistantRow({ usage: usage(completeSplit) }),
	},
	{
		state: "ttl-split-missing",
		reason: "the cache-write TTL split is missing",
		transcript: assistantRow({
			model: "claude-sonnet-5",
			usage: {
				input_tokens: 5,
				output_tokens: 7,
				cache_read_input_tokens: 3,
				cache_creation_input_tokens: 10,
			},
		}),
	},
	{
		state: "ttl-split-conflict",
		reason: "the cache-write TTL split is in conflict",
		transcript: assistantRow({
			model: "claude-sonnet-5",
			usage: usage({
				ephemeral_1h_input_tokens: 4,
				ephemeral_5m_input_tokens: 0,
			}),
		}),
	},
	{
		state: "rates-missing",
		reason: "no rate is catalogued for the executing model",
		transcript: assistantRow({
			model: "claude-uncatalogued-9",
			usage: usage(completeSplit),
		}),
	},
];

describe("pricing preconditions", () => {
	for (const { state, reason, transcript } of preconditions) {
		it(`reports ${state} as its own named reason rather than a cost`, () => {
			const reading = calculatedReading(transcript);

			expect(reading.state).toBe("incomplete");
			expect(reading.state === "incomplete" ? reading.reasons : []).toContain(
				reason,
			);
		});
	}

	it("gives every precondition the two projections share a distinct reason", () => {
		const reasons = UNPRICED_STATES.map((state) => UNPRICED_REASONS[state]);

		expect(new Set(reasons).size).toBe(UNPRICED_STATES.length);
	});
});
