import { describe, expect, test } from "bun:test";
import { redactAbsolutePaths } from "./redact-path";

describe(redactAbsolutePaths.name, () => {
	test("replaces a POSIX absolute path with a redaction marker", () => {
		const message = redactAbsolutePaths(
			"The build skill is not installed; searched /Users/joaofnds/.claude, /var/folders/x2/probe",
		);

		expect(message).toBe(
			"The build skill is not installed; searched <path>, <path>",
		);
	});

	test("leaves a message with no absolute path unchanged", () => {
		expect(redactAbsolutePaths("no record run:x")).toBe("no record run:x");
	});

	test("redacts a path embedded mid-sentence, not only a bare path", () => {
		const message = redactAbsolutePaths(
			"No record run:no-such-run at /Users/joaofnds/code/rehearsal/.benchmark-runs/x.json",
		);

		expect(message).toBe("No record run:no-such-run at <path>");
	});

	test("leaves a relative record id's slash-separated segment untouched", () => {
		expect(
			redactAbsolutePaths(
				"checkpoint:2026-09-06T21-58-29.508Z/shape names a path outside the runs directory",
			),
		).toBe(
			"checkpoint:2026-09-06T21-58-29.508Z/shape names a path outside the runs directory",
		);
	});

	test("leaves a relative corpus file path untouched", () => {
		expect(
			redactAbsolutePaths("Corpus file skills/build/SKILL.md not found"),
		).toBe("Corpus file skills/build/SKILL.md not found");
	});
});
