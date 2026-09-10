import { describe, expect, it } from "bun:test";
import { mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";
import { hashCorpusFiles } from "#benchmark/corpus-file";
import { resolveCorpusSource } from "#benchmark/corpus-source";
import type { SessionCorpusSnapshot } from "#benchmark/session-corpus";
import {
	freezeSessionCorpus,
	SessionCorpusError,
	installSessionCorpusSnapshot,
	snapshotSessionCorpus,
	snapshotStyleName,
} from "#benchmark/session-corpus";
import { TestResources } from "#benchmark/test-support";
import { failureOf } from "#cli/cli-test-support";

const resources = TestResources.forEachTest();

async function directoryCorpus(
	files: Readonly<Record<string, string>>,
): Promise<string> {
	const root = await resources.createControlDirectory();
	for (const [layoutPath, contents] of Object.entries(files)) {
		await Bun.write(join(root, layoutPath), contents);
	}

	return root;
}

function sha256Of(contents: string): string {
	return new Bun.CryptoHasher("sha256").update(contents).digest("hex");
}

describe(snapshotSessionCorpus.name, () => {
	it("copies the source's corpus kinds into the snapshot directory", async () => {
		const root = await directoryCorpus({
			"output-styles/brief.md": "variant brief\n",
			"agents/reviewer.md": "variant reviewer\n",
			"CLAUDE.md": "variant instructions\n",
		});
		const destination = await resources.createControlDirectory();

		const snapshot = await snapshotSessionCorpus(
			await resolveCorpusSource(root),
			join(destination, "corpus"),
			["output-styles/brief.md", "agents/reviewer.md", "CLAUDE.md"],
		);

		expect(
			await Bun.file(join(snapshot.root, "output-styles/brief.md")).text(),
		).toBe("variant brief\n");
		expect(
			await Bun.file(join(snapshot.root, "agents/reviewer.md")).text(),
		).toBe("variant reviewer\n");
		expect(await Bun.file(join(snapshot.root, "CLAUDE.md")).text()).toBe(
			"variant instructions\n",
		);
	});

	it("is the single place bytes are read from: mutating the source after the snapshot leaves the digests unchanged", async () => {
		const root = await directoryCorpus({
			"output-styles/brief.md": "variant brief\n",
		});
		const destination = await resources.createControlDirectory();
		const snapshot = await snapshotSessionCorpus(
			await resolveCorpusSource(root),
			join(destination, "corpus"),
			["output-styles/brief.md"],
		);

		const before = await hashCorpusFiles(snapshot, ["output-styles/brief.md"]);
		await Bun.write(join(root, "output-styles/brief.md"), "edited after\n");
		const after = await hashCorpusFiles(snapshot, ["output-styles/brief.md"]);

		expect(after[0]?.sha256).toBe(before[0]?.sha256 ?? "");
		expect(after[0]?.sha256).toBe(sha256Of("variant brief\n"));
	});

	it("refuses a declared skill the harness cannot deliver, naming the skill and ACT-28", async () => {
		const root = await directoryCorpus({
			"skills/style/SKILL.md": "a variant skill the harness cannot deliver\n",
		});
		const destination = await resources.createControlDirectory();

		const failure = await failureOf(
			snapshotSessionCorpus(
				await resolveCorpusSource(root),
				join(destination, "corpus"),
				["skills/style/SKILL.md"],
			),
		);

		expect(failure).toBeInstanceOf(SessionCorpusError);
		expect(failure.message).toContain("skills/style/SKILL.md");
		expect(failure.message).toContain("ACT-28");
	});

	/**
	 * A corpus source carries every skill in the corpus, and refusing on their
	 * presence would make a source unusable for the styles and agents the harness
	 * can deliver. What must not happen is reporting a skill result, and a skill
	 * the case does not declare is never reported.
	 */
	it("carries a skill the case does not declare without refusing, and installs none of it", async () => {
		const root = await directoryCorpus({
			"skills/style/SKILL.md": "a skill nothing declares\n",
			"output-styles/brief.md": "variant brief\n",
		});
		const destination = await resources.createControlDirectory();

		const snapshot = await snapshotSessionCorpus(
			await resolveCorpusSource(root),
			join(destination, "corpus"),
			["output-styles/brief.md"],
		);
		const attemptDirectory = await resources.createControlDirectory();
		await installSessionCorpusSnapshot(snapshot, attemptDirectory);

		expect(
			await Bun.file(join(attemptDirectory, ".claude/skills")).exists(),
		).toBe(false);
	});

	/**
	 * A recursive copy dereferences, so a symlinked corpus entry pulls in bytes
	 * from outside the source: the harness would hash and install whatever the
	 * link points at while the record says it snapshotted a source. Refusing is
	 * the precedent ACT-26.5 set for a fixture holding a symlink.
	 */
	it("refuses a symlinked corpus entry, naming the entry", async () => {
		const outside = await directoryCorpus({
			"output-styles/brief.md": "the live style\n",
		});
		const root = await resources.createControlDirectory();
		await mkdir(join(root, "output-styles"), { recursive: true });
		await symlink(
			join(outside, "output-styles/brief.md"),
			join(root, "output-styles/evil.md"),
		);
		const destination = await resources.createControlDirectory();

		const failure = await failureOf(
			snapshotSessionCorpus(
				await resolveCorpusSource(root),
				join(destination, "corpus"),
				["output-styles/evil.md"],
			),
		);

		expect(failure).toBeInstanceOf(SessionCorpusError);
		expect(failure.message).toContain("output-styles/evil.md");
	});

	it("refuses a symlink inside a declared skill directory", async () => {
		const outside = await directoryCorpus({ "secret.md": "outside bytes\n" });
		const root = await resources.createControlDirectory();
		await mkdir(join(root, "output-styles"), { recursive: true });
		await Bun.write(join(root, "agents/reviewer.md"), "an agent\n");
		await mkdir(join(root, "output-styles/nested"), { recursive: true });
		await symlink(
			join(outside, "secret.md"),
			join(root, "output-styles/nested/leak.md"),
		);
		const destination = await resources.createControlDirectory();

		const failure = await failureOf(
			snapshotSessionCorpus(
				await resolveCorpusSource(root),
				join(destination, "corpus"),
				["output-styles/nested"],
			),
		);

		expect(failure).toBeInstanceOf(SessionCorpusError);
		expect(failure.message).toContain("leak.md");
	});

	it("refuses a declared file reached through a layout directory that is itself a symlink", async () => {
		const outside = await resources.createControlDirectory();
		await Bun.write(join(outside, "agents/reviewer.md"), "OUTSIDE AGENT\n");
		const root = await resources.createControlDirectory();
		await Bun.write(join(root, "CLAUDE.md"), "variant instructions\n");
		await symlink(join(outside, "agents"), join(root, "agents"));
		const destination = await resources.createControlDirectory();

		const failure = await failureOf(
			snapshotSessionCorpus(
				await resolveCorpusSource(root),
				join(destination, "corpus"),
				["agents/reviewer.md"],
			),
		);

		expect(failure).toBeInstanceOf(SessionCorpusError);
		expect(failure.message).toContain("agents/reviewer.md");
		expect(failure.message).not.toContain("OUTSIDE AGENT");
	});
});

describe(freezeSessionCorpus.name, () => {
	it("materializes symlink-backed live entries as immutable group bytes", async () => {
		const outside = await directoryCorpus({
			"agents/reviewer.md": "original live agent\n",
		});
		const liveRoot = await resources.createControlDirectory();
		await symlink(join(outside, "agents"), join(liveRoot, "agents"));
		const destination = await resources.createControlDirectory();

		const snapshot = await freezeSessionCorpus(
			{ kind: "live", root: liveRoot, backingRoot: outside },
			join(destination, "corpus"),
			["agents/reviewer.md"],
		);
		await Bun.write(
			join(outside, "agents", "reviewer.md"),
			"mutated live agent\n",
		);

		expect(
			await Bun.file(join(snapshot.root, "agents", "reviewer.md")).text(),
		).toBe("original live agent\n");
	});

	it("refuses a live declared file outside the install and backing tree before copying it", async () => {
		const outside = await directoryCorpus({
			"output-styles/foreign.md": "FOREIGN STYLE\n",
		});
		const liveRoot = await resources.createControlDirectory();
		const backingRoot = await resources.createControlDirectory();
		await mkdir(join(liveRoot, "output-styles"), { recursive: true });
		await symlink(
			join(outside, "output-styles", "foreign.md"),
			join(liveRoot, "output-styles", "foreign.md"),
		);
		const destination = join(
			await resources.createControlDirectory(),
			"corpus",
		);

		const failure = await failureOf(
			freezeSessionCorpus(
				{ kind: "live", root: liveRoot, backingRoot },
				destination,
				["output-styles/foreign.md"],
			),
		);

		expect(failure).toBeInstanceOf(SessionCorpusError);
		expect(failure.message).toContain("output-styles/foreign.md");
		expect(
			await Bun.file(join(destination, "output-styles", "foreign.md")).exists(),
		).toBe(false);
	});
});

describe("selecting the style and scoping the overlay to what the case declared", () => {
	async function twoStyleSnapshot(
		declaredPaths: readonly string[],
	): Promise<SessionCorpusSnapshot> {
		const root = await directoryCorpus({
			"output-styles/aardvark.md": "an undeclared style\n",
			"output-styles/brief.md": "the declared style\n",
			"agents/rogue.md": "an undeclared agent\n",
		});
		const destination = await resources.createControlDirectory();

		return snapshotSessionCorpus(
			await resolveCorpusSource(root),
			join(destination, "corpus"),
			declaredPaths,
		);
	}

	/**
	 * Alphabetical order picked the style before, so a corpus holding a second
	 * style ran the attempt against one the case never named while recording the
	 * declared one's digest in lineage.
	 */
	it("selects the style the case declared, not the first one in the snapshot", async () => {
		const snapshot = await twoStyleSnapshot(["output-styles/brief.md"]);

		expect(snapshotStyleName(snapshot)).toBe("brief");
	});

	it("selects no style when the case declares none", async () => {
		const snapshot = await twoStyleSnapshot(["agents/reviewer.md"]);

		expect(snapshotStyleName(snapshot)).toBeUndefined();
	});

	/**
	 * The selection rule has to hold on the snapshot alone: a snapshot can carry
	 * a style the case did not declare, and alphabetical order would pick that
	 * one while lineage recorded the declared style's digest.
	 */
	it("selects the declared style from a snapshot holding one that sorts before it", async () => {
		const root = await directoryCorpus({
			"output-styles/aardvark.md": "an undeclared style\n",
			"output-styles/brief.md": "the declared style\n",
		});

		expect(
			snapshotStyleName({
				kind: "directory",
				root,
				origin: { kind: "directory", source: root },
				declaredPaths: ["output-styles/brief.md"],
			}),
		).toBe("brief");
	});

	it("installs only the files the case declared", async () => {
		const snapshot = await twoStyleSnapshot(["output-styles/brief.md"]);
		const attemptDirectory = await resources.createControlDirectory();

		await installSessionCorpusSnapshot(snapshot, attemptDirectory);

		expect(
			await Bun.file(
				join(attemptDirectory, ".claude/output-styles/brief.md"),
			).text(),
		).toBe("the declared style\n");
		expect(
			await Bun.file(
				join(attemptDirectory, ".claude/output-styles/aardvark.md"),
			).exists(),
		).toBe(false);
		expect(
			await Bun.file(
				join(attemptDirectory, ".claude/agents/rogue.md"),
			).exists(),
		).toBe(false);
	});

	/**
	 * The overlay's scope has to hold on the snapshot alone: what reaches the
	 * session is what the case declared, not everything the snapshot directory
	 * happens to carry.
	 */
	it("installs the declared file from a snapshot carrying an undeclared one", async () => {
		const root = await directoryCorpus({
			"output-styles/aardvark.md": "an undeclared style\n",
			"output-styles/brief.md": "the declared style\n",
			"agents/rogue.md": "an undeclared agent\n",
		});
		const attemptDirectory = await resources.createControlDirectory();

		await installSessionCorpusSnapshot(
			{
				kind: "directory",
				root,
				origin: { kind: "directory", source: root },
				declaredPaths: ["output-styles/brief.md"],
			},
			attemptDirectory,
		);

		expect(
			await Bun.file(
				join(attemptDirectory, ".claude/output-styles/brief.md"),
			).text(),
		).toBe("the declared style\n");
		expect(
			await Bun.file(
				join(attemptDirectory, ".claude/output-styles/aardvark.md"),
			).exists(),
		).toBe(false);
		expect(
			await Bun.file(
				join(attemptDirectory, ".claude/agents/rogue.md"),
			).exists(),
		).toBe(false);
	});

	it("snapshots only the files the case declared", async () => {
		const snapshot = await twoStyleSnapshot(["output-styles/brief.md"]);

		expect(
			await Bun.file(join(snapshot.root, "output-styles/aardvark.md")).exists(),
		).toBe(false);
		expect(
			await Bun.file(join(snapshot.root, "agents/rogue.md")).exists(),
		).toBe(false);
	});
});

describe(installSessionCorpusSnapshot.name, () => {
	it("writes the snapshot's output styles and agents under the attempt's .claude", async () => {
		const root = await directoryCorpus({
			"output-styles/brief.md": "variant brief\n",
			"agents/reviewer.md": "variant reviewer\n",
		});
		const destination = await resources.createControlDirectory();
		const snapshot = await snapshotSessionCorpus(
			await resolveCorpusSource(root),
			join(destination, "corpus"),
			["output-styles/brief.md", "agents/reviewer.md"],
		);
		const attemptDirectory = await resources.createControlDirectory();

		await installSessionCorpusSnapshot(snapshot, attemptDirectory);

		expect(
			await Bun.file(
				join(attemptDirectory, ".claude/output-styles/brief.md"),
			).text(),
		).toBe("variant brief\n");
		expect(
			await Bun.file(
				join(attemptDirectory, ".claude/agents/reviewer.md"),
			).text(),
		).toBe("variant reviewer\n");
	});

	it("writes the snapshot's declared rulebook file under the attempt's .claude", async () => {
		const root = await directoryCorpus({
			"rulebook/coding-style.md": "variant coding style\n",
		});
		const destination = await resources.createControlDirectory();
		const snapshot = await snapshotSessionCorpus(
			await resolveCorpusSource(root),
			join(destination, "corpus"),
			["rulebook/coding-style.md"],
		);
		const attemptDirectory = await resources.createControlDirectory();

		await installSessionCorpusSnapshot(snapshot, attemptDirectory);

		expect(
			await Bun.file(
				join(attemptDirectory, ".claude/rulebook/coding-style.md"),
			).text(),
		).toBe("variant coding style\n");
	});

	it("installs nothing for a live source, whose files the session already reads", async () => {
		const destination = await resources.createControlDirectory();
		const snapshot = await snapshotSessionCorpus(
			await resolveCorpusSource(undefined),
			join(destination, "corpus"),
			[],
		);
		const attemptDirectory = await resources.createControlDirectory();

		await installSessionCorpusSnapshot(snapshot, attemptDirectory);

		expect(await Bun.file(join(attemptDirectory, ".claude")).exists()).toBe(
			false,
		);
	});
});
