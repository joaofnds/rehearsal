import { z } from "zod";
import { jsonObjectSchema, jsonValueSchema } from "./json-value";
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

const stringSchema = z.string();
const numberSchema = z.number();
const nullableStringSchema = z.string().nullable();
const jsonArraySchema = z.array(jsonValueSchema);
const coverageStateSchema = z.enum(["complete", "partial", "unavailable"]);

function asObject(value: JsonValue): JsonObject | undefined {
	const parsed = jsonObjectSchema.safeParse(value);

	return parsed.success ? parsed.data : undefined;
}

function objectValue(
	record: Readonly<JsonObject>,
	key: string,
): JsonObject | undefined {
	return asObject(record[key] ?? null);
}

function stringValue(
	record: Readonly<JsonObject>,
	key: string,
): string | undefined {
	const parsed = stringSchema.safeParse(record[key]);

	return parsed.success ? parsed.data : undefined;
}

function numberValue(
	record: Readonly<JsonObject>,
	key: string,
): number | undefined {
	const parsed = numberSchema.safeParse(record[key]);

	return parsed.success ? parsed.data : undefined;
}

function nullableStringValue(
	record: Readonly<JsonObject>,
	key: string,
): string | null | undefined {
	const parsed = nullableStringSchema.safeParse(record[key]);

	return parsed.success ? parsed.data : undefined;
}

function arrayValue(
	record: Readonly<JsonObject>,
	key: string,
): readonly JsonValue[] {
	const parsed = jsonArraySchema.safeParse(record[key]);

	return parsed.success ? parsed.data : [];
}

function canonicalJson(value: JsonValue): string {
	const array = jsonArraySchema.safeParse(value);
	if (array.success) {
		return `[${array.data.map((entry) => canonicalJson(entry)).join(",")}]`;
	}
	const object = jsonObjectSchema.safeParse(value);
	if (object.success) {
		return `{${Object.entries(object.data)
			.toSorted(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
			.join(",")}}`;
	}

	return JSON.stringify(value) ?? "null";
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

type AgentLineageState =
	ContextEvidence["projection"]["agents"][number]["lineageState"];

function agentLineageState(
	conflict: boolean,
	sourceCount: number,
	parentAgentId: string | null,
): AgentLineageState {
	if (conflict) {
		return "conflict";
	}
	if (sourceCount > 1 || (sourceCount === 1 && parentAgentId === "main")) {
		return "complete";
	}
	if (sourceCount === 1) {
		return "single-source";
	}

	return "missing";
}

function transcriptIndexes(
	files: ContextEvidenceSource["files"],
): TranscriptIndexes {
	const agentByPath = new Map<string, string>([
		["transcripts/main.jsonl", "main"],
	]);
	for (const hook of files.hooks) {
		if (stringValue(hook, "hook_event_name") !== "SubagentStop") {
			continue;
		}
		const path = stringValue(hook, "agent_transcript_path");
		const agentId = stringValue(hook, "agent_id");
		if (path !== undefined && agentId !== undefined) {
			agentByPath.set(path, agentId);
		}
	}

	const byUuid = new Map<string, { path: string; row: JsonObject }>();
	const byRequest = new Map<string, JsonObject[]>();
	const agentCandidatesByRequest = new Map<string, Set<string>>();
	const agentToolOwner = new Map<string, string>();
	for (const [path, rows] of Object.entries(files.transcripts)) {
		const agentId = agentByPath.get(path) ?? `orphan:${path}`;
		for (const row of rows) {
			const uuid = stringValue(row, "uuid");
			if (uuid !== undefined) {
				byUuid.set(uuid, { path, row });
			}
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
				const block = asObject(content);
				if (block === undefined) {
					continue;
				}
				if (
					stringValue(block, "type") !== "tool_use" ||
					stringValue(block, "name") !== "Agent"
				) {
					continue;
				}
				const toolUseId = stringValue(block, "id");
				if (toolUseId !== undefined) {
					agentToolOwner.set(toolUseId, agentId);
				}
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
		if (uuid === undefined || parentTool === undefined || parentTool === null) {
			continue;
		}
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
		if (agentId !== undefined) {
			agentIds.add(agentId);
		}
	}
	for (const span of files.otelSpans) {
		const attributes = objectValue(span, "attributes");
		if (attributes === undefined) {
			continue;
		}
		const agentId = stringValue(attributes, "agent_id");
		const parentId = stringValue(attributes, "parent_agent_id");
		if (agentId !== undefined) {
			agentIds.add(agentId);
		}
		if (agentId !== undefined && parentId !== undefined) {
			const candidates = traceParents.get(agentId) ?? new Set();
			candidates.add(parentId);
			traceParents.set(agentId, candidates);
		}
	}

	return [...agentIds].toSorted().map((agentId) => {
		const streamCandidates = streamParents.get(agentId) ?? new Set<string>();
		const traceCandidates = traceParents.get(agentId) ?? new Set<string>();
		const parentCandidates = new Set([...streamCandidates, ...traceCandidates]);
		const conflict = parentCandidates.size > 1;
		const sources: ("stream" | "trace")[] = [];
		if (streamCandidates.size > 0) {
			sources.push("stream");
		}
		if (traceCandidates.size > 0) {
			sources.push("trace");
		}
		const parentAgentId = conflict
			? null
			: (parentCandidates.values().next().value ?? null);
		const lineageState = agentLineageState(
			conflict,
			sources.length,
			parentAgentId,
		);

		return { agentId, parentAgentId, lineageState, sources };
	});
}

function usageFrom(
	attributes: Readonly<JsonObject>,
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
	) {
		return undefined;
	}

	return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens };
}

function ttlSplit(
	rows: readonly Readonly<JsonObject>[],
): { readonly five: number; readonly one: number } | undefined {
	for (const row of rows) {
		const message = objectValue(row, "message");
		const usage = message && objectValue(message, "usage");
		const cache = usage && objectValue(usage, "cache_creation");
		if (cache === undefined) {
			continue;
		}
		const five = numberValue(cache, "ephemeral_5m_input_tokens");
		const one = numberValue(cache, "ephemeral_1h_input_tokens");
		if (five !== undefined && one !== undefined) {
			return { five, one };
		}
	}

	return undefined;
}

function requestModel(
	log: Readonly<JsonObject> | undefined,
	transcripts: readonly Readonly<JsonObject>[],
): string | null {
	const attributes = log && objectValue(log, "attributes");
	const fromLog = attributes && stringValue(attributes, "model");
	if (fromLog !== undefined) {
		return fromLog;
	}
	for (const row of transcripts) {
		const message = objectValue(row, "message");
		const model = message && stringValue(message, "model");
		if (model !== undefined) {
			return model;
		}
	}

	return null;
}

function requestPricing(
	usageState: ContextEvidence["projection"]["requests"][number]["usageState"],
	usage: ContextEvidence["projection"]["requests"][number]["usage"],
	model: string | null,
	rates: ContextRateCatalog | undefined,
): ContextEvidence["projection"]["requests"][number]["pricing"] {
	if (usageState === "conflict") {
		return { state: "usage-conflict" };
	}
	if (usageState !== "complete" || usage === undefined) {
		return { state: "usage-missing" };
	}
	if (
		usage.cacheWrite5mTokens === undefined ||
		usage.cacheWrite1hTokens === undefined
	) {
		return { state: "ttl-split-missing" };
	}
	if (
		usage.cacheWrite5mTokens + usage.cacheWrite1hTokens !==
		usage.cacheWriteTokens
	) {
		return { state: "ttl-split-conflict" };
	}
	const rate = rates?.models.find((entry) => entry.model === model);
	if (rates === undefined || rate === undefined) {
		return { state: "rates-missing" };
	}

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

type RequestEvidence = ContextEvidence["projection"]["requests"][number];
type RequestUsage = NonNullable<RequestEvidence["usage"]>;

function usageWithSplit(
	baseUsage: RequestUsage | undefined,
	split: { readonly five: number; readonly one: number } | undefined,
): RequestUsage | undefined {
	if (baseUsage === undefined) {
		return undefined;
	}
	const usage = { ...baseUsage };
	if (split !== undefined) {
		Object.assign(usage, {
			cacheWrite5mTokens: split.five,
			cacheWrite1hTokens: split.one,
		});
	}

	return usage;
}

function requestUsageState(
	logCount: number,
	distinctCount: number,
	baseUsage: RequestUsage | undefined,
): RequestEvidence["usageState"] {
	if (logCount === 0) {
		return "missing";
	}
	if (distinctCount > 1) {
		return "conflict";
	}

	return baseUsage === undefined ? "partial" : "complete";
}

function uniqueRequestLogs(
	logs: readonly Readonly<JsonObject>[],
): readonly JsonObject[] {
	const unique = new Map<string, JsonObject>();
	for (const log of logs) {
		const attributes = objectValue(log, "attributes");
		if (attributes !== undefined) {
			unique.set(canonicalJson(attributes), log);
		}
	}

	return [...unique.values()];
}

function normalizedRequest(
	requestId: string,
	logs: readonly Readonly<JsonObject>[],
	transcriptRows: readonly Readonly<JsonObject>[],
	candidateSet: ReadonlySet<string>,
	rates: ContextRateCatalog | undefined,
): RequestEvidence {
	const distinct = uniqueRequestLogs(logs);
	const candidates = [...candidateSet];
	const [onlyCandidate] = candidates;
	const agentId = candidates.length === 1 ? (onlyCandidate ?? null) : null;
	const [firstDistinct] = distinct;
	const attributes =
		distinct.length === 1 && firstDistinct !== undefined
			? objectValue(firstDistinct, "attributes")
			: undefined;
	const baseUsage =
		attributes === undefined ? undefined : usageFrom(attributes);
	const usage = usageWithSplit(baseUsage, ttlSplit(transcriptRows));
	const usageState = requestUsageState(logs.length, distinct.length, baseUsage);
	const providerCostUsd =
		attributes === undefined ? undefined : numberValue(attributes, "cost_usd");
	const model = requestModel(firstDistinct, transcriptRows);
	const request = {
		requestId,
		agentId,
		model,
		usageState,
		pricing: requestPricing(usageState, usage, model, rates),
		otelOccurrences: logs.length,
		uniqueOtelOccurrences: distinct.length,
		transcriptOccurrences: transcriptRows.length,
	};
	if (candidates.length === 0) {
		Object.assign(request, { attributionState: "missing" as const });
	} else if (candidates.length > 1) {
		Object.assign(request, { attributionState: "conflict" as const });
	}
	if (usage !== undefined) {
		Object.assign(request, { usage });
	}
	if (providerCostUsd !== undefined) {
		Object.assign(request, { providerCostUsd });
	}

	return request;
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
	const agentCandidates = new Map<string, Set<string>>();
	for (const [requestId, values] of indexes.agentCandidatesByRequest) {
		agentCandidates.set(requestId, new Set(values));
	}
	for (const log of files.otelLogs) {
		const attributes = objectValue(log, "attributes");
		if (
			attributes === undefined ||
			stringValue(attributes, "event.name") !== "api_request"
		) {
			continue;
		}
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
		if (attributes === undefined) {
			continue;
		}
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
	const requests = [...requestIds].toSorted().map((requestId) => {
		const logs = byRequest.get(requestId) ?? [];
		const transcriptRows = indexes.byRequest.get(requestId) ?? [];

		return normalizedRequest(
			requestId,
			logs,
			transcriptRows,
			agentCandidates.get(requestId) ?? new Set(),
			rates,
		);
	});

	return {
		requests,
		keylessRequests: keyless.map((record) => ({
			occurrenceId: `otel-log:${String(numberValue(record, "capture_ordinal"))}`,
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
		if (stringValue(hook, "hook_event_name") !== "InstructionsLoaded") {
			return [];
		}
		const sourceOrdinal = numberValue(hook, "capture_ordinal");
		const filePath = stringValue(hook, "file_path");
		const memoryType = stringValue(hook, "memory_type");
		const loadReason = stringValue(hook, "load_reason");
		if (
			sourceOrdinal === undefined ||
			filePath === undefined ||
			memoryType === undefined ||
			loadReason === undefined
		) {
			return [];
		}
		const promptId = nullableStringValue(hook, "prompt_id") ?? null;
		const agentId = stringValue(hook, "agent_id") ?? "main";
		const triggerFilePath = stringValue(hook, "trigger_file_path");
		const parentFilePath = stringValue(hook, "parent_file_path");
		const globs = arrayValue(hook, "globs").flatMap((value) => {
			const parsed = stringSchema.safeParse(value);

			return parsed.success ? [parsed.data] : [];
		});
		const load = {
			sourceOrdinal,
			agentId,
			promptId,
			filePath,
			memoryType,
			loadReason,
		};
		if (triggerFilePath !== undefined) {
			Object.assign(load, { triggerFilePath });
		}
		if (parentFilePath !== undefined) {
			Object.assign(load, { parentFilePath });
		}
		if (globs.length > 0) {
			Object.assign(load, { globs });
		}

		return [load];
	});
}

function normalizedCompactions(
	files: ContextEvidenceSource["files"],
): ContextEvidence["projection"]["compactions"] {
	return files.hooks.flatMap((hook) => {
		const event = stringValue(hook, "hook_event_name");
		if (event !== "PreCompact" && event !== "PostCompact") {
			return [];
		}
		const sourceOrdinal = numberValue(hook, "capture_ordinal");
		const trigger = stringValue(hook, "trigger");
		if (sourceOrdinal === undefined || trigger === undefined) {
			return [];
		}
		const compaction = {
			sourceOrdinal,
			agentId: stringValue(hook, "agent_id") ?? "main",
			promptId: nullableStringValue(hook, "prompt_id") ?? null,
			phase: event === "PreCompact" ? ("pre" as const) : ("post" as const),
			trigger,
		};
		if (event === "PostCompact") {
			Object.assign(compaction, {
				summaryAvailable: stringValue(hook, "compact_summary") !== undefined,
			});
		}

		return [compaction];
	});
}

function normalizedRawBody(
	record: Readonly<JsonObject>,
): ContextEvidence["projection"]["rawApiBodies"] {
	const sourceOrdinal = numberValue(record, "capture_ordinal");
	const bodyRef = stringValue(record, "body_ref");
	if (sourceOrdinal === undefined || bodyRef === undefined) {
		return [];
	}

	return [
		{
			sourceOrdinal,
			bodyRef,
			requestId: null,
			state: "unassigned-no-documented-key",
		},
	];
}

function normalizedCoverage(
	record: Readonly<JsonObject>,
): ContextEvidence["projection"]["coverage"] {
	const stream = stringValue(record, "stream");
	const state = coverageStateSchema.safeParse(record["state"]);
	if (stream === undefined || !state.success) {
		return [];
	}
	const coverage = { stream, state: state.data };
	const reason = stringValue(record, "reason");
	if (reason !== undefined) {
		Object.assign(coverage, { reason });
	}

	return [coverage];
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
		rawApiBodies: source.files.rawApiBodies.flatMap(normalizedRawBody),
		coverage: source.files.coverage.flatMap(normalizedCoverage),
	};

	return contextEvidenceSchema.parse({ schemaVersion: 1, source, projection });
}
