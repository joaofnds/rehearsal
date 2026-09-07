import { describe, expect, test } from "bun:test";
import { corpusDigest } from "./corpus-digest";

describe("corpusDigest", () => {
	test("is a 6-character lowercase hex string", () => {
		const digest = corpusDigest([{ path: "CLAUDE.md", sha256: "a".repeat(64) }]);

		expect(digest).toMatch(/^[0-9a-f]{6}$/u);
	});

	test("changes when one file's hash changes", () => {
		const before = corpusDigest([
			{ path: "CLAUDE.md", sha256: "a".repeat(64) },
		]);
		const after = corpusDigest([{ path: "CLAUDE.md", sha256: "b".repeat(64) }]);

		expect(after).not.toBe(before);
	});

	test("is independent of file order", () => {
		const files = [
			{ path: "CLAUDE.md", sha256: "a".repeat(64) },
			{ path: "skills/build.md", sha256: "b".repeat(64) },
		];

		expect(corpusDigest(files)).toBe(corpusDigest([...files].reverse()));
	});
});
