import { describe, expect, it } from "bun:test";
import {
	contextEvidenceSourceSchema,
	contextRateCatalogSchema,
	normalizeContextEvidence,
} from "#benchmark/context-evidence";
import type { JsonObject } from "#benchmark/json-value";

async function sourceFixture(): Promise<unknown> {
	return Bun.file(
		new URL("./__fixtures__/context-evidence-source.json", import.meta.url),
	).json();
}

function objectAt(record: JsonObject, key: string): JsonObject {
	const value = record[key];
	if (value === null || typeof value !== "object" || Array.isArray(value))
		throw new Error("fixture has no object at " + key);

	return value as JsonObject;
}

const rates = contextRateCatalogSchema.parse({
	schemaVersion: 1,
	source: "synthetic-rate-card",
	version: "2026-09-13",
	currency: "USD",
	models: [
		{
			model: "claude-sonnet-5",
			inputUsdPerMillion: 3,
			outputUsdPerMillion: 15,
			cacheReadUsdPerMillion: 0.3,
			cacheWrite5mUsdPerMillion: 3.75,
			cacheWrite1hUsdPerMillion: 6,
		},
		{
			model: "claude-haiku-5",
			inputUsdPerMillion: 1,
			outputUsdPerMillion: 5,
			cacheReadUsdPerMillion: 0.1,
			cacheWrite5mUsdPerMillion: 1.25,
			cacheWrite1hUsdPerMillion: 2,
		},
	],
});

describe(normalizeContextEvidence.name, () => {
	it("derives joined requests, nested lineage and explicit loss states from provider-shaped sources", async () => {
		const source = contextEvidenceSourceSchema.parse(await sourceFixture());

		const evidence = normalizeContextEvidence(source);

		expect(evidence.projection).toEqual({
			agents: [
				{
					agentId: "agent-explore-1",
					parentAgentId: "agent-review-1",
					lineageState: "complete",
					sources: ["stream", "trace"],
				},
				{
					agentId: "agent-review-1",
					parentAgentId: "main",
					lineageState: "complete",
					sources: ["stream"],
				},
			],
			requests: [
				{
					requestId: "req-child-1",
					agentId: "agent-review-1",
					model: "claude-sonnet-5",
					usageState: "complete",
					usage: {
						inputTokens: 4,
						outputTokens: 50,
						cacheReadTokens: 10_000,
						cacheWriteTokens: 400,
						cacheWrite5mTokens: 200,
						cacheWrite1hTokens: 200,
					},
					providerCostUsd: 0.02,
					pricing: { state: "rates-missing" },
					otelOccurrences: 2,
					uniqueOtelOccurrences: 1,
					transcriptOccurrences: 1,
				},
				{
					requestId: "req-child-missing",
					agentId: "agent-review-1",
					model: "claude-sonnet-5",
					usageState: "missing",
					pricing: { state: "usage-missing" },
					otelOccurrences: 0,
					uniqueOtelOccurrences: 0,
					transcriptOccurrences: 1,
				},
				{
					requestId: "req-main-1",
					agentId: "main",
					model: "claude-sonnet-5",
					usageState: "complete",
					usage: {
						inputTokens: 2,
						outputTokens: 40,
						cacheReadTokens: 0,
						cacheWriteTokens: 12_000,
						cacheWrite5mTokens: 12_000,
						cacheWrite1hTokens: 0,
					},
					providerCostUsd: 0.04,
					pricing: { state: "rates-missing" },
					otelOccurrences: 1,
					uniqueOtelOccurrences: 1,
					transcriptOccurrences: 1,
				},
				{
					requestId: "req-nested-1",
					agentId: "agent-explore-1",
					model: "claude-haiku-5",
					usageState: "complete",
					usage: {
						inputTokens: 3,
						outputTokens: 18,
						cacheReadTokens: 5_000,
						cacheWriteTokens: 0,
						cacheWrite5mTokens: 0,
						cacheWrite1hTokens: 0,
					},
					providerCostUsd: 0.01,
					pricing: { state: "rates-missing" },
					otelOccurrences: 1,
					uniqueOtelOccurrences: 1,
					transcriptOccurrences: 1,
				},
			],
			keylessRequests: [
				{ occurrenceId: "otel-log:5", state: "identity-missing-no-dedup" },
				{ occurrenceId: "otel-log:6", state: "identity-missing-no-dedup" },
			],
			accountingState: "incomplete-keyless-occurrences",
			instructionLoads: [
				{
					sourceOrdinal: 1,
					agentId: "main",
					promptId: null,
					filePath: "/redacted/project/CLAUDE.md",
					memoryType: "Project",
					loadReason: "session_start",
				},
				{
					sourceOrdinal: 3,
					agentId: "agent-review-1",
					promptId: "prompt-child-1",
					filePath: "/redacted/project/.claude/rules/review.md",
					memoryType: "Project",
					loadReason: "path_glob_match",
					triggerFilePath: "/redacted/project/src/a.ts",
					globs: ["src/**"],
				},
			],
			compactions: [
				{
					sourceOrdinal: 6,
					agentId: "agent-review-1",
					promptId: "prompt-child-1",
					phase: "pre",
					trigger: "auto",
				},
				{
					sourceOrdinal: 7,
					agentId: "agent-review-1",
					promptId: "prompt-child-1",
					phase: "post",
					trigger: "auto",
					summaryAvailable: true,
				},
			],
			rawApiBodies: [
				{
					sourceOrdinal: 1,
					bodyRef: "api-bodies/request-0001.json",
					requestId: null,
					state: "unassigned-no-documented-key",
				},
				{
					sourceOrdinal: 2,
					bodyRef: "api-bodies/request-0002.json",
					requestId: null,
					state: "unassigned-no-documented-key",
				},
			],
			coverage: [
				{
					stream: "hooks",
					state: "partial",
					reason: "synthetic-truncated-tail",
				},
				{ stream: "otelLogs", state: "complete" },
				{ stream: "stream", state: "complete" },
			],
		});
	});

	it("marks conflicting stream parent identities instead of keeping the last one", async () => {
		const source = contextEvidenceSourceSchema.parse(await sourceFixture());
		const childMessage = source.files.stream[1];
		if (childMessage === undefined)
			throw new Error("fixture has no child message");
		source.files.stream.push({
			...childMessage,
			capture_ordinal: 99,
			parent_tool_use_id: "tool-agent-2",
		});

		const evidence = normalizeContextEvidence(source);

		expect(
			evidence.projection.agents.find(
				(agent) => agent.agentId === "agent-review-1",
			),
		).toEqual({
			agentId: "agent-review-1",
			parentAgentId: null,
			lineageState: "conflict",
			sources: ["stream"],
		});
	});

	it("prices each request from its model and reconciled cache TTL categories", async () => {
		const source = contextEvidenceSourceSchema.parse(await sourceFixture());

		const evidence = normalizeContextEvidence(source, rates);

		expect(
			evidence.projection.requests.map(({ requestId, pricing }) => ({
				requestId,
				pricing,
			})),
		).toEqual([
			{
				requestId: "req-child-1",
				pricing: {
					state: "complete",
					calculatedCostUsd: 0.005712,
					rateSource: "synthetic-rate-card",
					rateVersion: "2026-09-13",
					currency: "USD",
				},
			},
			{
				requestId: "req-child-missing",
				pricing: { state: "usage-missing" },
			},
			{
				requestId: "req-main-1",
				pricing: {
					state: "complete",
					calculatedCostUsd: 0.045606,
					rateSource: "synthetic-rate-card",
					rateVersion: "2026-09-13",
					currency: "USD",
				},
			},
			{
				requestId: "req-nested-1",
				pricing: {
					state: "complete",
					calculatedCostUsd: 0.000593,
					rateSource: "synthetic-rate-card",
					rateVersion: "2026-09-13",
					currency: "USD",
				},
			},
		]);
	});

	it.each([
		{
			name: "missing",
			cache: undefined,
			expected: "ttl-split-missing",
		},
		{
			name: "conflicting",
			cache: {
				ephemeral_5m_input_tokens: 201,
				ephemeral_1h_input_tokens: 200,
			},
			expected: "ttl-split-conflict",
		},
	])(
		"keeps a $name cache TTL split incomplete",
		async ({ cache, expected }) => {
			const source = contextEvidenceSourceSchema.parse(await sourceFixture());
			const child =
				source.files.transcripts[
					"transcripts/subagents/agent-agent-review-1.jsonl"
				]?.[0];
			if (child === undefined)
				throw new Error("fixture has no child transcript");
			const message = objectAt(child, "message");
			const usage = objectAt(message, "usage");
			if (cache === undefined) Reflect.deleteProperty(usage, "cache_creation");
			else Object.assign(usage, { cache_creation: cache });

			const evidence = normalizeContextEvidence(source, rates);

			expect(
				evidence.projection.requests.find(
					(request) => request.requestId === "req-child-1",
				)?.pricing.state,
			).toBe(expected);
		},
	);
});
