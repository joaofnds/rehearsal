import { describe, expect, it } from "bun:test";
import type { JsonValue } from "#benchmark/json-value";
import { filesRead, parseTranscript, toolUses } from "#benchmark/transcript";

function line(record: JsonValue): string {
	return JSON.stringify(record);
}

function assistantWith(...blocks: readonly JsonValue[]): string {
	return line({ type: "assistant", message: { content: blocks } });
}

const readBlock = {
	type: "tool_use",
	id: "toolu_1",
	name: "Read",
	input: { file_path: "/tmp/x.md" },
};

const bashBlock = {
	type: "tool_use",
	id: "toolu_2",
	name: "Bash",
	input: { command: "ls" },
};

describe(parseTranscript.name, () => {
	it("collects the tool_use blocks of every assistant record", () => {
		const transcript = parseTranscript(
			[
				line({ type: "user", message: { content: "hello" } }),
				assistantWith({ type: "text", text: "thinking" }, readBlock),
				assistantWith(bashBlock),
			].join("\n"),
		);

		expect(toolUses(transcript).map(({ name }) => name)).toEqual([
			"Read",
			"Bash",
		]);
	});

	it("reads a record type it does not recognize as one with no tool calls", () => {
		const transcript = parseTranscript(
			[
				line({ type: "queue-operation", operation: "enqueue" }),
				line({ type: "future-record-kind", payload: { anything: true } }),
			].join("\n"),
		);

		expect(toolUses(transcript)).toEqual([]);
	});

	it("reads a line that is not JSON as one with no tool calls", () => {
		expect(toolUses(parseTranscript("not json at all\n"))).toEqual([]);
	});

	it("ignores blank lines, including a trailing newline", () => {
		expect(parseTranscript(`${assistantWith(readBlock)}\n\n`)).toHaveLength(1);
	});
});

describe(filesRead.name, () => {
	it("returns the file_path of every Read call and nothing else", () => {
		const transcript = parseTranscript(assistantWith(readBlock, bashBlock));

		expect(filesRead(toolUses(transcript))).toEqual(["/tmp/x.md"]);
	});
});
