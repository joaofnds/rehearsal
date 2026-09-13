import { describe, expect, it } from "bun:test";
import {
	contextEvidenceSourceSchema,
	normalizeContextEvidence,
} from "#benchmark/context-evidence";

async function sourceFixture(): Promise<unknown> {
	return Bun.file(
		new URL("./__fixtures__/context-evidence-source.json", import.meta.url),
	).json();
}

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
});
