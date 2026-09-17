import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandOutput } from "#cli/output";
import { diagnosticWriter, writeDiagnostic, writeRecord } from "#cli/output";

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
		const directory = await mkdtemp(join(tmpdir(), "rehearse-record-"));
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

describe(diagnosticWriter.name, () => {
	it("terminates each diagnostic with a newline on stderr", () => {
		const stderr: string[] = [];
		const output: CommandOutput = {
			stdout: () => {
				throw new Error("a diagnostic never goes to stdout");
			},
			stderr: (text) => {
				stderr.push(text);
			},
		};

		const log = diagnosticWriter(output);
		log("Baseline checks");
		log("Target restored");

		expect(stderr).toEqual(["Baseline checks\n", "Target restored\n"]);
	});
});

describe(writeDiagnostic.name, () => {
	const stderr: string[] = [];
	const output: CommandOutput = {
		stdout: () => {
			throw new Error("a diagnostic never goes to stdout");
		},
		stderr: (text) => {
			stderr.push(text);
		},
	};

	beforeEach(() => {
		stderr.length = 0;
	});

	it("terminates the diagnostic with a newline on stderr", () => {
		writeDiagnostic(output, "Judge shares the candidate's model");

		expect(stderr).toEqual(["Judge shares the candidate's model\n"]);
	});

	it("writes nothing when there is no diagnostic", () => {
		writeDiagnostic(output, undefined);

		expect(stderr).toEqual([]);
	});
});
