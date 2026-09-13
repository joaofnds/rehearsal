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
const subagentStopSchema = z
	.object({
		hook_event_name: z.literal("SubagentStop"),
		capture_ordinal: z.number().int().nonnegative(),
		agent_transcript_path: z.string().min(1),
		agent_id: z.string().min(1),
	})
	.loose();
const instructionLoadHookSchema = z
	.object({
		hook_event_name: z.literal("InstructionsLoaded"),
		capture_ordinal: z.number().int().nonnegative(),
		agent_id: z.string().min(1).optional(),
		prompt_id: z.string().min(1).nullable().optional(),
		file_path: z.string().min(1),
		memory_type: z.string().min(1),
		load_reason: z.string().min(1),
		trigger_file_path: z.string().min(1).optional(),
		parent_file_path: z.string().min(1).optional(),
		globs: z.array(z.string()).optional(),
	})
	.loose();
const compactionHookSchema = z
	.object({
		hook_event_name: z.enum(["PreCompact", "PostCompact"]),
		capture_ordinal: z.number().int().nonnegative(),
		agent_id: z.string().min(1).optional(),
		prompt_id: z.string().min(1).nullable().optional(),
		trigger: z.string().min(1),
		compact_summary: z.string().optional(),
	})
	.loose();
const rawBodyRecordSchema = z
	.object({
		capture_ordinal: z.number().int().nonnegative(),
		body_ref: z.string().min(1),
	})
	.loose();
const coverageRecordSchema = z
	.object({
		stream: z.string().min(1),
		state: coverageStateSchema,
		reason: z.string().min(1).optional(),
	})
	.loose();

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

type NormalizationIssue =
	ContextEvidence["projection"]["normalizationIssues"][number];

interface NormalizationIssues {
	readonly values: readonly NormalizationIssue[];
	readonly add: (issue: NormalizationIssue) => void;
}

function normalizationIssueCollection(): NormalizationIssues {
	const values: NormalizationIssue[] = [];

	return {
		values,
		add: (issue) => {
			values.push(issue);
		},
	};
}

function recordNormalizationIssue(
	issues: Readonly<NormalizationIssues>,
	stream: string,
	record: Readonly<JsonObject>,
	detail: string,
): void {
	issues.add({
		stream,
		sourceOrdinal: numberValue(record, "capture_ordinal") ?? null,
		code: "malformed-recognized-record",
		detail,
	});
}

interface TranscriptIndexes {
	readonly agentByPath: ReadonlyMap<string, ReadonlySet<string>>;
	readonly byUuid: ReadonlyMap<
		string,
		readonly { readonly path: string; readonly row: Readonly<JsonObject> }[]
	>;
	readonly byRequest: ReadonlyMap<string, readonly Readonly<JsonObject>[]>;
	readonly agentCandidatesByRequest: ReadonlyMap<string, ReadonlySet<string>>;
	readonly agentToolOwner: ReadonlyMap<string, ReadonlySet<string>>;
}

function qualifiedIdentity(sessionId: string | null, identity: string): string {
	return `${sessionId ?? "<session-missing>"}\u0000${identity}`;
}

function addCandidate(
	index: Map<string, Set<string>>,
	key: string,
	value: string,
): void {
	const candidates = index.get(key) ?? new Set<string>();
	candidates.add(value);
	index.set(key, candidates);
}

function addRow(
	index: Map<string, Readonly<JsonObject>[]>,
	key: string,
	row: Readonly<JsonObject>,
): void {
	index.set(key, [...(index.get(key) ?? []), row]);
}

type AgentLineageState =
	ContextEvidence["projection"]["agents"][number]["lineageState"];

function agentLineageState(
	conflict: boolean,
	sourceCount: number,
): AgentLineageState {
	if (conflict) {
		return "conflict";
	}
	if (sourceCount > 1) {
		return "complete";
	}
	if (sourceCount === 1) {
		return "single-source";
	}

	return "missing";
}

function indexAgentToolUses(
	row: Readonly<JsonObject>,
	sessionId: string | null,
	pathCandidates: ReadonlySet<string>,
	agentToolOwner: Map<string, Set<string>>,
): void {
	const message = objectValue(row, "message");
	if (message === undefined) {
		return;
	}
	for (const content of arrayValue(message, "content")) {
		const block = asObject(content);
		if (
			block === undefined ||
			stringValue(block, "type") !== "tool_use" ||
			stringValue(block, "name") !== "Agent"
		) {
			continue;
		}
		const toolUseId = stringValue(block, "id");
		if (toolUseId === undefined) {
			continue;
		}
		const key = qualifiedIdentity(sessionId, toolUseId);
		for (const agentId of pathCandidates) {
			addCandidate(agentToolOwner, key, agentId);
		}
	}
}

function transcriptIndexes(
	files: ContextEvidenceSource["files"],
	issues: Readonly<NormalizationIssues>,
): TranscriptIndexes {
	const agentByPath = new Map<string, Set<string>>([
		["transcripts/main.jsonl", new Set(["main"])],
	]);
	for (const hook of files.hooks) {
		if (stringValue(hook, "hook_event_name") !== "SubagentStop") {
			continue;
		}
		const parsed = subagentStopSchema.safeParse(hook);
		if (!parsed.success) {
			recordNormalizationIssue(
				issues,
				"hooks",
				hook,
				"invalid SubagentStop record",
			);
			continue;
		}
		addCandidate(
			agentByPath,
			parsed.data.agent_transcript_path,
			parsed.data.agent_id,
		);
	}

	const byUuid = new Map<
		string,
		{ path: string; row: Readonly<JsonObject> }[]
	>();
	const byRequest = new Map<string, Readonly<JsonObject>[]>();
	const agentCandidatesByRequest = new Map<string, Set<string>>();
	const agentToolOwner = new Map<string, Set<string>>();
	for (const [path, rows] of Object.entries(files.transcripts)) {
		const pathCandidates = agentByPath.get(path) ?? new Set<string>();
		for (const row of rows) {
			const sessionId = stringValue(row, "sessionId") ?? null;
			const uuid = stringValue(row, "uuid");
			if (uuid !== undefined) {
				const key = qualifiedIdentity(sessionId, uuid);
				byUuid.set(key, [...(byUuid.get(key) ?? []), { path, row }]);
			}
			const requestId = stringValue(row, "requestId");
			if (requestId !== undefined) {
				const key = qualifiedIdentity(sessionId, requestId);
				addRow(byRequest, key, row);
				for (const agentId of pathCandidates) {
					addCandidate(agentCandidatesByRequest, key, agentId);
				}
			}
			indexAgentToolUses(row, sessionId, pathCandidates, agentToolOwner);
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
		const sessionId = stringValue(row, "session_id") ?? null;
		const uuid = stringValue(row, "uuid");
		const parentTool = nullableStringValue(row, "parent_tool_use_id");
		if (uuid === undefined || parentTool === undefined || parentTool === null) {
			continue;
		}
		const transcripts = indexes.byUuid.get(qualifiedIdentity(sessionId, uuid));
		const parents = indexes.agentToolOwner.get(
			qualifiedIdentity(sessionId, parentTool),
		);
		if (transcripts === undefined || parents === undefined) {
			continue;
		}
		for (const transcript of transcripts) {
			const children = indexes.agentByPath.get(transcript.path) ?? new Set();
			for (const child of children) {
				for (const parent of parents) {
					addCandidate(streamParents, child, parent);
				}
			}
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
		const lineageState = agentLineageState(conflict, sources.length);

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

function transcriptUsageFrom(
	row: Readonly<JsonObject>,
): RequestUsage | undefined {
	const message = objectValue(row, "message");
	const usage = message && objectValue(message, "usage");
	if (usage === undefined) {
		return undefined;
	}
	const inputTokens = numberValue(usage, "input_tokens");
	const outputTokens = numberValue(usage, "output_tokens");
	const cacheReadTokens = numberValue(usage, "cache_read_input_tokens");
	const cacheWriteTokens = numberValue(usage, "cache_creation_input_tokens");
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

type TtlSplit =
	| {
			readonly state: "complete";
			readonly fiveMinuteTokens: number;
			readonly oneHourTokens: number;
	  }
	| { readonly state: "missing" }
	| { readonly state: "conflict" };

function ttlSplit(rows: readonly Readonly<JsonObject>[]): TtlSplit {
	const splits = new Map<
		string,
		{ fiveMinuteTokens: number; oneHourTokens: number }
	>();
	let missing = rows.length === 0;
	for (const row of rows) {
		const message = objectValue(row, "message");
		const usage = message && objectValue(message, "usage");
		const cache = usage && objectValue(usage, "cache_creation");
		if (cache === undefined) {
			missing = true;
			continue;
		}
		const fiveMinuteTokens = numberValue(cache, "ephemeral_5m_input_tokens");
		const oneHourTokens = numberValue(cache, "ephemeral_1h_input_tokens");
		if (fiveMinuteTokens === undefined || oneHourTokens === undefined) {
			missing = true;
			continue;
		}
		splits.set(`${fiveMinuteTokens}:${oneHourTokens}`, {
			fiveMinuteTokens,
			oneHourTokens,
		});
	}
	if (splits.size > 1) {
		return { state: "conflict" };
	}
	if (missing || splits.size === 0) {
		return { state: "missing" };
	}
	const [only] = splits.values();
	if (only === undefined) {
		return { state: "missing" };
	}

	return { state: "complete", ...only };
}

interface ModelEvidence {
	readonly model: string | null;
	readonly state: "complete" | "single-source" | "missing" | "conflict";
}

function requestModel(
	logs: readonly Readonly<JsonObject>[],
	transcripts: readonly Readonly<JsonObject>[],
	spans: readonly Readonly<JsonObject>[],
): ModelEvidence {
	const bySource = [logs, transcripts, spans].flatMap((rows, sourceIndex) => {
		const values = new Set<string>();
		for (const row of rows) {
			const container =
				sourceIndex === 1
					? objectValue(row, "message")
					: objectValue(row, "attributes");
			const model = container && stringValue(container, "model");
			if (model !== undefined) {
				values.add(model);
			}
		}

		return values.size === 0 ? [] : [[sourceIndex, values] as const];
	});
	const models = new Set(bySource.flatMap(([, values]) => [...values]));
	if (models.size > 1 || bySource.some(([, values]) => values.size > 1)) {
		return { model: null, state: "conflict" };
	}
	const [model] = models;
	if (model === undefined) {
		return { model: null, state: "missing" };
	}

	return {
		model,
		state: bySource.length > 1 ? "complete" : "single-source",
	};
}

function requestPricing(
	usageState: ContextEvidence["projection"]["requests"][number]["usageState"],
	usage: ContextEvidence["projection"]["requests"][number]["usage"],
	modelState: ContextEvidence["projection"]["requests"][number]["modelState"],
	model: string | null,
	split: TtlSplit,
	rates: ContextRateCatalog | undefined,
): ContextEvidence["projection"]["requests"][number]["pricing"] {
	if (usageState === "conflict") {
		return { state: "usage-conflict" };
	}
	if (usageState !== "complete" || usage === undefined) {
		return { state: "usage-missing" };
	}
	if (modelState === "conflict") {
		return { state: "model-conflict" };
	}
	if (modelState === "missing" || model === null) {
		return { state: "model-missing" };
	}
	if (split.state === "conflict") {
		return { state: "ttl-split-conflict" };
	}
	if (split.state === "missing") {
		return { state: "ttl-split-missing" };
	}
	if (split.fiveMinuteTokens + split.oneHourTokens !== usage.cacheWriteTokens) {
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
				split.fiveMinuteTokens * rate.cacheWrite5mUsdPerMillion +
				split.oneHourTokens * rate.cacheWrite1hUsdPerMillion) /
			1_000_000,
		rateSource: rates.source,
		rateVersion: rates.version,
		currency: rates.currency,
		selectedRate: rate,
	};
}

type RequestEvidence = ContextEvidence["projection"]["requests"][number];
type RequestUsage = NonNullable<RequestEvidence["usage"]>;

function usageWithSplit(
	baseUsage: RequestUsage | undefined,
	split: TtlSplit,
): RequestUsage | undefined {
	if (baseUsage === undefined) {
		return undefined;
	}
	const usage = { ...baseUsage };
	if (split.state === "complete") {
		Object.assign(usage, {
			cacheWrite5mTokens: split.fiveMinuteTokens,
			cacheWrite1hTokens: split.oneHourTokens,
		});
	}

	return usage;
}

function requestUsageState(
	logCount: number,
	distinctCount: number,
	baseUsage: RequestUsage | undefined,
	transcriptRows: readonly Readonly<JsonObject>[],
): RequestEvidence["usageState"] {
	if (logCount === 0) {
		return "missing";
	}
	if (distinctCount > 1) {
		return "conflict";
	}
	const transcriptUsages = new Set(
		transcriptRows.flatMap((row) => {
			const usage = transcriptUsageFrom(row);

			return usage === undefined ? [] : [aggregateUsageKey(usage)];
		}),
	);
	if (
		transcriptUsages.size > 1 ||
		(baseUsage !== undefined &&
			transcriptUsages.size === 1 &&
			!transcriptUsages.has(aggregateUsageKey(baseUsage)))
	) {
		return "conflict";
	}

	return baseUsage === undefined ? "partial" : "complete";
}

function aggregateUsageKey(usage: Readonly<RequestUsage>): string {
	return canonicalJson({
		inputTokens: usage.inputTokens,
		outputTokens: usage.outputTokens,
		cacheReadTokens: usage.cacheReadTokens,
		cacheWriteTokens: usage.cacheWriteTokens,
	});
}

function uniqueRequestLogs(
	logs: readonly Readonly<JsonObject>[],
): readonly JsonObject[] {
	const unique = new Map<string, JsonObject>();
	for (const log of logs) {
		const attributes = objectValue(log, "attributes");
		if (attributes !== undefined) {
			const meteringAttributes: JsonObject = {};
			for (const [key, value] of Object.entries(attributes)) {
				if (key !== "request_id" && key !== "client_request_id") {
					meteringAttributes[key] = value;
				}
			}
			unique.set(canonicalJson(meteringAttributes), log);
		}
	}

	return [...unique.values()];
}

interface NormalizedRequestInput {
	readonly sessionId: string | null;
	readonly requestId: string;
	readonly clientRequestIds: readonly string[];
	readonly identityState: RequestEvidence["identityState"];
	readonly logs: readonly Readonly<JsonObject>[];
	readonly transcriptRows: readonly Readonly<JsonObject>[];
	readonly spans: readonly Readonly<JsonObject>[];
	readonly candidateSet: ReadonlySet<string>;
	readonly rates: ContextRateCatalog | undefined;
}

function normalizedRequest(
	input: Readonly<NormalizedRequestInput>,
): RequestEvidence {
	const {
		sessionId,
		requestId,
		clientRequestIds,
		identityState,
		logs,
		transcriptRows,
		spans,
		candidateSet,
		rates,
	} = input;
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
	const split = ttlSplit(transcriptRows);
	const usage = usageWithSplit(baseUsage, split);
	const usageState = requestUsageState(
		logs.length,
		distinct.length,
		baseUsage,
		transcriptRows,
	);
	const providerCostUsd =
		attributes === undefined ? undefined : numberValue(attributes, "cost_usd");
	const modelEvidence = requestModel(distinct, transcriptRows, spans);
	const request = {
		sessionId,
		requestId,
		clientRequestIds: [...clientRequestIds].toSorted(),
		identityState,
		agentId,
		model: modelEvidence.model,
		modelState: modelEvidence.state,
		usageState,
		pricing: requestPricing(
			usageState,
			usage,
			modelEvidence.state,
			modelEvidence.model,
			split,
			rates,
		),
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

type RequestRoute = "otel" | "span" | "transcript";

interface RequestIdentityMetadata {
	readonly sessionId: string | null;
	readonly requestId: string;
	readonly clientRequestIds: Set<string>;
	readonly routes: Set<RequestRoute>;
	identityConflict: boolean;
}

interface RequestIdentity {
	readonly sessionId: string | null;
	readonly requestId: string;
}

function identityParts(key: string): RequestIdentity {
	const separator = key.indexOf("\u0000");
	const session = key.slice(0, separator);

	return {
		sessionId: session === "<session-missing>" ? null : session,
		requestId: key.slice(separator + 1),
	};
}

function requestIdentityState(
	metadata: Readonly<RequestIdentityMetadata>,
): RequestEvidence["identityState"] {
	if (metadata.identityConflict) {
		return "conflict";
	}
	if (metadata.sessionId === null) {
		return "missing";
	}

	return metadata.routes.size > 1 ? "complete" : "single-source";
}

interface NormalizedRequests {
	readonly requests: ContextEvidence["projection"]["requests"];
	readonly keylessRequests: ContextEvidence["projection"]["keylessRequests"];
	readonly accountingIssues: ContextEvidence["projection"]["accountingIssues"];
}

interface OtelRequestCollection {
	readonly byRequest: ReadonlyMap<string, readonly Readonly<JsonObject>[]>;
	readonly keyless: readonly {
		readonly record: Readonly<JsonObject>;
		readonly index: number;
	}[];
	readonly clientRequestIds: ReadonlyMap<string, ReadonlySet<string>>;
	readonly identityConflicts: ReadonlySet<string>;
}

interface SpanRequestCollection {
	readonly byRequest: ReadonlyMap<string, readonly Readonly<JsonObject>[]>;
	readonly agentCandidates: ReadonlyMap<string, ReadonlySet<string>>;
}

function serverAliases(
	logs: readonly Readonly<JsonObject>[],
): ReadonlyMap<string, ReadonlySet<string>> {
	const serverIdsByClient = new Map<string, Set<string>>();
	for (const log of logs) {
		const attributes = objectValue(log, "attributes");
		if (
			attributes === undefined ||
			stringValue(attributes, "event.name") !== "api_request"
		) {
			continue;
		}
		const sessionId = stringValue(attributes, "session.id") ?? null;
		const serverId = stringValue(attributes, "request_id");
		const clientId = stringValue(attributes, "client_request_id");
		if (serverId !== undefined && clientId !== undefined) {
			addCandidate(
				serverIdsByClient,
				qualifiedIdentity(sessionId, clientId),
				serverId,
			);
		}
	}

	return serverIdsByClient;
}

function collectOtelRequests(
	logs: readonly Readonly<JsonObject>[],
	aliases: ReadonlyMap<string, ReadonlySet<string>>,
	issues: Readonly<NormalizationIssues>,
): OtelRequestCollection {
	const byRequest = new Map<string, Readonly<JsonObject>[]>();
	const keyless: {
		readonly record: Readonly<JsonObject>;
		readonly index: number;
	}[] = [];
	const clientRequestIds = new Map<string, Set<string>>();
	const identityConflicts = new Set<string>();
	for (const [index, log] of logs.entries()) {
		const attributes = objectValue(log, "attributes");
		if (attributes === undefined) {
			if (stringValue(log, "body") === "claude_code.api_request") {
				recordNormalizationIssue(
					issues,
					"otelLogs",
					log,
					"api_request record has no attributes",
				);
			}
			continue;
		}
		if (stringValue(attributes, "event.name") !== "api_request") {
			continue;
		}
		const sessionId = stringValue(attributes, "session.id") ?? null;
		const serverId = stringValue(attributes, "request_id");
		const clientId = stringValue(attributes, "client_request_id");
		if (numberValue(log, "capture_ordinal") === undefined) {
			recordNormalizationIssue(
				issues,
				"otelLogs",
				log,
				"api_request record has no valid capture ordinal",
			);
		}
		if (serverId === undefined && clientId === undefined) {
			keyless.push({ record: log, index });
			continue;
		}
		const aliasCandidates =
			clientId === undefined
				? new Set<string>()
				: (aliases.get(qualifiedIdentity(sessionId, clientId)) ??
					new Set<string>());
		const [aliasedServerId] = aliasCandidates;
		const requestId = serverId ?? aliasedServerId ?? clientId;
		if (requestId === undefined) {
			continue;
		}
		const key = qualifiedIdentity(sessionId, requestId);
		addRow(byRequest, key, log);
		if (clientId !== undefined) {
			addCandidate(clientRequestIds, key, clientId);
		}
		if (aliasCandidates.size > 1) {
			identityConflicts.add(key);
		}
	}

	return { byRequest, keyless, clientRequestIds, identityConflicts };
}

function collectRequestSpans(
	spans: readonly Readonly<JsonObject>[],
	issues: Readonly<NormalizationIssues>,
): SpanRequestCollection {
	const byRequest = new Map<string, Readonly<JsonObject>[]>();
	const agentCandidates = new Map<string, Set<string>>();
	for (const span of spans) {
		if (stringValue(span, "name") !== "claude_code.llm_request") {
			continue;
		}
		const attributes = objectValue(span, "attributes");
		if (attributes === undefined) {
			recordNormalizationIssue(
				issues,
				"otelSpans",
				span,
				"llm_request span has no attributes",
			);
			continue;
		}
		const sessionId = stringValue(attributes, "session.id") ?? null;
		const requestId = stringValue(attributes, "request_id");
		if (requestId === undefined) {
			recordNormalizationIssue(
				issues,
				"otelSpans",
				span,
				"llm_request span has no request identity",
			);
			continue;
		}
		const key = qualifiedIdentity(sessionId, requestId);
		addRow(byRequest, key, span);
		const agentId = stringValue(attributes, "agent_id");
		if (agentId !== undefined) {
			addCandidate(agentCandidates, key, agentId);
		}
	}

	return { byRequest, agentCandidates };
}

function requestAccountingIssues(
	requests: ContextEvidence["projection"]["requests"],
	keylessCount: number,
): ContextEvidence["projection"]["accountingIssues"] {
	const issues = new Set<
		ContextEvidence["projection"]["accountingIssues"][number]
	>();
	if (keylessCount > 0) {
		issues.add("keyless-request");
	}
	if (requests.some((request) => request.identityState !== "complete")) {
		issues.add("request-identity");
	}
	if (requests.some((request) => request.usageState !== "complete")) {
		issues.add("request-usage");
	}
	if (
		requests.some(
			(request) =>
				request.modelState === "missing" || request.modelState === "conflict",
		)
	) {
		issues.add("request-model");
	}
	if (requests.some((request) => request.attributionState !== undefined)) {
		issues.add("request-attribution");
	}

	return [...issues].toSorted();
}

function normalizedRequests(
	files: ContextEvidenceSource["files"],
	indexes: TranscriptIndexes,
	rates: ContextRateCatalog | undefined,
	issues: Readonly<NormalizationIssues>,
): NormalizedRequests {
	const logs = collectOtelRequests(
		files.otelLogs,
		serverAliases(files.otelLogs),
		issues,
	);
	const spans = collectRequestSpans(files.otelSpans, issues);
	const requestKeys = new Set([
		...logs.byRequest.keys(),
		...spans.byRequest.keys(),
		...indexes.byRequest.keys(),
	]);
	const requests = [...requestKeys].toSorted().map((key) => {
		const identity = identityParts(key);
		const routes = new Set<RequestRoute>();
		if (logs.byRequest.has(key)) {
			routes.add("otel");
		}
		if (spans.byRequest.has(key)) {
			routes.add("span");
		}
		if (indexes.byRequest.has(key)) {
			routes.add("transcript");
		}
		const metadata: RequestIdentityMetadata = {
			...identity,
			clientRequestIds: new Set(logs.clientRequestIds.get(key)),
			routes,
			identityConflict: logs.identityConflicts.has(key),
		};
		const candidateSet = new Set([
			...(indexes.agentCandidatesByRequest.get(key) ?? []),
			...(spans.agentCandidates.get(key) ?? []),
		]);

		return normalizedRequest({
			sessionId: metadata.sessionId,
			requestId: metadata.requestId,
			clientRequestIds: [...metadata.clientRequestIds],
			identityState: requestIdentityState(metadata),
			logs: logs.byRequest.get(key) ?? [],
			transcriptRows: indexes.byRequest.get(key) ?? [],
			spans: spans.byRequest.get(key) ?? [],
			candidateSet,
			rates,
		});
	});

	return {
		requests,
		keylessRequests: logs.keyless.map(({ record, index }) => ({
			occurrenceId: `otel-log:${String(numberValue(record, "capture_ordinal") ?? index + 1)}`,
			state: "identity-missing-no-dedup" as const,
		})),
		accountingIssues: requestAccountingIssues(requests, logs.keyless.length),
	};
}

function normalizedLoads(
	files: ContextEvidenceSource["files"],
	issues: Readonly<NormalizationIssues>,
): ContextEvidence["projection"]["instructionLoads"] {
	return files.hooks.flatMap((hook) => {
		if (stringValue(hook, "hook_event_name") !== "InstructionsLoaded") {
			return [];
		}
		const parsed = instructionLoadHookSchema.safeParse(hook);
		if (!parsed.success) {
			recordNormalizationIssue(
				issues,
				"hooks",
				hook,
				"invalid InstructionsLoaded record",
			);
			return [];
		}
		const {
			capture_ordinal: sourceOrdinal,
			file_path: filePath,
			memory_type: memoryType,
			load_reason: loadReason,
			prompt_id: promptId = null,
			trigger_file_path: triggerFilePath,
			parent_file_path: parentFilePath,
			globs = [],
		} = parsed.data;
		const agentId =
			parsed.data.agent_id ??
			(loadReason === "session_start" && promptId === null ? "main" : null);
		const load = {
			sourceOrdinal,
			agentId,
			promptId,
			filePath,
			memoryType,
			loadReason,
		};
		if (agentId === null) {
			Object.assign(load, { attributionState: "missing" as const });
		}
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
	issues: Readonly<NormalizationIssues>,
): ContextEvidence["projection"]["compactions"] {
	return files.hooks.flatMap((hook) => {
		const event = stringValue(hook, "hook_event_name");
		if (event !== "PreCompact" && event !== "PostCompact") {
			return [];
		}
		const parsed = compactionHookSchema.safeParse(hook);
		if (!parsed.success) {
			recordNormalizationIssue(
				issues,
				"hooks",
				hook,
				"invalid compaction record",
			);
			return [];
		}
		const {
			capture_ordinal: sourceOrdinal,
			agent_id: agentId = null,
			prompt_id: promptId = null,
			trigger,
		} = parsed.data;
		const compaction = {
			sourceOrdinal,
			agentId,
			promptId,
			phase: event === "PreCompact" ? ("pre" as const) : ("post" as const),
			trigger,
		};
		if (agentId === null) {
			Object.assign(compaction, { attributionState: "missing" as const });
		}
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
	issues: Readonly<NormalizationIssues>,
): ContextEvidence["projection"]["rawApiBodies"] {
	const parsed = rawBodyRecordSchema.safeParse(record);
	if (!parsed.success) {
		recordNormalizationIssue(
			issues,
			"rawApiBodies",
			record,
			"invalid raw API body reference",
		);
		return [];
	}

	return [
		{
			sourceOrdinal: parsed.data.capture_ordinal,
			bodyRef: parsed.data.body_ref,
			requestId: null,
			state: "unassigned-no-documented-key",
		},
	];
}

function normalizedCoverage(
	records: readonly Readonly<JsonObject>[],
	issues: Readonly<NormalizationIssues>,
): ContextEvidence["projection"]["coverage"] {
	const coverage = new Map<
		string,
		ContextEvidence["projection"]["coverage"][number]
	>();
	for (const record of records) {
		const parsed = coverageRecordSchema.safeParse(record);
		if (!parsed.success) {
			recordNormalizationIssue(
				issues,
				"coverage",
				record,
				"invalid coverage record",
			);
			continue;
		}
		const current = coverage.get(parsed.data.stream);
		if (
			current !== undefined &&
			(current.state !== parsed.data.state ||
				current.reason !== parsed.data.reason)
		) {
			coverage.set(parsed.data.stream, {
				stream: parsed.data.stream,
				state: "partial",
				reason: "coverage-claim-conflict",
			});
		} else {
			coverage.set(parsed.data.stream, parsed.data);
		}
	}
	for (const issue of issues.values) {
		const current = coverage.get(issue.stream);
		coverage.set(issue.stream, {
			stream: issue.stream,
			state: "partial",
			reason:
				current?.reason === undefined
					? "normalization-issue"
					: `${current.reason}; normalization-issue`,
		});
	}

	return [...coverage.values()].toSorted((left, right) =>
		left.stream.localeCompare(right.stream),
	);
}

export function normalizeContextEvidence(
	source: ContextEvidenceSource,
	rates?: ContextRateCatalog,
): ContextEvidence {
	const normalizationIssues = normalizationIssueCollection();
	const indexes = transcriptIndexes(source.files, normalizationIssues);
	const requests = normalizedRequests(
		source.files,
		indexes,
		rates,
		normalizationIssues,
	);
	const instructionLoads = normalizedLoads(source.files, normalizationIssues);
	const compactions = normalizedCompactions(source.files, normalizationIssues);
	const rawApiBodies = source.files.rawApiBodies.flatMap((record) =>
		normalizedRawBody(record, normalizationIssues),
	);
	const coverage = normalizedCoverage(
		source.files.coverage,
		normalizationIssues,
	);
	const accountingIssues = new Set(requests.accountingIssues);
	if (normalizationIssues.values.length > 0) {
		accountingIssues.add("malformed-source-record");
	}
	if (coverage.some((entry) => entry.state !== "complete")) {
		accountingIssues.add("source-coverage");
	}
	const projection: ContextEvidence["projection"] = {
		agents: normalizedAgents(source.files, indexes),
		requests: requests.requests,
		keylessRequests: requests.keylessRequests,
		accountingState: accountingIssues.size === 0 ? "complete" : "incomplete",
		accountingIssues: [...accountingIssues].toSorted(),
		normalizationIssues: normalizationIssues.values,
		instructionLoads,
		compactions,
		rawApiBodies,
		coverage,
	};
	const evidence = { schemaVersion: 1 as const, source, projection };
	if (rates !== undefined) {
		Object.assign(evidence, { rateCatalog: rates });
	}

	return contextEvidenceSchema.parse(evidence);
}
