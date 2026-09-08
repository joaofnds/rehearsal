import { describe, expect, it } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JsonValue } from "#benchmark/json-value";
import {
	filesRead,
	outputStyles,
	parseTranscript,
	parseTranscriptFile,
	toolUses,
} from "#benchmark/transcript";
import { TestResources } from "#benchmark/test-support";

const testResources = TestResources.forEachTest();

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

describe(parseTranscriptFile.name, () => {
	async function transcriptFile(lines: readonly string[]): Promise<string> {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-transcript-"));
		testResources.track(directory);
		const path = join(directory, "transcript.jsonl");
		await writeFile(path, `${lines.join("\n")}\n`);

		return path;
	}

	function filler(ordinal: number): string {
		return line({ type: "user", ordinal, filler: "x".repeat(4096) });
	}

	it("reads the tool calls of a transcript on disk", async () => {
		const path = await transcriptFile([
			assistantWith({ type: "text", text: "thinking" }, readBlock),
			assistantWith(bashBlock),
		]);

		const transcript = await parseTranscriptFile(path);

		expect(toolUses(transcript).map(({ name }) => name)).toEqual([
			"Read",
			"Bash",
		]);
	});

	it("reads an absent transcript as one with no records", async () => {
		expect(await parseTranscriptFile("/no/such/transcript.jsonl")).toEqual([]);
	});

	/**
	 * ACT-25's resumed cases carry real multi-megabyte transcripts, so this
	 * reads like the capture path rather than holding the file as one string.
	 * An observer that is never called leaves the count at zero, which is what
	 * a non-streaming subject would do.
	 */
	const ONE_CHUNK_AND_A_LINE = 768 * 1024;

	it("never holds the whole transcript, only one read chunk and a partial line", async () => {
		const path = await transcriptFile(
			Array.from({ length: 400 }, (_value, index) => filler(index)),
		);
		let widest = 0;
		let observations = 0;

		await parseTranscriptFile(path, {
			carry: (characters) => {
				observations += 1;
				widest = Math.max(widest, characters);
			},
		});

		expect(Bun.file(path).size).toBeGreaterThan(1024 * 1024);
		expect(observations).toBeGreaterThan(1);
		expect(widest).toBeLessThan(ONE_CHUNK_AND_A_LINE);
	});
});

describe(filesRead.name, () => {
	it("returns the file_path of every Read call and nothing else", () => {
		const transcript = parseTranscript(assistantWith(readBlock, bashBlock));

		expect(filesRead(toolUses(transcript))).toEqual(["/tmp/x.md"]);
	});
});

function attachmentLine(attachment: JsonValue): string {
	return line({ type: "attachment", attachment });
}

describe(outputStyles.name, () => {
	it("returns the style name of every output_style attachment in order", () => {
		const transcript = parseTranscript(
			[
				attachmentLine({ type: "output_style", style: "brief" }),
				attachmentLine({ type: "skill_listing", names: ["verify"] }),
				attachmentLine({ type: "output_style", style: "concise" }),
			].join("\n"),
		);

		expect(outputStyles(transcript)).toEqual(["brief", "concise"]);
	});

	it("returns nothing for a transcript with no output_style attachment", () => {
		expect(
			outputStyles(parseTranscript(attachmentLine({ type: "budget_usd" }))),
		).toEqual([]);
	});
});
