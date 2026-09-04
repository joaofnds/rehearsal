import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	CorpusFileError,
	hashCorpusFiles,
	liveCorpusInstructions,
	readCorpusInstructions,
	resolveCorpusFile,
} from "#benchmark/corpus-file";
import { liveCorpusRoot, resolveCorpusSource } from "#benchmark/corpus-source";
import { TestResources } from "#benchmark/test-support";
import { failureOf } from "#cli/cli-test-support";

const live = await resolveCorpusSource(undefined);
const resources = TestResources.forEachTest();

describe(resolveCorpusFile.name, () => {
	it.each([
		[
			"output-styles/brief.md",
			join(homedir(), ".claude/output-styles/brief.md"),
		],
		["agents/reviewer.md", join(homedir(), ".claude/agents/reviewer.md")],
		["skills/build/SKILL.md", join(homedir(), ".claude/skills/build/SKILL.md")],
	])("resolves %s onto the install", (layoutPath, expected) => {
		expect(resolveCorpusFile(live, layoutPath)).toBe(expected);
	});

	it("resolves CLAUDE.md onto the install, like every other corpus kind", () => {
		expect(resolveCorpusFile(live, "CLAUDE.md")).toBe(
			join(liveCorpusRoot(), "CLAUDE.md"),
		);
	});

	it("refuses a path that is not a corpus layout path, naming it", () => {
		expect(() => resolveCorpusFile(live, "docs/vision.md")).toThrow(
			"Corpus file docs/vision.md names no corpus layout path",
		);
	});

	it.each([
		"skills/../../../../etc/passwd",
		"agents/../../.ssh/id_rsa",
		"output-styles/../../.claude.json",
		"skills/build/../../../../etc/hosts",
	])("refuses %s, which escapes the corpus install", (layoutPath) => {
		expect(() => resolveCorpusFile(live, layoutPath)).toThrow(CorpusFileError);
	});

	it("names the escaping path it refuses", () => {
		expect(() => resolveCorpusFile(live, "agents/../../.ssh/id_rsa")).toThrow(
			"agents/../../.ssh/id_rsa",
		);
	});

	it("resolves a layout path whose segments are ordinary names", () => {
		expect(resolveCorpusFile(live, "skills/build/references/core.md")).toBe(
			join(homedir(), ".claude/skills/build/references/core.md"),
		);
	});
});

describe(hashCorpusFiles.name, () => {
	it("hashes each declared file's bytes under its layout path", async () => {
		const [only] = await hashCorpusFiles(live, ["CLAUDE.md"]);

		expect(only?.path).toBe("CLAUDE.md");
		expect(only?.sha256).toBe(
			new Bun.CryptoHasher("sha256")
				.update(await Bun.file(join(liveCorpusRoot(), "CLAUDE.md")).bytes())
				.digest("hex"),
		);
	});

	it("refuses a declared file that does not exist, naming the resolved path", async () => {
		const failure = await failureOf(
			hashCorpusFiles(live, ["output-styles/no-such-style.md"]),
		);

		expect(failure).toBeInstanceOf(CorpusFileError);
		expect(failure.message).toContain(
			join(homedir(), ".claude/output-styles/no-such-style.md"),
		);
	});
});

describe("hashing a directory source's own bytes", () => {
	it("returns the directory's digests, which differ from the live install's for the same layout path", async () => {
		const root = await resources.createControlDirectory();
		await Bun.write(
			join(root, "output-styles/brief.md"),
			"a brief the live install does not hold\n",
		);
		const source = await resolveCorpusSource(root);

		const [variant] = await hashCorpusFiles(source, ["output-styles/brief.md"]);
		const [installed] = await hashCorpusFiles(live, ["output-styles/brief.md"]);

		expect(variant?.resolvedPath).toBe(join(root, "output-styles/brief.md"));
		expect(variant?.sha256).toBe(
			new Bun.CryptoHasher("sha256")
				.update("a brief the live install does not hold\n")
				.digest("hex"),
		);
		expect(variant?.sha256).not.toBe(installed?.sha256 ?? "");
	});
});

describe(readCorpusInstructions.name, () => {
	it("reads the corpus root's CLAUDE.md", async () => {
		const root = await resources.createControlDirectory();
		await Bun.write(join(root, "CLAUDE.md"), "corpus instructions\n");

		expect(await readCorpusInstructions(await resolveCorpusSource(root))).toBe(
			"corpus instructions\n",
		);
	});

	it("refuses a corpus holding no CLAUDE.md, naming the resolved path", async () => {
		const root = await resources.createControlDirectory();
		await Bun.write(join(root, "output-styles/brief.md"), "a brief\n");

		const failure = await failureOf(
			readCorpusInstructions(await resolveCorpusSource(root)),
		);

		expect(failure).toBeInstanceOf(CorpusFileError);
		expect(failure.message).toContain(join(root, "CLAUDE.md"));
	});
});

describe(liveCorpusInstructions.name, () => {
	it("reads the live install's CLAUDE.md, not the control repository's", async () => {
		expect(await liveCorpusInstructions()).toBe(
			await Bun.file(join(liveCorpusRoot(), "CLAUDE.md")).text(),
		);
	});
});
