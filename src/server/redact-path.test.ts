import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { redactAbsolutePaths, redactorFor } from "./redact-path";

const roots: string[] = [];

afterEach(async () => {
	await Promise.all(
		roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
	);
});

async function temporaryDirectory(prefix: string): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), prefix));
	roots.push(root);

	return root;
}

async function messageFromReadingMissingFile(
	directoryName: string,
): Promise<{ message: string; root: string }> {
	const root = await temporaryDirectory(directoryName);

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
	const root = await temporaryDirectory("rehearsal-redact-rename-");

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
		const { message } =
			await messageFromReadingMissingFile("rehearsal-redact-");

		expect(redactAbsolutePaths(message)).toBe(
			"ENOENT: no such file or directory, open '<path>'",
		);
	});

	test("redacts a real fs error under a temp directory whose name contains a space", async () => {
		const { message } = await messageFromReadingMissingFile(
			"rehearsal redact space ",
		);

		expect(redactAbsolutePaths(message)).toBe(
			"ENOENT: no such file or directory, open '<path>'",
		);
	});

	test("redacts a bare known root that follows no word boundary", () => {
		expect(redactAbsolutePaths(`path=${homedir()}/a/secret.md`)).toBe(
			"path=<path>",
		);
	});

	test("redacts a path under an unknown root that Node quoted", () => {
		expect(redactAbsolutePaths("open '/srv/target-repo/x.md'")).toBe(
			"open '<path>'",
		);
	});

	test("redacts a path under an unknown root that follows a word boundary", () => {
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

	describe("when a directory in the path is named with an apostrophe", () => {
		test("removes the root and leaves the fragment after the apostrophe", async () => {
			const { message, root } = await messageFromReadingMissingFile(
				"rehearsal-Bob's-redact-",
			);
			const tail = root.slice(root.indexOf("'"));

			expect(redactAbsolutePaths(message)).toBe(
				`ENOENT: no such file or directory, open '<path>${tail}/secret.md'`,
			);
		});
	});

	describe("under a degenerate root the process reports", () => {
		test("leaves a relative corpus path alone when a root is the filesystem root", () => {
			const redact = redactorFor(["/", "/var/folders/x2/T"]);

			expect(redact("Corpus file skills/build/SKILL.md not found")).toBe(
				"Corpus file skills/build/SKILL.md not found",
			);
		});

		test("leaves a relative corpus path alone when a root is empty", () => {
			const redact = redactorFor(["", "/var/folders/x2/T"]);

			expect(redact("Corpus file skills/build/SKILL.md not found")).toBe(
				"Corpus file skills/build/SKILL.md not found",
			);
		});

		test("still redacts an absolute path when every root is degenerate", () => {
			const redact = redactorFor(["/", ""]);

			expect(redact("open '/srv/target-repo/secret.md'")).toBe("open '<path>'");
		});
	});
});
