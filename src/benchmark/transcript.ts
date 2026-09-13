import { z } from "zod";
import type { Immutable } from "./contracts";
import type { LineObserver } from "./file-lines";
import { fileLines, IGNORE_CARRY } from "./file-lines";
import type { JsonValue } from "./json-value";
import { jsonValueSchema } from "./json-value";

/**
 * The session file's format is the provider's, not ours, so a record type this
 * harness does not recognize reads as a record with no tool calls rather than
 * as a failure. A strict schema here would turn a new provider record type into
 * a failed attempt, which is a false negative on the thing being measured.
 */
const toolUseSchema = z.looseObject({
	type: z.literal("tool_use"),
	id: z.string().min(1).optional(),
	name: z.string().min(1),
	input: z.looseObject({
		file_path: z.string().optional(),
		command: z.string().optional(),
	}),
});

const transcriptRecordSchema = z.looseObject({
	message: z
		.looseObject({
			content: z.union([z.string(), z.array(z.unknown())]).optional(),
		})
		.optional(),
});

const toolResultSchema = z.looseObject({
	type: z.literal("tool_result"),
	tool_use_id: z.string().min(1).optional(),
	is_error: z.boolean().optional(),
});

const contentBlockSchema = z.looseObject({ type: z.string().min(1) });

const outputStyleAttachmentSchema = z.looseObject({
	type: z.literal("output_style"),
	style: z.string().min(1),
});

const attachmentRecordSchema = z.looseObject({
	type: z.literal("attachment"),
	attachment: z.unknown(),
});

const skillUseSchema = z.looseObject({
	type: z.literal("tool_use"),
	name: z.literal("Skill"),
	input: z.looseObject({ skill: z.string().min(1) }),
});

export type ToolUse = z.infer<typeof toolUseSchema>;

export const transcriptLocationSchema = z
	.object({
		line: z.number().int().positive(),
		block: z.number().int().positive(),
	})
	.strict();

export type TranscriptLocation = z.infer<typeof transcriptLocationSchema>;

const diagnosticIssueKindSchema = z.enum([
	"empty-measured-transcript",
	"invalid-json",
	"invalid-message-content",
	"unsupported-content-block",
	"invalid-tool-use",
	"invalid-tool-result",
	"missing-tool-use-id",
	"duplicate-tool-use-id",
	"missing-tool-result-id",
	"duplicate-tool-result",
	"unmatched-tool-result",
	"missing-tool-result",
	"invalid-bash-command",
]);

const diagnosticIssueSchema = z
	.object({
		kind: diagnosticIssueKindSchema,
		occurrences: z.number().int().positive(),
		locations: z.array(transcriptLocationSchema),
		locationsTruncated: z.boolean(),
	})
	.strict();

const observedToolUseCountsSchema = z
	.object({
		total: z.number().int().nonnegative(),
		byName: z.array(
			z
				.object({
					name: z.string().min(1),
					count: z.number().int().positive(),
				})
				.strict(),
		),
	})
	.strict();

const toolErrorSchema = z
	.object({
		toolUseId: z.string().min(1).optional(),
		toolName: z.string().min(1).optional(),
		call: transcriptLocationSchema.optional(),
		result: transcriptLocationSchema,
	})
	.strict();

const repeatedBashCommandSchema = z
	.object({
		commandSha256: z
			.string()
			.regex(/^[0-9a-f]{64}$/u, "Invalid SHA-256 digest"),
		commandCharacters: z.number().int().nonnegative(),
		preview: z.string(),
		previewTruncated: z.boolean(),
		occurrences: z
			.array(
				z
					.object({
						toolUseId: z.string().min(1),
						location: transcriptLocationSchema,
					})
					.strict(),
			)
			.min(2),
	})
	.strict();

const transcriptObservationsSchema = {
	prefixLinesExcluded: z.number().int().nonnegative(),
	sourceLineCount: z.number().int().nonnegative(),
	measuredLineCount: z.number().int().nonnegative(),
	toolUseOccurrences: observedToolUseCountsSchema,
	toolErrors: z.array(toolErrorSchema),
	repeatedBashCommands: z.array(repeatedBashCommandSchema),
	issues: z.array(diagnosticIssueSchema),
};

export const transcriptDiagnosticsSchema = z.discriminatedUnion("state", [
	z
		.object({
			state: z.literal("complete"),
			...transcriptObservationsSchema,
		})
		.strict(),
	z
		.object({
			state: z.literal("partial"),
			...transcriptObservationsSchema,
		})
		.strict(),
	z
		.object({
			state: z.literal("unavailable"),
			prefixLinesExcluded: z.number().int().nonnegative(),
		})
		.strict(),
]);

export type TranscriptDiagnostics = z.infer<typeof transcriptDiagnosticsSchema>;

interface LocatedToolUse {
	readonly use: ToolUse;
	readonly location: TranscriptLocation;
}

interface LocatedToolResult {
	readonly toolUseId: string | undefined;
	readonly isError: boolean;
	readonly location: TranscriptLocation;
}

interface LocatedDiagnosticIssue {
	readonly kind: z.infer<typeof diagnosticIssueKindSchema>;
	readonly location: TranscriptLocation;
}

interface IdentifiedToolUse {
	readonly toolUseId: string;
	readonly use: ToolUse;
	readonly location: TranscriptLocation;
}

export interface TranscriptLine {
	readonly line: number;
	readonly toolUses: readonly ToolUse[];
	readonly outputStyle: string | undefined;
	readonly locatedToolUses: readonly LocatedToolUse[];
	readonly locatedToolResults: readonly LocatedToolResult[];
	readonly diagnosticIssues: readonly LocatedDiagnosticIssue[];
}

function readOutputStyle(record: JsonValue): string | undefined {
	const attachmentRecord = attachmentRecordSchema.safeParse(record);
	if (!attachmentRecord.success) {
		return undefined;
	}

	const outputStyle = outputStyleAttachmentSchema.safeParse(
		attachmentRecord.data.attachment,
	);

	return outputStyle.success ? outputStyle.data.style : undefined;
}

const SUPPORTED_NON_TOOL_BLOCKS = new Set([
	"image",
	"redacted_thinking",
	"text",
	"thinking",
]);

function readLine(line: string, lineNumber: number): TranscriptLine {
	const parsed = readJson(line);
	if (parsed === undefined) {
		return emptyTranscriptLine(lineNumber, "invalid-json");
	}

	const record = transcriptRecordSchema.safeParse(parsed);
	if (!record.success) {
		return emptyTranscriptLine(lineNumber, "invalid-message-content");
	}

	const content = record.data.message?.content;
	const blocks = Array.isArray(content) ? content : [];
	const locatedToolUses: LocatedToolUse[] = [];
	const locatedToolResults: LocatedToolResult[] = [];
	const diagnosticIssues: LocatedDiagnosticIssue[] = [];

	for (const [index, block] of blocks.entries()) {
		const location = { line: lineNumber, block: index + 1 };
		const typed = contentBlockSchema.safeParse(block);
		if (!typed.success) {
			diagnosticIssues.push({
				kind: "unsupported-content-block",
				location,
			});
			continue;
		}

		if (typed.data.type === "tool_use") {
			const use = toolUseSchema.safeParse(block);
			if (use.success) {
				locatedToolUses.push({ use: use.data, location });
			} else {
				diagnosticIssues.push({ kind: "invalid-tool-use", location });
			}
			continue;
		}

		if (typed.data.type === "tool_result") {
			const result = toolResultSchema.safeParse(block);
			if (result.success) {
				locatedToolResults.push({
					toolUseId: result.data.tool_use_id,
					isError: result.data.is_error === true,
					location,
				});
			} else {
				diagnosticIssues.push({ kind: "invalid-tool-result", location });
			}
			continue;
		}

		if (!SUPPORTED_NON_TOOL_BLOCKS.has(typed.data.type)) {
			diagnosticIssues.push({
				kind: "unsupported-content-block",
				location,
			});
		}
	}

	return {
		line: lineNumber,
		toolUses: locatedToolUses.map(({ use }) => use),
		outputStyle: readOutputStyle(parsed),
		locatedToolUses,
		locatedToolResults,
		diagnosticIssues,
	};
}

function emptyTranscriptLine(
	line: number,
	kind: LocatedDiagnosticIssue["kind"],
): TranscriptLine {
	return {
		line,
		toolUses: [],
		outputStyle: undefined,
		locatedToolUses: [],
		locatedToolResults: [],
		diagnosticIssues: [{ kind, location: { line, block: 1 } }],
	};
}

function readJson(line: string): JsonValue | undefined {
	try {
		const parsed = jsonValueSchema.safeParse(JSON.parse(line));

		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
}

export function parseTranscript(text: string): readonly TranscriptLine[] {
	return text
		.split("\n")
		.map((line, index) => ({ line, lineNumber: index + 1 }))
		.filter(({ line }) => line.trim() !== "")
		.map(({ line, lineNumber }) => readLine(line, lineNumber));
}

/**
 * Transcripts run to several megabytes, and ACT-25's resumed cases carry real
 * ones, so a transcript on disk is read one line at a time rather than held as
 * a string. A transcript the provider never wrote reads as no records, which is
 * the same thing an empty one reads as.
 */
export async function parseTranscriptFile(
	path: string,
	observer: LineObserver = IGNORE_CARRY,
): Promise<readonly TranscriptLine[]> {
	if (!(await Bun.file(path).exists())) {
		return [];
	}

	const lines: TranscriptLine[] = [];
	let lineNumber = 0;
	for await (const line of fileLines(path, observer)) {
		lineNumber += 1;
		if (line.trim() !== "") {
			lines.push(readLine(line, lineNumber));
		}
	}

	return lines;
}

export interface TranscriptDiagnosticsInput {
	readonly lines: Immutable<readonly TranscriptLine[]>;
	readonly prefixLinesExcluded: number;
	readonly sourceAvailable: boolean;
}

const MAX_PREVIEW_CHARACTERS = 160;
const MAX_ISSUE_LOCATIONS = 20;

export function transcriptDiagnostics(
	input: Readonly<TranscriptDiagnosticsInput>,
): TranscriptDiagnostics {
	if (!input.sourceAvailable) {
		return {
			state: "unavailable",
			prefixLinesExcluded: input.prefixLinesExcluded,
		};
	}

	const sourceLineCount = input.lines.at(-1)?.line ?? 0;
	const measured = input.lines.slice(input.prefixLinesExcluded);
	const uses = measured.flatMap(({ locatedToolUses }) => locatedToolUses);
	const results = measured.flatMap(
		({ locatedToolResults }) => locatedToolResults,
	);
	const issues = measured.flatMap(({ diagnosticIssues }) => diagnosticIssues);
	if (measured.length === 0) {
		issues.push({
			kind: "empty-measured-transcript",
			location: {
				line: Math.max(1, input.prefixLinesExcluded + 1),
				block: 1,
			},
		});
	}

	const usesById = groupUsesById(uses, issues);
	const resultsById = groupResultsById(results, issues);
	joinIssues(usesById, resultsById, issues);

	const observations = {
		prefixLinesExcluded: input.prefixLinesExcluded,
		sourceLineCount,
		measuredLineCount: measured.length,
		toolUseOccurrences: countToolUses(uses),
		toolErrors: observedErrors(results, usesById),
		repeatedBashCommands: repeatedBashCommands(uses, usesById, issues),
		issues: summarizeIssues(issues),
	};

	return transcriptDiagnosticsSchema.parse({
		state: observations.issues.length === 0 ? "complete" : "partial",
		...observations,
	});
}

function groupUsesById(
	uses: readonly LocatedToolUse[],
	issues: LocatedDiagnosticIssue[],
): ReadonlyMap<string, readonly LocatedToolUse[]> {
	const grouped = new Map<string, LocatedToolUse[]>();
	for (const use of uses) {
		const { id } = use.use;
		if (id === undefined) {
			issues.push({ kind: "missing-tool-use-id", location: use.location });
			continue;
		}

		const occurrences = grouped.get(id) ?? [];
		occurrences.push(use);
		grouped.set(id, occurrences);
	}
	for (const occurrences of grouped.values()) {
		if (occurrences.length > 1) {
			issues.push(
				...occurrences.map(({ location }) => ({
					kind: "duplicate-tool-use-id" as const,
					location,
				})),
			);
		}
	}

	return grouped;
}

function groupResultsById(
	results: readonly LocatedToolResult[],
	issues: LocatedDiagnosticIssue[],
): ReadonlyMap<string, readonly LocatedToolResult[]> {
	const grouped = new Map<string, LocatedToolResult[]>();
	for (const result of results) {
		if (result.toolUseId === undefined) {
			issues.push({
				kind: "missing-tool-result-id",
				location: result.location,
			});
			continue;
		}

		const occurrences = grouped.get(result.toolUseId) ?? [];
		occurrences.push(result);
		grouped.set(result.toolUseId, occurrences);
	}
	for (const occurrences of grouped.values()) {
		if (occurrences.length > 1) {
			issues.push(
				...occurrences.map(({ location }) => ({
					kind: "duplicate-tool-result" as const,
					location,
				})),
			);
		}
	}

	return grouped;
}

function joinIssues(
	usesById: ReadonlyMap<string, readonly LocatedToolUse[]>,
	resultsById: ReadonlyMap<string, readonly LocatedToolResult[]>,
	issues: LocatedDiagnosticIssue[],
): void {
	for (const [id, uses] of usesById) {
		if (!resultsById.has(id)) {
			issues.push(
				...uses.map(({ location }) => ({
					kind: "missing-tool-result" as const,
					location,
				})),
			);
		}
	}
	for (const [id, results] of resultsById) {
		if (!usesById.has(id)) {
			issues.push(
				...results.map(({ location }) => ({
					kind: "unmatched-tool-result" as const,
					location,
				})),
			);
		}
	}
}

function countToolUses(
	uses: readonly LocatedToolUse[],
): z.infer<typeof observedToolUseCountsSchema> {
	const byName = new Map<string, number>();
	for (const { use } of uses) {
		byName.set(use.name, (byName.get(use.name) ?? 0) + 1);
	}

	return {
		total: uses.length,
		byName: [...byName].map(([name, count]) => ({ name, count })),
	};
}

function observedErrors(
	results: readonly LocatedToolResult[],
	usesById: ReadonlyMap<string, readonly LocatedToolUse[]>,
): z.infer<typeof toolErrorSchema>[] {
	return results
		.filter(({ isError }) => isError)
		.map((result) => {
			const matches =
				result.toolUseId === undefined
					? []
					: (usesById.get(result.toolUseId) ?? []);
			const [match] = matches.length === 1 ? matches : [];

			return {
				...(result.toolUseId === undefined
					? {}
					: { toolUseId: result.toolUseId }),
				...(match === undefined
					? {}
					: { toolName: match.use.name, call: match.location }),
				result: result.location,
			};
		});
}

function repeatedBashCommands(
	uses: readonly LocatedToolUse[],
	usesById: ReadonlyMap<string, readonly LocatedToolUse[]>,
	issues: LocatedDiagnosticIssue[],
): z.infer<typeof repeatedBashCommandSchema>[] {
	const grouped = new Map<string, IdentifiedToolUse[]>();
	for (const use of uses) {
		if (use.use.name !== "Bash") {
			continue;
		}

		const command = use.use.input.command;
		if (command === undefined) {
			issues.push({ kind: "invalid-bash-command", location: use.location });
			continue;
		}

		const id = use.use.id;
		if (id === undefined || usesById.get(id)?.length !== 1) {
			continue;
		}

		const occurrences = grouped.get(command) ?? [];
		occurrences.push({ toolUseId: id, use: use.use, location: use.location });
		grouped.set(command, occurrences);
	}

	return [...grouped]
		.filter(([_command, occurrences]) => occurrences.length > 1)
		.map(([command, occurrences]) =>
			describeRepeatedCommand(command, occurrences),
		);
}

function describeRepeatedCommand(
	command: string,
	occurrences: readonly IdentifiedToolUse[],
): z.infer<typeof repeatedBashCommandSchema> {
	const characters = [...command];
	const preview = characters.slice(0, MAX_PREVIEW_CHARACTERS).join("");

	return {
		commandSha256: new Bun.CryptoHasher("sha256").update(command).digest("hex"),
		commandCharacters: characters.length,
		preview,
		previewTruncated: characters.length > MAX_PREVIEW_CHARACTERS,
		occurrences: occurrences.map(({ toolUseId, location }) => ({
			toolUseId,
			location,
		})),
	};
}

function summarizeIssues(
	issues: readonly LocatedDiagnosticIssue[],
): z.infer<typeof diagnosticIssueSchema>[] {
	const grouped = new Map<
		LocatedDiagnosticIssue["kind"],
		TranscriptLocation[]
	>();
	for (const issue of issues) {
		const locations = grouped.get(issue.kind) ?? [];
		locations.push(issue.location);
		grouped.set(issue.kind, locations);
	}

	return [...grouped].map(([kind, locations]) => ({
		kind,
		occurrences: locations.length,
		locations: locations.slice(0, MAX_ISSUE_LOCATIONS),
		locationsTruncated: locations.length > MAX_ISSUE_LOCATIONS,
	}));
}

export function toolUses(
	lines: Immutable<readonly TranscriptLine[]>,
): readonly ToolUse[] {
	return lines.flatMap((line) => [...line.toolUses]);
}

export function filesRead(
	uses: Immutable<readonly ToolUse[]>,
): readonly string[] {
	return uses
		.filter((use) => use.name === "Read")
		.map((use) => use.input.file_path)
		.filter((path) => path !== undefined);
}

export function outputStyles(
	lines: Immutable<readonly TranscriptLine[]>,
): readonly string[] {
	return lines
		.map((line) => line.outputStyle)
		.filter((style) => style !== undefined);
}

export function skillsInvoked(
	uses: Immutable<readonly ToolUse[]>,
): readonly string[] {
	return uses
		.map((use) => skillUseSchema.safeParse(use))
		.filter((parsed) => parsed.success)
		.map((parsed) => parsed.data.input.skill);
}
