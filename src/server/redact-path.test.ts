import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { redactAbsolutePaths } from "./redact-path";

async function messageFromReadingMissingFile(
	directoryName: string,
): Promise<{ message: string; root: string }> {
	const root = await mkdtemp(join(tmpdir(), directoryName));

	try {
		await readFile(join(root, "secret.md"), "utf8");
	} catch (error) {
		if (error instanceof Error) {
			return { message: error.message, root };
		}
	}

	throw new Error("reading a missing file did not throw an Error");
}

async function messageFromRenamingMissingFile(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "rehearsal-redact-rename-"));

	try {
		await rename(join(root, "from.md"), join(root, "to.md"));
	} catch (error) {
		if (error instanceof Error) {
			return error.message;
		}
	}

	throw new Error("renaming a missing file did not throw an Error");
}

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

	test("redacts a path Node quoted in an fs error", () => {
		expect(
			redactAbsolutePaths(
				"ENOENT: no such file or directory, open '/Users/joaofnds/secret.md'",
			),
		).toBe("ENOENT: no such file or directory, open '<path>'");
	});

	test("redacts a real fs error naming a missing file under a temp directory", async () => {
		const { message, root } =
			await messageFromReadingMissingFile("rehearsal-redact-");

		expect(redactAbsolutePaths(message)).not.toContain(root);
	});

	test("redacts a real fs error under a temp directory whose name contains a space", async () => {
		const { message, root } = await messageFromReadingMissingFile(
			"rehearsal redact space ",
		);

		expect(redactAbsolutePaths(message)).not.toContain(root);
	});

	test("redacts a real fs error under a temp directory whose name contains an apostrophe", async () => {
		const { message, root } = await messageFromReadingMissingFile(
			"rehearsal-Bob's-redact-",
		);

		expect(redactAbsolutePaths(message)).not.toContain(root);
	});

	test("redacts a quoted path under a root this process does not know", () => {
		expect(redactAbsolutePaths("failed at /srv/target-repo/x.md")).toBe(
			"failed at <path>",
		);
	});

	test("redacts both paths of a real two-path fs error, closing quotes intact", async () => {
		const message = await messageFromRenamingMissingFile();

		expect(redactAbsolutePaths(message)).toBe(
			"ENOENT: no such file or directory, rename '<path>' -> '<path>'",
		);
	});

	test("leaves a relative case declaration path untouched", () => {
		expect(redactAbsolutePaths("cases/act-1/case.json is malformed")).toBe(
			"cases/act-1/case.json is malformed",
		);
	});

	test("leaves a relative corpus path in a refusal untouched", () => {
		expect(
			redactAbsolutePaths(
				"agents/escape.md resolves outside the tree it is named under",
			),
		).toBe("agents/escape.md resolves outside the tree it is named under");
	});
});
