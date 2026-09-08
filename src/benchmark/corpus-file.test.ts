import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, symlink } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, relative } from "node:path";
import { CONTROL_DIR } from "#benchmark/config";
import { SymlinkedEntryError } from "#benchmark/file-presence";
import {
	CorpusFileError,
	hashCorpusFiles,
	liveCorpusInstructions,
	liveCorpusRoot,
	liveCorpusSource,
	readCorpusInstructions,
	resolveCorpusFile,
} from "#benchmark/corpus-file";
import { resolveCorpusSource } from "#benchmark/corpus-source";
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
		[
			"rulebook/coding-style.md",
			join(homedir(), ".claude/rulebook/coding-style.md"),
		],
	])("resolves %s onto the install", (layoutPath, expected) => {
		expect(resolveCorpusFile(live, layoutPath)).toBe(expected);
	});

	it("resolves CLAUDE.md onto the install, like every other corpus kind", () => {
		expect(resolveCorpusFile(live, "CLAUDE.md")).toBe(
			join(liveCorpusRoot(), "CLAUDE.md"),
		);
	});

	it("resolves a directory source's CLAUDE.md at the root of corpus layout", () => {
		expect(
			resolveCorpusFile(
				{ kind: "directory", root: "/variants/brief" },
				"CLAUDE.md",
			),
		).toBe("/variants/brief/CLAUDE.md");
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
		const root = await resources.createControlDirectory();
		await Bun.write(join(root, "CLAUDE.md"), "corpus instructions\n");

		const [only] = await hashCorpusFiles(await resolveCorpusSource(root), [
			"CLAUDE.md",
		]);

		expect(only?.path).toBe("CLAUDE.md");
		expect(only?.resolvedPath).toBe(join(root, "CLAUDE.md"));
		expect(only?.sha256).toBe(
			new Bun.CryptoHasher("sha256")
				.update("corpus instructions\n")
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

	it("hashes a declared rulebook file the same way an agents or output-styles file is hashed", async () => {
		const root = await resources.createControlDirectory();
		await Bun.write(
			join(root, "rulebook/coding-style.md"),
			"a rulebook variant\n",
		);
		const source = await resolveCorpusSource(root);

		const [variant] = await hashCorpusFiles(source, [
			"rulebook/coding-style.md",
		]);

		expect(variant?.resolvedPath).toBe(join(root, "rulebook/coding-style.md"));
		expect(variant?.sha256).toBe(
			new Bun.CryptoHasher("sha256")
				.update("a rulebook variant\n")
				.digest("hex"),
		);
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
	it("resolves under the install root, never the control repository", () => {
		expect(resolveCorpusFile(liveCorpusSource(), "CLAUDE.md")).toBe(
			join(liveCorpusRoot(), "CLAUDE.md"),
		);
		expect(resolveCorpusFile(liveCorpusSource(), "CLAUDE.md")).not.toBe(
			join(CONTROL_DIR, "CLAUDE.md"),
		);
	});
});

describe("refusing a corpus file whose bytes are outside its root", () => {
	async function outsideFile(text: string): Promise<string> {
		const outside = await resources.createControlDirectory();
		const path = join(outside, "secret.md");
		await Bun.write(path, text);

		return path;
	}

	it("refuses a CLAUDE.md that is a symlink to a file outside the root", async () => {
		const root = await resources.createControlDirectory();
		const secret = await outsideFile("SECRET BYTES\n");
		await symlink(secret, join(root, "CLAUDE.md"));

		const failure = await failureOf(
			hashCorpusFiles({ kind: "directory", root }, ["CLAUDE.md"]),
		);

		expect(failure).toBeInstanceOf(SymlinkedEntryError);
	});

	it("refuses a declared layout file that is a symlink outside the root", async () => {
		const root = await resources.createControlDirectory();
		const secret = await outsideFile("SECRET BYTES\n");
		await mkdir(join(root, "skills/build"), { recursive: true });
		await symlink(secret, join(root, "skills/build/LINKED.md"));

		const failure = await failureOf(
			hashCorpusFiles({ kind: "directory", root }, ["skills/build/LINKED.md"]),
		);

		expect(failure).toBeInstanceOf(SymlinkedEntryError);
	});

	it("refuses a file reached through a layout directory that is itself a symlink outside the root", async () => {
		const root = await resources.createControlDirectory();
		const outside = await resources.createControlDirectory();
		await mkdir(join(outside, "build"), { recursive: true });
		await Bun.write(join(outside, "build/SKILL.md"), "OUTSIDE SKILL\n");
		await mkdir(join(root, "skills"), { recursive: true });
		await symlink(join(outside, "build"), join(root, "skills/build"));

		const failure = await failureOf(
			hashCorpusFiles({ kind: "directory", root }, ["skills/build/SKILL.md"]),
		);

		expect(failure).toBeInstanceOf(SymlinkedEntryError);
	});

	it("refuses a relative symlink out of the root the same way an absolute one is refused", async () => {
		const root = await resources.createControlDirectory();
		const secret = await outsideFile("SECRET BYTES\n");
		await symlink(relative(root, secret), join(root, "CLAUDE.md"));

		const failure = await failureOf(
			hashCorpusFiles({ kind: "directory", root }, ["CLAUDE.md"]),
		);

		expect(failure).toBeInstanceOf(SymlinkedEntryError);
	});

	it("names the offending file by its layout path, carrying neither the target's path nor its bytes", async () => {
		const root = await resources.createControlDirectory();
		const secret = await outsideFile("SECRET BYTES\n");
		await symlink(secret, join(root, "CLAUDE.md"));

		const failure = await failureOf(
			hashCorpusFiles({ kind: "directory", root }, ["CLAUDE.md"]),
		);

		expect(failure.message).toContain("CLAUDE.md");
		expect(failure.message).not.toContain(secret);
		expect(failure.message).not.toContain("SECRET BYTES");
	});

	it("refuses reading instructions through a symlinked CLAUDE.md", async () => {
		const root = await resources.createControlDirectory();
		const secret = await outsideFile("SECRET BYTES\n");
		await symlink(secret, join(root, "CLAUDE.md"));

		const failure = await failureOf(
			readCorpusInstructions({ kind: "directory", root }),
		);

		expect(failure).toBeInstanceOf(SymlinkedEntryError);
	});

	it("follows a symlink that resolves back inside the root", async () => {
		const root = await resources.createControlDirectory();
		await Bun.write(join(root, "real.md"), "inside bytes\n");
		await symlink(join(root, "real.md"), join(root, "CLAUDE.md"));

		expect(await readCorpusInstructions({ kind: "directory", root })).toBe(
			"inside bytes\n",
		);
	});

	it("refuses a link into a sibling directory whose name extends the root's", async () => {
		const parent = await resources.createControlDirectory();
		const root = join(parent, "corpus");
		await Bun.write(join(root, "real.md"), "inside bytes\n");
		await Bun.write(join(parent, "corpus-evil/secret.md"), "SECRET BYTES\n");
		await symlink(
			join(parent, "corpus-evil/secret.md"),
			join(root, "CLAUDE.md"),
		);

		const failure = await failureOf(
			hashCorpusFiles({ kind: "directory", root }, ["CLAUDE.md"]),
		);

		expect(failure).toBeInstanceOf(SymlinkedEntryError);
	});

	it("reads a root reached through a symlinked parent directory, which resolves the root differently from the way it was named", async () => {
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-corpus-parent-"));
		resources.track(parent);
		const root = join(parent, "corpus");
		await Bun.write(join(root, "CLAUDE.md"), "instructions\n");
		const linkedParent = join(await resources.createControlDirectory(), "link");
		await symlink(parent, linkedParent);

		expect(
			await readCorpusInstructions({
				kind: "directory",
				root: join(linkedParent, "corpus"),
			}),
		).toBe("instructions\n");
	});

	it("follows a symlinked CLAUDE.md when the source is the live install", async () => {
		const root = await resources.createControlDirectory();
		const outside = await resources.createControlDirectory();
		await Bun.write(
			join(outside, "agents.md"),
			"the live corpus instructions\n",
		);
		await symlink(join(outside, "agents.md"), join(root, "CLAUDE.md"));

		expect(await readCorpusInstructions({ kind: "live", root })).toBe(
			"the live corpus instructions\n",
		);
	});
});
