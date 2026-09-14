import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { z } from "zod";
import type { Immutable } from "./contracts";
import { jsonValueSchema } from "./json-value";
import type { JsonValue } from "./json-value";
import type { TranscriptDiagnostics, TranscriptLocation } from "./transcript";

export const MAX_EVENT_DETAIL_BYTES = 65_536;

export type HistoryRegion = "starting-context" | "attempt" | "boundary-unknown";
export type HistorySourceKind =
	| "corpus"
	| "project"
	| "external"
	| "skill"
	| "tool-output"
	| "unclassified";
export type HistoryEventKind =
	| "call"
	| "result"
	| "instruction-delivery"
	| "unclassified";
export type HistoryEventState =
	| "invoked"
	| "delivered"
	| "recorded"
	| "failed"
	| "partial"
	| "unavailable";

export type HistoryEvidence =
	| { readonly state: "complete" }
	| { readonly state: "partial"; readonly reasons: readonly string[] }
	| { readonly state: "unavailable"; readonly reasons: readonly string[] };

export type TextMeasurement =
	| { readonly state: "complete"; readonly characters: number }
	| {
			readonly state: "partial";
			readonly observedCharacters: number;
			readonly reasons: readonly string[];
	  }
	| { readonly state: "unavailable"; readonly reasons: readonly string[] };

export interface SessionHistoryEvent {
	readonly id: string;
	readonly locator: TranscriptLocation;
	readonly region: HistoryRegion;
	readonly kind: HistoryEventKind;
	readonly state: HistoryEventState;
	readonly label: string;
	readonly timestamp?: string | undefined;
	readonly toolUseId?: string | undefined;
	readonly toolName?: string | undefined;
	readonly sourceId?: string | undefined;
	readonly measurement: TextMeasurement;
	readonly relatedEventIds: readonly string[];
	readonly deliveryOrdinal?: number | undefined;
}

export interface SessionHistorySource {
	readonly id: string;
	readonly kind: HistorySourceKind;
	readonly name: string;
	readonly path?: string | undefined;
	readonly region: HistoryRegion;
	readonly firstLocator: TranscriptLocation;
	readonly measurement: TextMeasurement;
	readonly observedDeliveryCount: number | undefined;
	readonly repeatDeliveryCount: number | undefined;
	readonly failedOccurrences: number;
	readonly partialOccurrences: number;
	readonly unavailableOccurrences: number;
	readonly eventIds: readonly string[];
}

export interface SessionHistoryAttemptIdentity {
	readonly caseId: string;
	readonly id: string;
	readonly model: string;
	readonly outcome: string;
	readonly corpusFiles: readonly {
		readonly path: string;
		readonly resolvedPath: string;
	}[];
}

export interface SessionHistoryReportInput {
	readonly attempt: SessionHistoryAttemptIdentity;
	readonly transcript: string | undefined;
	readonly prefixLinesExcluded: number | undefined;
	readonly diagnostics?: Immutable<TranscriptDiagnostics> | undefined;
}

export interface SessionHistoryReport {
	readonly schemaVersion: 1;
	readonly attempt: SessionHistoryAttemptIdentity;
	readonly evidence: HistoryEvidence;
	readonly startingContext: readonly SessionHistoryEvent[];
	readonly attemptEvents: readonly SessionHistoryEvent[];
	readonly boundaryUnknown: readonly SessionHistoryEvent[];
	readonly startingSources: readonly SessionHistorySource[];
	readonly sources: readonly SessionHistorySource[];
	readonly diagnostics?: Immutable<TranscriptDiagnostics> | undefined;
}

interface SourceIdentity {
	readonly id: string;
	readonly kind: HistorySourceKind;
	readonly name: string;
	readonly path?: string | undefined;
}

interface ParsedRow {
	readonly line: number;
	readonly timestamp: string | undefined;
	readonly cwd: string | undefined;
	readonly value: HistoryRecord | undefined;
	readonly blocks: readonly JsonValue[];
}

interface MutableEvent {
	readonly id: string;
	readonly locator: TranscriptLocation;
	readonly region: HistoryRegion;
	readonly kind: HistoryEventKind;
	readonly state: HistoryEventState;
	readonly label: string;
	readonly timestamp: string | undefined;
	readonly toolUseId?: string | undefined;
	readonly toolName?: string | undefined;
	readonly sourceId?: string | undefined;
	readonly measurement: TextMeasurement;
	readonly relatedEventIds: readonly string[];
	readonly deliveryOrdinal?: number | undefined;
	readonly content?: string | undefined;
	readonly snapshot?: string | undefined;
	readonly source: SourceIdentity | undefined;
	readonly isDelivery: boolean;
	readonly input?: HistoryBlockInput | undefined;
}

interface ProjectionState {
	readonly events: readonly MutableEvent[];
	readonly issues: readonly string[];
}

const historyContentSchema = z.union([z.string(), z.array(jsonValueSchema)]);
const historyRecordSchema = z.looseObject({
	timestamp: z.string().min(1).optional(),
	cwd: z.string().min(1).optional(),
	sourceToolUseID: z.string().min(1).optional(),
	message: z.looseObject({ content: historyContentSchema }).optional(),
	toolUseResult: z
		.looseObject({
			file: z.looseObject({ content: z.string() }).optional(),
		})
		.optional(),
});
type HistoryRecord = z.infer<typeof historyRecordSchema>;

const historyBlockInputSchema = z.record(z.string(), jsonValueSchema);
type HistoryBlockInput = z.infer<typeof historyBlockInputSchema>;
const historyToolCallSchema = z.looseObject({
	type: z.literal("tool_use"),
	id: z.string().min(1).optional(),
	name: z.string().min(1),
	input: historyBlockInputSchema.optional().default({}),
});
const historyToolResultSchema = z.looseObject({
	type: z.literal("tool_result"),
	tool_use_id: z.string().min(1).optional(),
	is_error: z.boolean().optional(),
	content: jsonValueSchema.optional(),
});
const historyTextBlockSchema = z.looseObject({
	type: z.literal("text"),
	text: z.string(),
});

function parsedRows(transcript: string): readonly ParsedRow[] {
	return transcript.split("\n").flatMap((text, index) => {
		if (text.trim() === "") {
			return [];
		}

		let value: HistoryRecord | undefined;
		try {
			const parsed = historyRecordSchema.safeParse(JSON.parse(text));
			value = parsed.success ? parsed.data : undefined;
		} catch {
			value = undefined;
		}
		const content = value?.message?.content;
		let blocks: readonly JsonValue[] = [];
		const list = z.array(jsonValueSchema).safeParse(content);
		if (list.success) {
			blocks = list.data;
		} else {
			const string = z.string().safeParse(content);
			if (string.success) {
				blocks = [string.data];
			} else if (value === undefined) {
				blocks = [null];
			}
		}

		return [
			{
				line: index + 1,
				timestamp: value?.timestamp,
				cwd: value?.cwd,
				value,
				blocks,
			},
		];
	});
}

function regionFor(
	line: number,
	prefixLinesExcluded: number | undefined,
): HistoryRegion {
	if (prefixLinesExcluded === undefined) {
		return "boundary-unknown";
	}

	return line <= prefixLinesExcluded ? "starting-context" : "attempt";
}

function locatorId(location: Readonly<TranscriptLocation>): string {
	return `${location.line}:${location.block}`;
}

function countCharacters(text: string): number {
	// Unicode code points are the shaped measurement unit; grapheme clusters and
	// UTF-16 code units would both answer a different question.
	// oxlint-disable-next-line typescript/no-misused-spread
	return [...text].length;
}

interface MeasuredContent {
	readonly text: string | undefined;
	readonly measurement: TextMeasurement;
}

function measureContent(value: JsonValue | undefined): MeasuredContent {
	const string = z.string().safeParse(value);
	if (string.success) {
		return {
			text: string.data,
			measurement: {
				state: "complete",
				characters: countCharacters(string.data),
			},
		};
	}
	const list = z.array(jsonValueSchema).safeParse(value);
	if (!list.success) {
		return {
			text: undefined,
			measurement: { state: "unavailable", reasons: ["unsupported text body"] },
		};
	}

	const texts: string[] = [];
	let unsupported = false;
	for (const entry of list.data) {
		const text = historyTextBlockSchema.safeParse(entry);
		if (text.success) {
			texts.push(text.data.text);
		} else {
			unsupported = true;
		}
	}
	const joined = texts.join("");
	if (texts.length === 0) {
		return {
			text: undefined,
			measurement: { state: "unavailable", reasons: ["unsupported text body"] },
		};
	}
	if (unsupported) {
		return {
			text: joined,
			measurement: {
				state: "partial",
				observedCharacters: countCharacters(joined),
				reasons: ["mixed supported and unsupported body blocks"],
			},
		};
	}

	return {
		text: joined,
		measurement: { state: "complete", characters: countCharacters(joined) },
	};
}

function isContained(path: string, root: string): boolean {
	const fromRoot = relative(root, path);

	return fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== "..");
}

function sourceForCall(
	toolName: string,
	input: Readonly<HistoryBlockInput>,
	cwd: string | undefined,
	location: Readonly<TranscriptLocation>,
	corpusFiles: SessionHistoryAttemptIdentity["corpusFiles"],
): SourceIdentity {
	if (toolName === "Skill") {
		const parsedSkill = z.string().min(1).safeParse(input["skill"]);
		const skill = parsedSkill.success ? parsedSkill.data : undefined;
		if (skill !== undefined) {
			const path = `skills/${skill}/SKILL.md`;

			return { id: `skill:${path}`, kind: "skill", name: path, path };
		}
	}
	if (toolName !== "Read") {
		const id = locatorId(location);

		return {
			id: `tool-output:${id}`,
			kind: "tool-output",
			name: `${toolName} · ${id}`,
		};
	}

	const parsedPath = z.string().min(1).safeParse(input["file_path"]);
	const observed = parsedPath.success ? parsedPath.data : undefined;
	if (observed === undefined) {
		return {
			id: `unclassified:${locatorId(location)}`,
			kind: "unclassified",
			name: "Unclassified recorded content",
		};
	}
	const exactCorpus = corpusFiles.find(
		({ resolvedPath }) => resolve(resolvedPath) === resolve(observed),
	);
	if (exactCorpus !== undefined) {
		return {
			id: `corpus:${exactCorpus.path}`,
			kind: "corpus",
			name: exactCorpus.path,
			path: exactCorpus.path,
		};
	}
	if (cwd === undefined) {
		return isAbsolute(observed)
			? { id: `external:${observed}`, kind: "external", name: observed, path: observed }
			: {
					id: `unclassified:${locatorId(location)}`,
					kind: "unclassified",
					name: "Unclassified recorded content",
				};
	}

	const normalizedCwd = resolve(cwd);
	const normalized = resolve(normalizedCwd, observed);
	if (!isAbsolute(observed) && !isContained(normalized, normalizedCwd)) {
		return {
			id: `unclassified:${locatorId(location)}`,
			kind: "unclassified",
			name: "Unclassified recorded content",
		};
	}
	const corpusRoot = resolve(normalizedCwd, ".claude");
	if (isContained(normalized, corpusRoot)) {
		const path = relative(corpusRoot, normalized) || basename(normalized);

		return { id: `corpus:${path}`, kind: "corpus", name: path, path };
	}
	if (isContained(normalized, normalizedCwd)) {
		const path = relative(normalizedCwd, normalized) || basename(normalized);

		return { id: `project:${path}`, kind: "project", name: path, path };
	}

	return { id: `external:${normalized}`, kind: "external", name: normalized, path: normalized };
}

function snapshotFor(row: Immutable<ParsedRow>): string | undefined {
	return row.value?.toolUseResult?.file?.content;
}

function baseEvent(
	row: Immutable<ParsedRow>,
	block: number,
	region: HistoryRegion,
): Pick<MutableEvent, "id" | "locator" | "region" | "timestamp" | "relatedEventIds"> {
	const locator = { line: row.line, block };

	return {
		id: locatorId(locator),
		locator,
		region,
		timestamp: row.timestamp,
		relatedEventIds: [],
	};
}

function parseEvents(
	input: Immutable<SessionHistoryReportInput>,
): ProjectionState {
	const events: MutableEvent[] = [];
	const issues: string[] = [];
	if (input.transcript === undefined) {
		return { events, issues };
	}

	for (const row of parsedRows(input.transcript)) {
		const region = regionFor(row.line, input.prefixLinesExcluded);
		for (const [index, value] of row.blocks.entries()) {
			const location = { line: row.line, block: index + 1 };
			const common = baseEvent(row, index + 1, region);
			const call = historyToolCallSchema.safeParse(value);
			if (call.success) {
				const { name: toolName, input: inputRecord } = call.data;
				const source = sourceForCall(
					toolName,
					inputRecord,
					row.cwd,
					location,
					input.attempt.corpusFiles,
				);
				events.push({
					...common,
					kind: "call",
					state: "invoked",
					label: `${toolName} invoked`,
					toolUseId: call.data.id,
					toolName,
					sourceId: source.id,
					measurement: { state: "complete", characters: 0 },
					source,
					isDelivery: false,
					input: inputRecord,
				});
				continue;
			}
			const result = historyToolResultSchema.safeParse(value);
			if (result.success) {
				const measured = measureContent(result.data.content);
				events.push({
					...common,
					kind: "result",
					state: result.data.is_error === true ? "failed" : "recorded",
					label:
						result.data.is_error === true
							? "Tool result · failed"
							: "Tool result",
					toolUseId: result.data.tool_use_id,
					measurement: measured.measurement,
					content: measured.text,
					snapshot: snapshotFor(row),
					source: undefined,
					isDelivery: false,
				});
				continue;
			}

			const text = historyTextBlockSchema.safeParse(value);
			const measured = measureContent(text.success ? text.data.text : value);
			const companionId = row.value?.sourceToolUseID;
			events.push({
				...common,
				kind: companionId === undefined ? "unclassified" : "instruction-delivery",
				state: companionId === undefined ? "recorded" : "partial",
				label:
					companionId === undefined
						? "Unclassified recorded content"
						: "Skill delivery · partial",
				toolUseId: companionId,
				measurement: measured.measurement,
				content: measured.text,
				source:
					companionId === undefined
						? {
								id: "unclassified",
								kind: "unclassified",
								name: "Unclassified recorded content",
							}
						: undefined,
				sourceId: companionId === undefined ? "unclassified" : undefined,
				isDelivery: false,
			});
			if (measured.measurement.state !== "complete") {
				issues.push(`unsupported content at ${common.id}`);
			}
		}
	}

	return { events, issues };
}

interface JoinIndices {
	readonly calls: ReadonlyMap<string, readonly MutableEvent[]>;
	readonly results: ReadonlyMap<string, readonly MutableEvent[]>;
	readonly deliveries: ReadonlyMap<string, readonly MutableEvent[]>;
}

function joinKey(event: Immutable<MutableEvent>): string | undefined {
	return event.toolUseId === undefined
		? undefined
		: `${event.region}:${event.toolUseId}`;
}

function unclassifiedSource(): SourceIdentity {
	return {
		id: "unclassified",
		kind: "unclassified",
		name: "Unclassified recorded content",
	};
}

function sourceForResult(call: Immutable<MutableEvent>): SourceIdentity | undefined {
	if (call.toolName !== "Skill") {
		return call.source;
	}

	return {
		id: `tool-output:${call.id}`,
		kind: "tool-output",
		name: `Skill result · ${call.id}`,
	};
}

function byRegionAndId(
	events: Immutable<readonly MutableEvent[]>,
	kind: "call" | "result" | "instruction-delivery",
): ReadonlyMap<string, readonly MutableEvent[]> {
	const grouped = new Map<string, MutableEvent[]>();
	for (const event of events) {
		if (event.kind !== kind || event.toolUseId === undefined) {
			continue;
		}
		const key = `${event.region}:${event.toolUseId}`;
		const found = grouped.get(key) ?? [];
		found.push(event);
		grouped.set(key, found);
	}

	return grouped;
}

interface JoinedEvent {
	readonly event: MutableEvent;
	readonly issues: readonly string[];
}

function joinCall(
	event: Immutable<MutableEvent>,
	indices: Readonly<JoinIndices>,
): JoinedEvent {
	const key = joinKey(event);
	if (key === undefined) {
		return { event, issues: [`missing tool call ID at ${event.id}`] };
	}
	const ambiguous = (indices.calls.get(key) ?? []).length !== 1;

	return {
		event: {
			...event,
			state: ambiguous ? "partial" : event.state,
			relatedEventIds: [
				...(indices.results.get(key) ?? []).map(({ id }) => id),
				...(indices.deliveries.get(key) ?? []).map(({ id }) => id),
			],
		},
		issues: ambiguous ? [`ambiguous tool call ${event.toolUseId}`] : [],
	};
}

function joinUnmatchedEvent(
	event: Immutable<MutableEvent>,
	events: Immutable<readonly MutableEvent[]>,
): JoinedEvent {
	const contextualCalls = events.filter(
		(candidate) =>
			candidate.kind === "call" &&
			candidate.toolUseId === event.toolUseId &&
			candidate.region !== event.region,
	);
	const [contextualCall] = contextualCalls.length === 1 ? contextualCalls : [];
	const source = unclassifiedSource();

	return {
		event: {
			...event,
			state: "partial",
			label: `${event.kind === "result" ? "Tool result" : "Skill delivery"} · partial`,
			source,
			sourceId: source.id,
			relatedEventIds:
				contextualCall === undefined ? [] : [contextualCall.id],
		},
		issues: [`unmatched or ambiguous result ${event.id}`],
	};
}

function joinInstructionDelivery(
	event: Immutable<MutableEvent>,
	call: Immutable<MutableEvent>,
	deliveryMatches: Immutable<readonly MutableEvent[]>,
): JoinedEvent {
	const ambiguous = call.toolName !== "Skill" || deliveryMatches.length !== 1;

	return {
		event: {
			...event,
			state: ambiguous ? "partial" : "delivered",
			label: ambiguous ? "Skill delivery · partial" : "Skill delivered",
			source: ambiguous ? unclassifiedSource() : call.source,
			sourceId: ambiguous ? "unclassified" : call.sourceId,
			isDelivery: !ambiguous,
			relatedEventIds: [call.id],
		},
		issues: ambiguous ? [`ambiguous Skill delivery ${event.id}`] : [],
	};
}

function joinResult(
	event: Immutable<MutableEvent>,
	call: Immutable<MutableEvent>,
	resultMatches: Immutable<readonly MutableEvent[]>,
): JoinedEvent {
	const source = sourceForResult(call);
	if (event.state === "failed") {
		return {
			event: {
				...event,
				label: `${call.toolName ?? "Tool"} result · failed`,
				toolName: call.toolName,
				source,
				sourceId: source?.id,
				relatedEventIds: [call.id],
			},
			issues: [],
		};
	}
	const delivered =
		call.toolName === "Read" &&
		resultMatches.length === 1 &&
		event.measurement.state !== "unavailable";
	const unavailable = event.measurement.state === "unavailable";
	let resultState: HistoryEventState = "recorded";
	if (delivered) {
		resultState = "delivered";
	} else if (unavailable) {
		resultState = "unavailable";
	}

	return {
		event: {
			...event,
			state: resultState,
			label: delivered ? "Read delivered" : `${call.toolName ?? "Tool"} result`,
			toolName: call.toolName,
			source,
			sourceId: source?.id,
			isDelivery: delivered,
			relatedEventIds: [call.id],
		},
		issues: [],
	};
}

function joinNonCall(
	event: Immutable<MutableEvent>,
	indices: Readonly<JoinIndices>,
	events: Immutable<readonly MutableEvent[]>,
): JoinedEvent {
	const key = joinKey(event);
	const callMatches = key === undefined ? [] : (indices.calls.get(key) ?? []);
	const [call] = callMatches.length === 1 ? callMatches : [];
	if (call === undefined) {
		return joinUnmatchedEvent(event, events);
	}
	if (event.kind === "instruction-delivery") {
		return joinInstructionDelivery(
			event,
			call,
			key === undefined ? [] : (indices.deliveries.get(key) ?? []),
		);
	}

	return joinResult(
		event,
		call,
		key === undefined ? [] : (indices.results.get(key) ?? []),
	);
}

function missingDeliveryIssues(
	events: Immutable<readonly MutableEvent[]>,
): readonly string[] {
	return events.flatMap((event) => {
		const expectsDelivery = event.toolName === "Read" || event.toolName === "Skill";
		const key = joinKey(event);
		if (event.kind !== "call" || !expectsDelivery || key === undefined) {
			return [];
		}
		const candidates = events.filter(
			(candidate) =>
				event.relatedEventIds.includes(candidate.id) && candidate.isDelivery,
		);

		return candidates.some(
			({ state: candidateState }) => candidateState === "delivered",
		)
			? []
			: [`missing delivery for ${event.id}`];
	});
}

function numberDeliveries(
	events: Immutable<readonly MutableEvent[]>,
): readonly MutableEvent[] {
	const ordinals = new Map<string, number>();

	return events.map((event) => {
		if (!event.isDelivery || event.sourceId === undefined) {
			return event;
		}
		const next = (ordinals.get(event.sourceId) ?? 0) + 1;
		ordinals.set(event.sourceId, next);

		return {
			...event,
			deliveryOrdinal: next,
			label: `${event.label} · ${next === 1 ? "first" : "subsequent"}`,
		};
	});
}

function joinEvents(state: Immutable<ProjectionState>): ProjectionState {
	const indices = {
		calls: byRegionAndId(state.events, "call"),
		results: byRegionAndId(state.events, "result"),
		deliveries: byRegionAndId(state.events, "instruction-delivery"),
	};
	const joined = state.events.map((event): JoinedEvent => {
		if (event.kind === "unclassified") {
			return { event, issues: [] };
		}

		return event.kind === "call"
			? joinCall(event, indices)
			: joinNonCall(event, indices, state.events);
	});
	const events = numberDeliveries(joined.map(({ event }) => event));

	return {
		events,
		issues: [
			...state.issues,
			...joined.flatMap(({ issues }) => issues),
			...missingDeliveryIssues(events),
		],
	};
}

function observedCharacters(measurement: Readonly<TextMeasurement>): number {
	if (measurement.state === "complete") {
		return measurement.characters;
	}
	if (measurement.state === "partial") {
		return measurement.observedCharacters;
	}

	return 0;
}

function sourceMeasurement(
	events: Immutable<readonly MutableEvent[]>,
): TextMeasurement {
	const measured = events.filter(({ kind }) => kind !== "call");
	const observed = measured.reduce(
		(total, { measurement }) => total + observedCharacters(measurement),
		0,
	);
	const partial = measured.filter(({ measurement }) => measurement.state === "partial");
	const unavailable = measured.filter(
		({ measurement }) => measurement.state === "unavailable",
	);
	if (partial.length > 0 || unavailable.length > 0) {
		return {
			state: "partial",
			observedCharacters: observed,
			reasons: [
				...partial.flatMap(({ measurement }) =>
					measurement.state === "partial" ? measurement.reasons : [],
				),
				...unavailable.flatMap(({ measurement }) =>
					measurement.state === "unavailable" ? measurement.reasons : [],
				),
			],
		};
	}
	if (measured.length === 0) {
		return { state: "unavailable", reasons: ["no recorded result"] };
	}

	return { state: "complete", characters: observed };
}

function sourcesFor(
	events: Immutable<readonly MutableEvent[]>,
	region: HistoryRegion,
): readonly SessionHistorySource[] {
	const grouped = new Map<string, MutableEvent[]>();
	for (const event of events) {
		if (event.region !== region || event.sourceId === undefined) {
			continue;
		}
		const found = grouped.get(event.sourceId) ?? [];
		found.push(event);
		grouped.set(event.sourceId, found);
	}

	return [...grouped].map(([id, sourceEvents]) => {
		const [first] = sourceEvents;
		if (first === undefined) {
			throw new Error(`Source ${id} has no event`);
		}
		const identity = sourceEvents.find(
			({ source: eventSource }) => eventSource !== undefined,
		)?.source;
		const observedDeliveryCount = sourceEvents.filter(
			({ isDelivery }) => isDelivery,
		).length;
		const missingDeliveries = sourceEvents.filter(
			(event) =>
				event.kind === "call" &&
				(event.toolName === "Read" || event.toolName === "Skill") &&
				!sourceEvents.some(
					(candidate) =>
						candidate.isDelivery && candidate.relatedEventIds.includes(event.id),
				),
		).length;
		const countsAvailable = region !== "boundary-unknown";

		return {
			id,
			kind: identity?.kind ?? "unclassified",
			name: identity?.name ?? "Unclassified recorded content",
			path: identity?.path,
			region,
			firstLocator: first.locator,
			measurement: sourceMeasurement(sourceEvents),
			observedDeliveryCount: countsAvailable ? observedDeliveryCount : undefined,
			repeatDeliveryCount: countsAvailable
				? Math.max(0, observedDeliveryCount - 1)
				: undefined,
			failedOccurrences: sourceEvents.filter(({ state }) => state === "failed").length,
			partialOccurrences: sourceEvents.filter(({ state }) => state === "partial").length,
			unavailableOccurrences:
				sourceEvents.filter(({ state }) => state === "unavailable").length +
				missingDeliveries,
			eventIds: sourceEvents.map(({ id: eventId }) => eventId),
		};
	});
}

function publicEvent(event: Immutable<MutableEvent>): SessionHistoryEvent {
	const {
		content: _content,
		snapshot: _snapshot,
		source: _source,
		isDelivery: _isDelivery,
		input: _input,
		...publicFields
	} = event;

	return publicFields;
}

export function sessionHistoryReport(
	input: Immutable<SessionHistoryReportInput>,
): SessionHistoryReport {
	if (input.transcript === undefined) {
		return {
			schemaVersion: 1,
			attempt: input.attempt,
			evidence: { state: "unavailable", reasons: ["transcript unavailable"] },
			startingContext: [],
			attemptEvents: [],
			boundaryUnknown: [],
			startingSources: [],
			sources: [],
			diagnostics: input.diagnostics,
		};
	}

	let state = joinEvents(parseEvents(input));
	if (state.events.length === 0) {
		state = { ...state, issues: [...state.issues, "empty transcript"] };
	}
	if (input.prefixLinesExcluded === undefined) {
		state = {
			...state,
			issues: [...state.issues, "attempt boundary unavailable"],
		};
	}
	if (input.diagnostics?.state === "partial") {
		state = {
			...state,
			issues: [
				...state.issues,
				...input.diagnostics.issues.map(({ kind }) => kind),
			],
		};
	}

	return {
		schemaVersion: 1,
		attempt: input.attempt,
		evidence:
			state.issues.length === 0
				? { state: "complete" }
				: { state: "partial", reasons: [...new Set(state.issues)] },
		startingContext: state.events
			.filter(({ region }) => region === "starting-context")
			.map((event) => publicEvent(event)),
		attemptEvents: state.events
			.filter(({ region }) => region === "attempt")
			.map((event) => publicEvent(event)),
		boundaryUnknown: state.events
			.filter(({ region }) => region === "boundary-unknown")
			.map((event) => publicEvent(event)),
		startingSources: sourcesFor(state.events, "starting-context"),
		sources: [
			...sourcesFor(state.events, "attempt"),
			...sourcesFor(state.events, "boundary-unknown"),
		],
		diagnostics: input.diagnostics,
	};
}

export interface SessionHistoryDetail {
	readonly schemaVersion: 1;
	readonly eventId: string;
	readonly locator: TranscriptLocation;
	readonly state: HistoryEventState;
	readonly deliveredText?: string | undefined;
	readonly sourceSnapshot?: string | undefined;
	readonly deliveredMeasurement: TextMeasurement;
	readonly snapshotMeasurement: TextMeasurement;
	readonly applicationTruncated: boolean;
	readonly relatedEventIds: readonly string[];
}

function utf8Prefix(text: string, budget: number): string {
	let bytes = 0;
	let prefix = "";
	for (const character of text) {
		const size = Buffer.byteLength(character, "utf8");
		if (bytes + size > budget) {
			break;
		}
		bytes += size;
		prefix += character;
	}

	return prefix;
}

interface AllocatedDetailBodies {
	readonly deliveredText: string | undefined;
	readonly sourceSnapshot: string | undefined;
	readonly truncated: boolean;
}

function allocateDetailBodies(
	delivered: string | undefined,
	snapshot: string | undefined,
): AllocatedDetailBodies {
	const bodies = [delivered, snapshot].filter(
		(value): value is string => value !== undefined,
	);
	if (bodies.length === 0) {
		return { deliveredText: undefined, sourceSnapshot: undefined, truncated: false };
	}
	if (bodies.length === 1) {
		const [body = ""] = bodies;
		const excerpt = utf8Prefix(body, MAX_EVENT_DETAIL_BYTES);

		return {
			deliveredText: delivered === undefined ? undefined : excerpt,
			sourceSnapshot: snapshot === undefined ? undefined : excerpt,
			truncated: excerpt !== body,
		};
	}

	const half = Math.floor(MAX_EVENT_DETAIL_BYTES / 2);
	let deliveredText = utf8Prefix(delivered ?? "", half);
	let sourceSnapshot = utf8Prefix(snapshot ?? "", half);
	const remaining =
		MAX_EVENT_DETAIL_BYTES -
		Buffer.byteLength(deliveredText, "utf8") -
		Buffer.byteLength(sourceSnapshot, "utf8");
	if (remaining > 0 && deliveredText === delivered) {
		sourceSnapshot = utf8Prefix(snapshot ?? "", half + remaining);
	} else if (remaining > 0 && sourceSnapshot === snapshot) {
		deliveredText = utf8Prefix(delivered ?? "", half + remaining);
	}

	return {
		deliveredText,
		sourceSnapshot,
		truncated: deliveredText !== delivered || sourceSnapshot !== snapshot,
	};
}

export function sessionHistoryDetail(
	input: Immutable<SessionHistoryReportInput>,
	eventId: string,
): SessionHistoryDetail | undefined {
	if (input.transcript === undefined) {
		return undefined;
	}
	const projection = joinEvents(parseEvents(input));
	const event = projection.events.find(({ id }) => id === eventId);
	if (event === undefined) {
		return undefined;
	}
	const excerpts = allocateDetailBodies(event.content, event.snapshot);

	return {
		schemaVersion: 1,
		eventId: event.id,
		locator: event.locator,
		state: event.state,
		deliveredText: excerpts.deliveredText,
		sourceSnapshot: excerpts.sourceSnapshot,
		deliveredMeasurement: event.measurement,
		snapshotMeasurement: measureContent(event.snapshot).measurement,
		applicationTruncated: excerpts.truncated,
		relatedEventIds: event.relatedEventIds,
	};
}
