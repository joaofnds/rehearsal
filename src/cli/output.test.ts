import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandOutput } from "#cli/output";
import { writeRecord } from "#cli/output";

describe(writeRecord.name, () => {
	const temporaryDirectories: string[] = [];
	const written: string[] = [];
	const output: CommandOutput = {
		stdout: (text) => {
			written.push(text);
		},
		stderr: () => {
			throw new Error("a record never goes to stderr");
		},
	};

	afterEach(async () => {
		written.length = 0;
		await Promise.all(
			temporaryDirectories
				.splice(0)
				.map((directory) => rm(directory, { force: true, recursive: true })),
		);
	});

	it("writes the record's own bytes when json output is requested", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-record-"));
		temporaryDirectories.push(directory);
		const recordFile = join(directory, "record.json");
		await Bun.write(recordFile, '{\n  "schemaVersion": 1\n}\n');

		await writeRecord(output, recordFile, true);

		expect(written.join("")).toBe(await Bun.file(recordFile).text());
	});

	it("writes the record's path, newline terminated, otherwise", async () => {
		await writeRecord(output, "/runs/record.json", false);

		expect(written.join("")).toBe("/runs/record.json\n");
	});
});
