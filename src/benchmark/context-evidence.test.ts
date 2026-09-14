import { describe, expect, it } from "bun:test";
import {
	contextEvidenceSchema,
	contextEvidenceSourceSchema,
	contextRateCatalogSchema,
	normalizeContextEvidence,
} from "#benchmark/context-evidence";
import { jsonObjectSchema } from "#benchmark/json-value";
import type { JsonObject } from "#benchmark/json-value";

async function sourceFixture(): Promise<
	ReturnType<typeof contextEvidenceSourceSchema.parse>
> {
	return contextEvidenceSourceSchema.parse(
		await Bun.file(
			new URL("__fixtures__/context-evidence-source.json", import.meta.url),
		).json(),
	);
}

function objectAt(record: Readonly<JsonObject>, key: string): JsonObject {
	return jsonObjectSchema.parse(record[key]);
}

function required<T>(value: T | undefined, message: string): T {
	if (value === undefined) {
		throw new Error(message);
	}

	return value;
}

const sonnetRate = {
	model: "claude-sonnet-5",
	inputUsdPerMillion: 3,
	outputUsdPerMillion: 15,
	cacheReadUsdPerMillion: 0.3,
	cacheWrite5mUsdPerMillion: 3.75,
	cacheWrite1hUsdPerMillion: 6,
};
const haikuRate = {
	model: "claude-haiku-5",
	inputUsdPerMillion: 1,
	outputUsdPerMillion: 5,
	cacheReadUsdPerMillion: 0.1,
	cacheWrite5mUsdPerMillion: 1.25,
	cacheWrite1hUsdPerMillion: 2,
};
const rates = contextRateCatalogSchema.parse({
	schemaVersion: 1,
	source: "synthetic-rate-card",
	version: "2026-09-13",
	currency: "USD",
	models: [sonnetRate, haikuRate],
});

describe(normalizeContextEvidence.name, () => {
	it("derives joined requests, nested lineage and explicit loss states from provider-shaped sources", async () => {
		const source = await sourceFixture();

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
					lineageState: "single-source",
					sources: ["stream"],
				},
			],
			requests: [
				{
					sessionId: "session-1",
					requestId: "req-child-1",
					clientRequestIds: [],
					identityState: "complete",
					agentId: "agent-review-1",
					model: "claude-sonnet-5",
					modelState: "complete",
					usageState: "complete",
					usage: {
						inputTokens: 4,
						outputTokens: 50,
						cacheReadTokens: 10_000,
						cacheWriteTokens: 400,
						cacheWrite5mTokens: 200,
						cacheWrite1hTokens: 200,
					},
					usageRoute: "otel",
					providerCostUsd: 0.02,
					pricing: { state: "rates-missing" },
					otelOccurrences: 2,
					uniqueOtelOccurrences: 1,
					transcriptOccurrences: 1,
				},
				{
					sessionId: "session-1",
					requestId: "req-child-missing",
					clientRequestIds: [],
					identityState: "single-source",
					agentId: "agent-review-1",
					model: "claude-sonnet-5",
					modelState: "single-source",
					usageState: "missing",
					pricing: { state: "usage-missing" },
					otelOccurrences: 0,
					uniqueOtelOccurrences: 0,
					transcriptOccurrences: 1,
				},
				{
					sessionId: "session-1",
					requestId: "req-main-1",
					clientRequestIds: [],
					identityState: "complete",
					agentId: "main",
					model: "claude-sonnet-5",
					modelState: "complete",
					usageState: "complete",
					usage: {
						inputTokens: 2,
						outputTokens: 40,
						cacheReadTokens: 0,
						cacheWriteTokens: 12_000,
						cacheWrite5mTokens: 12_000,
						cacheWrite1hTokens: 0,
					},
					usageRoute: "otel",
					providerCostUsd: 0.04,
					pricing: { state: "rates-missing" },
					otelOccurrences: 1,
					uniqueOtelOccurrences: 1,
					transcriptOccurrences: 1,
				},
				{
					sessionId: "session-1",
					requestId: "req-nested-1",
					clientRequestIds: [],
					identityState: "complete",
					agentId: "agent-explore-1",
					model: "claude-haiku-5",
					modelState: "complete",
					usageState: "complete",
					usage: {
						inputTokens: 3,
						outputTokens: 18,
						cacheReadTokens: 5000,
						cacheWriteTokens: 0,
						cacheWrite5mTokens: 0,
						cacheWrite1hTokens: 0,
					},
					usageRoute: "otel",
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
			accountingState: "incomplete",
			accountingIssues: [
				"keyless-request",
				"request-identity",
				"request-usage",
				"source-coverage",
			],
			normalizationIssues: [],
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
		const source = await sourceFixture();
		const childMessage = required(
			source.files.stream[1],
			"fixture has no child message",
		);
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

	it("partitions repeated request identities by session", async () => {
		const source = await sourceFixture();
		const mainLog = required(
			source.files.otelLogs[0],
			"fixture has no main log",
		);
		const attributes = objectAt(mainLog, "attributes");
		source.files.otelLogs.push({
			...mainLog,
			capture_ordinal: 90,
			attributes: { ...attributes, "session.id": "session-2" },
		});

		const evidence = normalizeContextEvidence(source);
		const repeated = evidence.projection.requests.filter(
			(request) => request.requestId === "req-main-1",
		);

		expect(repeated.map(({ sessionId }) => sessionId)).toEqual([
			"session-1",
			"session-2",
		]);
		expect(repeated[1]).toMatchObject({
			identityState: "single-source",
			agentId: null,
			attributionState: "missing",
		});
	});

	it("joins server and client request aliases without losing the client identity", async () => {
		const source = await sourceFixture();
		const serverLog = required(
			source.files.otelLogs[1],
			"fixture has no child log",
		);
		const clientLog = required(
			source.files.otelLogs[2],
			"fixture has no duplicate child log",
		);
		const serverAttributes = objectAt(serverLog, "attributes");
		const clientAttributes = objectAt(clientLog, "attributes");
		const { request_id: _requestId, ...clientOnlyAttributes } =
			clientAttributes;
		source.files.otelLogs[1] = {
			...serverLog,
			attributes: {
				...serverAttributes,
				client_request_id: "client-child-1",
			},
		};
		source.files.otelLogs[2] = {
			...clientLog,
			attributes: {
				...clientOnlyAttributes,
				client_request_id: "client-child-1",
			},
		};

		const evidence = normalizeContextEvidence(source);
		const childRequests = evidence.projection.requests.filter(
			(request) => request.requestId === "req-child-1",
		);

		expect(childRequests).toHaveLength(1);
		expect(childRequests[0]).toMatchObject({
			clientRequestIds: ["client-child-1"],
			identityState: "complete",
			otelOccurrences: 2,
			uniqueOtelOccurrences: 1,
			usageState: "complete",
		});
	});

	it("keeps an unmapped transcript path explicitly unattributed", async () => {
		const source = await sourceFixture();
		const mainLog = required(
			source.files.otelLogs[0],
			"fixture has no main log",
		);
		const mainRow = required(
			source.files.transcripts["transcripts/main.jsonl"]?.[0],
			"fixture has no main transcript row",
		);
		const logAttributes = objectAt(mainLog, "attributes");
		source.files.otelLogs.push({
			...mainLog,
			capture_ordinal: 91,
			attributes: { ...logAttributes, request_id: "req-orphan-1" },
		});
		source.files.transcripts["transcripts/unmapped.jsonl"] = [
			{ ...mainRow, uuid: "orphan-row", requestId: "req-orphan-1" },
		];

		const evidence = normalizeContextEvidence(source);

		expect(
			evidence.projection.requests.find(
				(request) => request.requestId === "req-orphan-1",
			),
		).toMatchObject({
			agentId: null,
			attributionState: "missing",
			identityState: "complete",
		});
		expect(evidence.projection.accountingIssues).toContain(
			"request-attribution",
		);
	});

	it("preserves conflicting transcript-path attribution", async () => {
		const source = await sourceFixture();
		const childStop = required(
			source.files.hooks[7],
			"fixture has no child stop",
		);
		source.files.hooks.push({
			...childStop,
			capture_ordinal: 92,
			agent_id: "agent-conflicting-1",
		});

		const evidence = normalizeContextEvidence(source);

		expect(
			evidence.projection.requests.find(
				(request) => request.requestId === "req-child-1",
			),
		).toMatchObject({ agentId: null, attributionState: "conflict" });
	});

	it("keeps conflicting request models out of calculated pricing", async () => {
		const source = await sourceFixture();
		const mainSpan = required(
			source.files.otelSpans[0],
			"fixture has no main span",
		);
		const attributes = objectAt(mainSpan, "attributes");
		source.files.otelSpans[0] = {
			...mainSpan,
			attributes: { ...attributes, model: "claude-conflicting-5" },
		};

		const evidence = normalizeContextEvidence(source, rates);
		const request = evidence.projection.requests.find(
			(candidate) => candidate.requestId === "req-main-1",
		);

		expect(request).toMatchObject({
			model: null,
			modelState: "conflict",
			pricing: { state: "model-conflict" },
		});
		expect(evidence.projection.accountingIssues).toContain("request-model");
	});

	it("prices each request from its model and reconciled cache TTL categories", async () => {
		const source = await sourceFixture();

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
					selectedRate: sonnetRate,
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
					selectedRate: sonnetRate,
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
					selectedRate: haikuRate,
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
			const source = await sourceFixture();
			const transcriptPath = "transcripts/subagents/agent-agent-review-1.jsonl";
			const rows = source.files.transcripts[transcriptPath] ?? [];
			const child = required(rows[0], "fixture has no child transcript");
			const remainingRows = rows.slice(1);
			const message = objectAt(child, "message");
			const usage = objectAt(message, "usage");
			const { cache_creation: _cacheCreation, ...usageWithoutCache } = usage;
			const revisedUsage =
				cache === undefined
					? usageWithoutCache
					: { ...usageWithoutCache, cache_creation: cache };
			const revisedSource = contextEvidenceSourceSchema.parse({
				...source,
				files: {
					...source.files,
					transcripts: {
						...source.files.transcripts,
						[transcriptPath]: [
							{ ...child, message: { ...message, usage: revisedUsage } },
							...remainingRows,
						],
					},
				},
			});

			const evidence = normalizeContextEvidence(revisedSource, rates);

			expect(
				evidence.projection.requests.find(
					(request) => request.requestId === "req-child-1",
				)?.pricing.state,
			).toBe(expected);
		},
	);

	it("rejects multiple distinct TTL splits even when each matches the aggregate", async () => {
		const source = await sourceFixture();
		const transcriptPath = "transcripts/subagents/agent-agent-review-1.jsonl";
		const child = required(
			source.files.transcripts[transcriptPath]?.[0],
			"fixture has no child transcript",
		);
		const message = objectAt(child, "message");
		const usage = objectAt(message, "usage");
		source.files.transcripts[transcriptPath]?.push({
			...child,
			uuid: "message-child-duplicate-split",
			message: {
				...message,
				usage: {
					...usage,
					cache_creation: {
						ephemeral_5m_input_tokens: 100,
						ephemeral_1h_input_tokens: 300,
					},
				},
			},
		});

		const evidence = normalizeContextEvidence(source, rates);

		expect(
			evidence.projection.requests.find(
				(request) => request.requestId === "req-child-1",
			)?.pricing.state,
		).toBe("ttl-split-conflict");
	});

	it("downgrades declared coverage when a recognized record is malformed", async () => {
		const source = await sourceFixture();
		source.files.coverage = source.files.coverage.map((entry) => ({
			...entry,
			state: "complete",
		}));
		source.files.otelLogs.push({
			capture_ordinal: 93,
			body: "claude_code.api_request",
			attributes: "malformed",
		});

		const evidence = normalizeContextEvidence(source);

		expect(evidence.projection.normalizationIssues).toContainEqual({
			stream: "otelLogs",
			sourceOrdinal: 93,
			code: "malformed-recognized-record",
			detail: "api_request record has no attributes",
		});
		expect(
			evidence.projection.coverage.find((entry) => entry.stream === "otelLogs"),
		).toEqual({
			stream: "otelLogs",
			state: "partial",
			reason: "normalization-issue",
		});
		expect(evidence.projection.accountingIssues).toContain(
			"malformed-source-record",
		);
	});

	it("does not overwrite conflicting coverage claims", async () => {
		const source = await sourceFixture();
		source.files.coverage.push({ stream: "hooks", state: "complete" });

		const evidence = normalizeContextEvidence(source);

		expect(
			evidence.projection.coverage.find((entry) => entry.stream === "hooks"),
		).toEqual({
			stream: "hooks",
			state: "partial",
			reason: "coverage-claim-conflict",
		});
	});

	it("rejects duplicate model rates and non-USD catalogs", () => {
		expect(
			contextRateCatalogSchema.safeParse({
				...rates,
				models: [sonnetRate, sonnetRate],
			}).success,
		).toBe(false);
		expect(
			contextRateCatalogSchema.safeParse({ ...rates, currency: "EUR" }).success,
		).toBe(false);
	});

	it("rejects persisted projections whose state contradicts their evidence", async () => {
		const evidence = normalizeContextEvidence(await sourceFixture(), rates);
		const pricedRequest = required(
			evidence.projection.requests.find(
				(request) => request.pricing.state === "complete",
			),
			"fixture has no priced request",
		);
		const pricing = required(
			pricedRequest.pricing.state === "complete"
				? pricedRequest.pricing
				: undefined,
			"fixture pricing is incomplete",
		);
		const pricedIndex = evidence.projection.requests.indexOf(pricedRequest);
		const beforePriced = evidence.projection.requests.slice(0, pricedIndex);
		const afterPriced = evidence.projection.requests.slice(pricedIndex + 1);
		const { usage: _usage, ...requestWithoutUsage } = pricedRequest;

		expect(
			contextEvidenceSchema.safeParse({
				...evidence,
				projection: {
					...evidence.projection,
					requests: [
						{ ...requestWithoutUsage, usageState: "complete" },
						...evidence.projection.requests.filter(
							(request) => request !== pricedRequest,
						),
					],
				},
			}).success,
		).toBe(false);
		expect(
			contextEvidenceSchema.safeParse({
				...evidence,
				projection: {
					...evidence.projection,
					accountingState: "complete",
				},
			}).success,
		).toBe(false);
		expect(
			contextEvidenceSchema.safeParse({
				...evidence,
				projection: {
					...evidence.projection,
					requests: [
						...beforePriced,
						{
							...pricedRequest,
							pricing: {
								...pricing,
								selectedRate: {
									...pricing.selectedRate,
									model: "wrong-model",
								},
							},
						},
						...afterPriced,
					],
				},
			}).success,
		).toBe(false);
		expect(
			contextEvidenceSchema.safeParse({
				...evidence,
				projection: {
					...evidence.projection,
					requests: [
						...beforePriced,
						{
							...pricedRequest,
							pricing: {
								...pricing,
								calculatedCostUsd: pricing.calculatedCostUsd + 1,
							},
						},
						...afterPriced,
					],
				},
			}).success,
		).toBe(false);
	});
});

describe("transcript-supplied request usage", () => {
	function transcriptOnlySource(
		usage: Readonly<JsonObject> | undefined,
	): ReturnType<typeof contextEvidenceSourceSchema.parse> {
		const message: JsonObject = { model: "claude-sonnet-5" };
		if (usage !== undefined) {
			message["usage"] = usage;
		}

		return contextEvidenceSourceSchema.parse({
			schemaVersion: 1,
			kind: "context-evidence-source",
			capture: {
				provider: "synthetic",
				cliVersion: "0.0.0",
				capturedAt: "2026-09-14T00:00:00.000Z",
				flags: [],
				telemetry: {},
			},
			files: {
				stream: [],
				hooks: [],
				otelLogs: [],
				otelSpans: [],
				transcripts: {
					"transcripts/main.jsonl": [
						{
							type: "assistant",
							sessionId: "session-1",
							uuid: "message-1",
							requestId: "req-transcript-1",
							message,
						},
					],
				},
				rawApiBodies: [],
				coverage: [{ stream: "otelLogs", state: "unavailable" }],
			},
		});
	}

	const fullUsage = {
		input_tokens: 11,
		output_tokens: 22,
		cache_read_input_tokens: 3300,
		cache_creation_input_tokens: 440,
		cache_creation: {
			ephemeral_5m_input_tokens: 400,
			ephemeral_1h_input_tokens: 40,
		},
	};

	function alsoObservedByOtel(
		tokenAttributes: Readonly<JsonObject>,
	): ReturnType<typeof contextEvidenceSourceSchema.parse> {
		const source = transcriptOnlySource(fullUsage);
		source.files.otelLogs.push({
			capture_ordinal: 1,
			body: "claude_code.api_request",
			attributes: {
				"event.name": "api_request",
				"session.id": "session-1",
				"prompt.id": "prompt-1",
				"event.sequence": 1,
				request_id: "req-transcript-1",
				model: "claude-sonnet-5",
				cost_usd: 0.04,
				...tokenAttributes,
			},
		});

		return source;
	}

	it("reports complete usage with every category from a transcript carrying no otel rows", () => {
		const evidence = normalizeContextEvidence(transcriptOnlySource(fullUsage));

		const [request] = evidence.projection.requests;

		expect(request?.usageState).toBe("complete");
		expect(request?.usage).toEqual({
			inputTokens: 11,
			outputTokens: 22,
			cacheReadTokens: 3300,
			cacheWriteTokens: 440,
			cacheWrite5mTokens: 400,
			cacheWrite1hTokens: 40,
		});
	});

	it("names the transcript as the route that supplied the usage", () => {
		const evidence = normalizeContextEvidence(transcriptOnlySource(fullUsage));

		const [request] = evidence.projection.requests;

		expect(request?.usageRoute).toBe("transcript");
	});

	it("names otel as the route when otel supplied the usage", async () => {
		const evidence = normalizeContextEvidence(await sourceFixture());

		const otelSupplied = evidence.projection.requests.find(
			(request) => request.requestId === "req-main-1",
		);

		expect(otelSupplied?.usageRoute).toBe("otel");
	});

	it("reports missing when the transcript row carries no usage", () => {
		const evidence = normalizeContextEvidence(transcriptOnlySource(undefined));

		const [request] = evidence.projection.requests;

		expect(request?.usageState).toBe("missing");
		expect(request?.usageRoute).toBeUndefined();
	});

	it("parses a record written before the route existed, without adding one", async () => {
		const evidence = normalizeContextEvidence(await sourceFixture());
		const legacyRequests = evidence.projection.requests.map((request) => {
			const { usageRoute: _written, ...withoutRoute } = request;

			return withoutRoute;
		});

		const parsed = contextEvidenceSchema.parse({
			...evidence,
			projection: { ...evidence.projection, requests: legacyRequests },
		});

		expect(
			parsed.projection.requests.every(
				(request) => request.usageRoute === undefined,
			),
		).toBe(true);
	});

	it("rejects a route naming evidence no usage came from", async () => {
		const evidence = normalizeContextEvidence(await sourceFixture());
		const [first, ...rest] = evidence.projection.requests;
		const { usage: _dropped, ...withoutUsage } = required(
			first,
			"fixture has no requests",
		);

		expect(
			contextEvidenceSchema.safeParse({
				...evidence,
				projection: {
					...evidence.projection,
					requests: [{ ...withoutUsage, usageState: "missing" }, ...rest],
				},
			}).success,
		).toBe(false);
	});

	it("keeps agreeing duplicate transcript rows as one complete reading", () => {
		const source = transcriptOnlySource(fullUsage);
		const rows = source.files.transcripts["transcripts/main.jsonl"];
		const first = required(rows?.[0], "fixture has no transcript row");
		rows?.push({ ...first, uuid: "message-2" });

		const evidence = normalizeContextEvidence(source);

		const [request] = evidence.projection.requests;

		expect(request?.usageState).toBe("complete");
		expect(request?.usageRoute).toBe("transcript");
	});

	it("leaves a request unpriced when its otel row carried no tokens", () => {
		const evidence = normalizeContextEvidence(alsoObservedByOtel({}));

		const [request] = evidence.projection.requests;

		expect(request?.otelOccurrences).toBe(1);
		expect(request?.usageState).toBe("partial");
		expect(request?.usage).toBeUndefined();
		expect(request?.pricing).toEqual({ state: "usage-missing" });
	});

	it("reports conflict when otel and the transcript disagree on one request", () => {
		const evidence = normalizeContextEvidence(
			alsoObservedByOtel({
				input_tokens: 99,
				output_tokens: 22,
				cache_read_tokens: 3300,
				cache_creation_tokens: 440,
			}),
		);

		const [request] = evidence.projection.requests;

		expect(request?.usageState).toBe("conflict");
		expect(request?.usage).toBeUndefined();
		expect(request?.usageRoute).toBeUndefined();
		expect(request?.pricing).toEqual({ state: "usage-conflict" });
	});

	it("rejects a route naming a source the record never observed", async () => {
		const evidence = normalizeContextEvidence(await sourceFixture());
		const [first, ...rest] = evidence.projection.requests;
		const otelSupplied = required(first, "fixture has no requests");

		expect(
			contextEvidenceSchema.safeParse({
				...evidence,
				projection: {
					...evidence.projection,
					requests: [
						{ ...otelSupplied, otelOccurrences: 0, uniqueOtelOccurrences: 0 },
						...rest,
					],
				},
			}).success,
		).toBe(false);
	});

	it("reports conflict when two transcript rows disagree on one request", () => {
		const source = transcriptOnlySource(fullUsage);
		const rows = required(
			source.files.transcripts["transcripts/main.jsonl"],
			"fixture has no transcript file",
		);
		const first = required(rows[0], "fixture has no transcript row");
		rows.push({
			...first,
			uuid: "message-2",
			message: {
				model: "claude-sonnet-5",
				usage: { ...fullUsage, input_tokens: 99 },
			},
		});

		const evidence = normalizeContextEvidence(source);

		const [request] = evidence.projection.requests;

		expect(request?.usageState).toBe("conflict");
		expect(request?.usage).toBeUndefined();
		expect(request?.usageRoute).toBeUndefined();
	});
});
