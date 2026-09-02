import { z } from "zod";
import type { Immutable } from "./contracts";
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

export type ToolUse = z.infer<typeof toolUseSchema>;

export interface TranscriptLine {
	readonly toolUses: readonly ToolUse[];
}

function readLine(line: string): TranscriptLine {
	const record = transcriptRecordSchema.safeParse(readJson(line));
	const blocks = record.success ? (record.data.message?.content ?? []) : [];

	return {
		toolUses: blocks
			.map((block) => toolUseSchema.safeParse(block))
			.filter((parsed) => parsed.success)
			.map((parsed) => parsed.data),
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
