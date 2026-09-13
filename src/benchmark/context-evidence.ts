import type { JsonObject, JsonValue } from "./json-value";
import { contextEvidenceSchema } from "./context-evidence-contract";
import type {
	ContextEvidence,
	ContextEvidenceSource,
	ContextRateCatalog,
} from "./context-evidence-contract";

export {
	contextEvidenceSchema,
	contextEvidenceSourceSchema,
	contextRateCatalogSchema,
} from "./context-evidence-contract";
export type {
	ContextEvidence,
	ContextEvidenceSource,
	ContextRateCatalog,
} from "./context-evidence-contract";

function objectValue(record: JsonObject, key: string): JsonObject | undefined {
	const value = record[key];

	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as JsonObject)
		: undefined;
}

function stringValue(record: JsonObject, key: string): string | undefined {
	const value = record[key];

	return typeof value === "string" ? value : undefined;
}

function numberValue(record: JsonObject, key: string): number | undefined {
	const value = record[key];

	return typeof value === "number" ? value : undefined;
}

function nullableStringValue(
	record: JsonObject,
	key: string,
): string | null | undefined {
	const value = record[key];

	return value === null || typeof value === "string" ? value : undefined;
}

function arrayValue(record: JsonObject, key: string): readonly JsonValue[] {
	const value = record[key];

	return Array.isArray(value) ? value : [];
}

function canonicalJson(value: JsonValue): string {
	if (Array.isArray(value)) {
		return "[" + value.map((entry) => canonicalJson(entry)).join(",") + "]";
	}
	if (value !== null && typeof value === "object") {
		return (
			"{" +
			Object.entries(value)
				.toSorted(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => JSON.stringify(key) + ":" + canonicalJson(entry))
				.join(",") +
			"}"
		);
	}

	return JSON.stringify(value);
}

interface TranscriptIndexes {
	readonly agentByPath: ReadonlyMap<string, string>;
	readonly byUuid: ReadonlyMap<
		string,
		{ readonly path: string; readonly row: JsonObject }
	>;
	readonly byRequest: ReadonlyMap<string, readonly JsonObject[]>;
	readonly agentCandidatesByRequest: ReadonlyMap<string, ReadonlySet<string>>;
	readonly agentToolOwner: ReadonlyMap<string, string>;
}

function transcriptIndexes(
	files: ContextEvidenceSource["files"],
): TranscriptIndexes {
	const agentByPath = new Map<string, string>([
		["transcripts/main.jsonl", "main"],
	]);
	for (const hook of files.hooks) {
		if (stringValue(hook, "hook_event_name") !== "SubagentStop") continue;
		const path = stringValue(hook, "agent_transcript_path");
		const agentId = stringValue(hook, "agent_id");
		if (path !== undefined && agentId !== undefined)
			agentByPath.set(path, agentId);
	}

	const byUuid = new Map<string, { path: string; row: JsonObject }>();
	const byRequest = new Map<string, JsonObject[]>();
	const agentCandidatesByRequest = new Map<string, Set<string>>();
	const agentToolOwner = new Map<string, string>();
	for (const [path, rows] of Object.entries(files.transcripts)) {
		const agentId = agentByPath.get(path) ?? "orphan:" + path;
		for (const row of rows) {
			const uuid = stringValue(row, "uuid");
			if (uuid !== undefined) byUuid.set(uuid, { path, row });
			const requestId = stringValue(row, "requestId");
			if (requestId !== undefined) {
				byRequest.set(requestId, [...(byRequest.get(requestId) ?? []), row]);
				const candidates = agentCandidatesByRequest.get(requestId) ?? new Set();
				candidates.add(agentId);
				agentCandidatesByRequest.set(requestId, candidates);
			}
			const message = objectValue(row, "message");
			for (const content of message === undefined
				? []
				: arrayValue(message, "content")) {
				if (
					content === null ||
					typeof content !== "object" ||
					Array.isArray(content)
				)
					continue;
				const block = content as JsonObject;
				if (
					stringValue(block, "type") !== "tool_use" ||
					stringValue(block, "name") !== "Agent"
				)
					continue;
				const toolUseId = stringValue(block, "id");
				if (toolUseId !== undefined) agentToolOwner.set(toolUseId, agentId);
			}
		}
	}

	return {
		agentByPath,
		byUuid,
		byRequest,
		agentCandidatesByRequest,
		agentToolOwner,
	};
}

function normalizedAgents(
	files: ContextEvidenceSource["files"],
	indexes: TranscriptIndexes,
): ContextEvidence["projection"]["agents"] {
	const streamParents = new Map<string, Set<string>>();
	for (const row of files.stream) {
		const uuid = stringValue(row, "uuid");
		const parentTool = nullableStringValue(row, "parent_tool_use_id");
		if (uuid === undefined || parentTool === undefined || parentTool === null)
			continue;
		const transcript = indexes.byUuid.get(uuid);
		const child = transcript && indexes.agentByPath.get(transcript.path);
		const parent = indexes.agentToolOwner.get(parentTool);
		if (child !== undefined && parent !== undefined) {
			const candidates = streamParents.get(child) ?? new Set();
			candidates.add(parent);
			streamParents.set(child, candidates);
		}
	}

	const traceParents = new Map<string, Set<string>>();
	const agentIds = new Set<string>();
	for (const hook of files.hooks) {
		const agentId = stringValue(hook, "agent_id");
		if (agentId !== undefined) agentIds.add(agentId);
	}
	for (const span of files.otelSpans) {
		const attributes = objectValue(span, "attributes");
		if (attributes === undefined) continue;
		const agentId = stringValue(attributes, "agent_id");
		const parentId = stringValue(attributes, "parent_agent_id");
		if (agentId !== undefined) agentIds.add(agentId);
		if (agentId !== undefined && parentId !== undefined) {
			const candidates = traceParents.get(agentId) ?? new Set();
			candidates.add(parentId);
			traceParents.set(agentId, candidates);
		}
	}

	return [...agentIds].sort().map((agentId) => {
		const streamCandidates = streamParents.get(agentId) ?? new Set<string>();
		const traceCandidates = traceParents.get(agentId) ?? new Set<string>();
		const parentCandidates = new Set([...streamCandidates, ...traceCandidates]);
		const conflict = parentCandidates.size > 1;
		const sources = [
			streamCandidates.size === 0 ? undefined : ("stream" as const),
			traceCandidates.size === 0 ? undefined : ("trace" as const),
		].filter((source): source is "stream" | "trace" => source !== undefined);
		const parentAgentId = conflict
			? null
			: (parentCandidates.values().next().value ?? null);
		const lineageState = conflict
			? ("conflict" as const)
			: sources.length > 1
				? ("complete" as const)
				: sources.length === 1
					? parentAgentId === "main"
						? ("complete" as const)
						: ("single-source" as const)
					: ("missing" as const);

		return { agentId, parentAgentId, lineageState, sources };
	});
}

function usageFrom(
	attributes: JsonObject,
): ContextEvidence["projection"]["requests"][number]["usage"] | undefined {
	const inputTokens = numberValue(attributes, "input_tokens");
	const outputTokens = numberValue(attributes, "output_tokens");
	const cacheReadTokens = numberValue(attributes, "cache_read_tokens");
	const cacheWriteTokens = numberValue(attributes, "cache_creation_tokens");
	if (
		inputTokens === undefined ||
		outputTokens === undefined ||
		cacheReadTokens === undefined ||
		cacheWriteTokens === undefined
	)
		return undefined;

	return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens };
}

function ttlSplit(
	rows: readonly JsonObject[],
): { readonly five: number; readonly one: number } | undefined {
	for (const row of rows) {
		const message = objectValue(row, "message");
		const usage = message && objectValue(message, "usage");
		const cache = usage && objectValue(usage, "cache_creation");
		if (cache === undefined) continue;
		const five = numberValue(cache, "ephemeral_5m_input_tokens");
		const one = numberValue(cache, "ephemeral_1h_input_tokens");
		if (five !== undefined && one !== undefined) return { five, one };
	}

	return undefined;
}

function requestModel(
	log: JsonObject | undefined,
	transcripts: readonly JsonObject[],
): string | null {
	const attributes = log && objectValue(log, "attributes");
	const fromLog = attributes && stringValue(attributes, "model");
	if (fromLog !== undefined) return fromLog;
	for (const row of transcripts) {
		const message = objectValue(row, "message");
		const model = message && stringValue(message, "model");
		if (model !== undefined) return model;
	}

	return null;
}

function requestPricing(
	usageState: ContextEvidence["projection"]["requests"][number]["usageState"],
	usage: ContextEvidence["projection"]["requests"][number]["usage"],
	model: string | null,
	rates: ContextRateCatalog | undefined,
): ContextEvidence["projection"]["requests"][number]["pricing"] {
	if (usageState === "conflict") return { state: "usage-conflict" };
	if (usageState !== "complete" || usage === undefined)
		return { state: "usage-missing" };
	if (
		usage.cacheWrite5mTokens === undefined ||
		usage.cacheWrite1hTokens === undefined
	)
		return { state: "ttl-split-missing" };
	if (
		usage.cacheWrite5mTokens + usage.cacheWrite1hTokens !==
		usage.cacheWriteTokens
	)
		return { state: "ttl-split-conflict" };
	const rate = rates?.models.find((entry) => entry.model === model);
	if (rates === undefined || rate === undefined)
		return { state: "rates-missing" };

	return {
		state: "complete",
		calculatedCostUsd:
			(usage.inputTokens * rate.inputUsdPerMillion +
				usage.outputTokens * rate.outputUsdPerMillion +
				usage.cacheReadTokens * rate.cacheReadUsdPerMillion +
				usage.cacheWrite5mTokens * rate.cacheWrite5mUsdPerMillion +
				usage.cacheWrite1hTokens * rate.cacheWrite1hUsdPerMillion) /
			1_000_000,
		rateSource: rates.source,
		rateVersion: rates.version,
		currency: rates.currency,
	};
}

function normalizedRequests(
	files: ContextEvidenceSource["files"],
	indexes: TranscriptIndexes,
	rates: ContextRateCatalog | undefined,
): Pick<
	ContextEvidence["projection"],
	"requests" | "keylessRequests" | "accountingState"
> {
	const byRequest = new Map<string, JsonObject[]>();
	const keyless: JsonObject[] = [];
	const agentCandidates = new Map(
		[...indexes.agentCandidatesByRequest].map(([requestId, values]) => [
			requestId,
			new Set(values),
		]),
	);
	for (const log of files.otelLogs) {
		const attributes = objectValue(log, "attributes");
		if (
			attributes === undefined ||
			stringValue(attributes, "event.name") !== "api_request"
		)
			continue;
		const requestId =
			stringValue(attributes, "request_id") ??
			stringValue(attributes, "client_request_id");
		if (requestId === undefined) {
			keyless.push(log);
			continue;
		}
		byRequest.set(requestId, [...(byRequest.get(requestId) ?? []), log]);
	}
	for (const span of files.otelSpans) {
		const attributes = objectValue(span, "attributes");
		if (attributes === undefined) continue;
		const requestId = stringValue(attributes, "request_id");
		const agentId = stringValue(attributes, "agent_id");
		if (requestId !== undefined && agentId !== undefined) {
			const candidates = agentCandidates.get(requestId) ?? new Set();
			candidates.add(agentId);
			agentCandidates.set(requestId, candidates);
		}
	}

	const requestIds = new Set([
		...byRequest.keys(),
		...indexes.byRequest.keys(),
	]);
	const requests = [...requestIds].sort().map((requestId) => {
		const logs = byRequest.get(requestId) ?? [];
		const unique = new Map<string, JsonObject>();
		for (const log of logs) {
			const attributes = objectValue(log, "attributes");
			if (attributes !== undefined) unique.set(canonicalJson(attributes), log);
		}
		const distinct = [...unique.values()];
		const transcriptRows = indexes.byRequest.get(requestId) ?? [];
		const candidates = [...(agentCandidates.get(requestId) ?? [])];
		const agentId = candidates.length === 1 ? (candidates[0] ?? null) : null;
		const attributionState =
			candidates.length === 0
				? ("missing" as const)
				: candidates.length > 1
					? ("conflict" as const)
					: undefined;
		const attributes =
			distinct.length === 1
				? objectValue(distinct[0] ?? {}, "attributes")
				: undefined;
		const baseUsage = attributes && usageFrom(attributes);
		const split = ttlSplit(transcriptRows);
		const usage =
			baseUsage === undefined
				? undefined
				: {
						...baseUsage,
						...(split === undefined
							? {}
							: {
									cacheWrite5mTokens: split.five,
									cacheWrite1hTokens: split.one,
								}),
					};
		const usageState =
			logs.length === 0
				? ("missing" as const)
				: distinct.length > 1
					? ("conflict" as const)
					: baseUsage === undefined
						? ("partial" as const)
						: ("complete" as const);
		const providerCostUsd = attributes && numberValue(attributes, "cost_usd");
		const model = requestModel(distinct[0], transcriptRows);

		return {
			requestId,
			agentId,
			...(attributionState === undefined ? {} : { attributionState }),
			model,
			usageState,
			...(usage === undefined ? {} : { usage }),
			...(providerCostUsd === undefined ? {} : { providerCostUsd }),
			pricing: requestPricing(usageState, usage, model, rates),
			otelOccurrences: logs.length,
			uniqueOtelOccurrences: distinct.length,
			transcriptOccurrences: transcriptRows.length,
		};
	});

	return {
		requests,
		keylessRequests: keyless.map((record) => ({
			occurrenceId:
				"otel-log:" + String(numberValue(record, "capture_ordinal")),
			state: "identity-missing-no-dedup" as const,
		})),
		accountingState:
			keyless.length === 0 ? "complete" : "incomplete-keyless-occurrences",
	};
}

function normalizedLoads(
	files: ContextEvidenceSource["files"],
): ContextEvidence["projection"]["instructionLoads"] {
	return files.hooks.flatMap((hook) => {
		if (stringValue(hook, "hook_event_name") !== "InstructionsLoaded")
			return [];
		const sourceOrdinal = numberValue(hook, "capture_ordinal");
		const filePath = stringValue(hook, "file_path");
		const memoryType = stringValue(hook, "memory_type");
		const loadReason = stringValue(hook, "load_reason");
		if (
			sourceOrdinal === undefined ||
			filePath === undefined ||
			memoryType === undefined ||
			loadReason === undefined
		)
			return [];
		const promptId = nullableStringValue(hook, "prompt_id") ?? null;
		const agentId = stringValue(hook, "agent_id") ?? "main";
		const triggerFilePath = stringValue(hook, "trigger_file_path");
		const parentFilePath = stringValue(hook, "parent_file_path");
		const globs = arrayValue(hook, "globs").filter(
			(value): value is string => typeof value === "string",
		);

		return [
			{
				sourceOrdinal,
				agentId,
				promptId,
				filePath,
				memoryType,
				loadReason,
				...(triggerFilePath === undefined ? {} : { triggerFilePath }),
				...(parentFilePath === undefined ? {} : { parentFilePath }),
				...(globs.length === 0 ? {} : { globs }),
			},
		];
	});
}

function normalizedCompactions(
	files: ContextEvidenceSource["files"],
): ContextEvidence["projection"]["compactions"] {
	return files.hooks.flatMap((hook) => {
		const event = stringValue(hook, "hook_event_name");
		if (event !== "PreCompact" && event !== "PostCompact") return [];
		const sourceOrdinal = numberValue(hook, "capture_ordinal");
		const trigger = stringValue(hook, "trigger");
		if (sourceOrdinal === undefined || trigger === undefined) return [];

		return [
			{
				sourceOrdinal,
				agentId: stringValue(hook, "agent_id") ?? "main",
				promptId: nullableStringValue(hook, "prompt_id") ?? null,
				phase: event === "PreCompact" ? ("pre" as const) : ("post" as const),
				trigger,
				...(event === "PostCompact"
					? {
							summaryAvailable:
								stringValue(hook, "compact_summary") !== undefined,
						}
					: {}),
			},
		];
	});
}

export function normalizeContextEvidence(
	source: ContextEvidenceSource,
	rates?: ContextRateCatalog,
): ContextEvidence {
	const indexes = transcriptIndexes(source.files);
	const requests = normalizedRequests(source.files, indexes, rates);
	const projection: ContextEvidence["projection"] = {
		agents: normalizedAgents(source.files, indexes),
		...requests,
		instructionLoads: normalizedLoads(source.files),
		compactions: normalizedCompactions(source.files),
		rawApiBodies: source.files.rawApiBodies.flatMap((record) => {
			const sourceOrdinal = numberValue(record, "capture_ordinal");
			const bodyRef = stringValue(record, "body_ref");
			return sourceOrdinal === undefined || bodyRef === undefined
				? []
				: [
						{
							sourceOrdinal,
							bodyRef,
							requestId: null,
							state: "unassigned-no-documented-key" as const,
						},
					];
		}),
		coverage: source.files.coverage.flatMap((record) => {
			const stream = stringValue(record, "stream");
			const state = stringValue(record, "state");
			if (
				stream === undefined ||
				(state !== "complete" && state !== "partial" && state !== "unavailable")
			)
				return [];
			const reason = stringValue(record, "reason");
			return [{ stream, state, ...(reason === undefined ? {} : { reason }) }];
		}),
	};

	return contextEvidenceSchema.parse({ schemaVersion: 1, source, projection });
}
