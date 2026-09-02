import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { PROJECT_INSTRUCTIONS_PATH } from "#benchmark/config";
import {
	CorpusFileError,
	hashCorpusFiles,
	resolveCorpusFile,
} from "#benchmark/corpus-file";
import { failureOf } from "#cli/cli-test-support";

describe(resolveCorpusFile.name, () => {
	it.each([
		[
			"output-styles/brief.md",
			join(homedir(), ".claude/output-styles/brief.md"),
		],
		["agents/reviewer.md", join(homedir(), ".claude/agents/reviewer.md")],
		["skills/build/SKILL.md", join(homedir(), ".claude/skills/build/SKILL.md")],
	])("resolves %s onto the install", (layoutPath, expected) => {
		expect(resolveCorpusFile(layoutPath)).toBe(expected);
	});

	it("resolves CLAUDE.md to the control root's project instructions", () => {
		expect(resolveCorpusFile("CLAUDE.md")).toBe(PROJECT_INSTRUCTIONS_PATH);
	});

	it("refuses a path that is not a corpus layout path, naming it", () => {
		expect(() => resolveCorpusFile("docs/vision.md")).toThrow(
			"Corpus file docs/vision.md names no corpus layout path",
		);
	});
});

describe(hashCorpusFiles.name, () => {
	it("hashes each declared file's bytes under its layout path", async () => {
		const [only] = await hashCorpusFiles(["CLAUDE.md"]);

		expect(only?.path).toBe("CLAUDE.md");
		expect(only?.sha256).toBe(
			new Bun.CryptoHasher("sha256")
				.update(await Bun.file(PROJECT_INSTRUCTIONS_PATH).bytes())
				.digest("hex"),
		);
	});

	it("refuses a declared file that does not exist, naming the resolved path", async () => {
		const failure = await failureOf(
			hashCorpusFiles(["output-styles/no-such-style.md"]),
		);

		expect(failure).toBeInstanceOf(CorpusFileError);
		expect(failure.message).toContain(
			join(homedir(), ".claude/output-styles/no-such-style.md"),
		);
	});
});
