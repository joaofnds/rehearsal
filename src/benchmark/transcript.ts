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
	name: z.string().min(1),
	input: z.looseObject({ file_path: z.string().optional() }),
});

const transcriptRecordSchema = z.looseObject({
	message: z
		.looseObject({ content: z.array(z.unknown()).optional() })
		.optional(),
});

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

export interface TranscriptLine {
	readonly toolUses: readonly ToolUse[];
	readonly outputStyle: string | undefined;
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

function readLine(line: string): TranscriptLine {
	const parsed = readJson(line);
	const record = transcriptRecordSchema.safeParse(parsed);
	const blocks = record.success ? (record.data.message?.content ?? []) : [];

	return {
		toolUses: blocks
			.map((block) => toolUseSchema.safeParse(block))
			.filter((use) => use.success)
			.map((use) => use.data),
		outputStyle: readOutputStyle(parsed),
	};
}

function readJson(line: string): JsonValue {
	try {
		const parsed = jsonValueSchema.safeParse(JSON.parse(line));

		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function parseTranscript(text: string): readonly TranscriptLine[] {
	return text
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => readLine(line));
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
	for await (const line of fileLines(path, observer)) {
		if (line.trim() !== "") {
			lines.push(readLine(line));
		}
	}

	return lines;
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
