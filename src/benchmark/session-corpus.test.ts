import { describe, expect, it } from "bun:test";
import { mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";
import { PROJECT_INSTRUCTIONS_PATH } from "#benchmark/config";
import { hashCorpusFiles } from "#benchmark/corpus-file";
import type { ChezmoiCorpusSource } from "#benchmark/corpus-source";
import { resolveCorpusSource } from "#benchmark/corpus-source";
import {
	SessionCorpusError,
	installSessionCorpusSnapshot,
	snapshotSessionCorpus,
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
		);

		const before = await hashCorpusFiles(snapshot, ["output-styles/brief.md"]);
		await Bun.write(join(root, "output-styles/brief.md"), "edited after\n");
		const after = await hashCorpusFiles(snapshot, ["output-styles/brief.md"]);

		expect(after[0]?.sha256).toBe(before[0]?.sha256 ?? "");
		expect(after[0]?.sha256).toBe(sha256Of("variant brief\n"));
	});

	it("gives a chezmoi source the control root's CLAUDE.md, which it carries none of", async () => {
		const rendered = await resources.createControlDirectory();
		await Bun.write(
			join(rendered, ".claude/output-styles/brief.md"),
			"rendered brief\n",
		);
		const destination = await resources.createControlDirectory();
		const source: ChezmoiCorpusSource = {
			kind: "chezmoi",
			ref: "HEAD",
			commit: "abc123",
			root: rendered,
			sourceDirectory: rendered,
		};

		const snapshot = await snapshotSessionCorpus(
			source,
			join(destination, "corpus"),
		);

		expect(await Bun.file(join(snapshot.root, "CLAUDE.md")).bytes()).toEqual(
			await Bun.file(PROJECT_INSTRUCTIONS_PATH).bytes(),
		);
	});

	it("records the chezmoi source's resolved commit on the snapshot", async () => {
		const rendered = await resources.createControlDirectory();
		await Bun.write(
			join(rendered, ".claude/output-styles/brief.md"),
			"rendered brief\n",
		);
		const destination = await resources.createControlDirectory();

		const snapshot = await snapshotSessionCorpus(
			{
				kind: "chezmoi",
				ref: "HEAD",
				commit: "abc123",
				root: rendered,
				sourceDirectory: rendered,
			},
			join(destination, "corpus"),
		);

		expect(snapshot.origin).toEqual({
			kind: "chezmoi",
			ref: "HEAD",
			commit: "abc123",
		});
	});

	it("refuses a source whose skill bytes differ from the live install, naming the skill and ACT-28", async () => {
		const root = await directoryCorpus({
			"skills/style/SKILL.md": "a variant skill the harness cannot deliver\n",
		});
		const destination = await resources.createControlDirectory();

		const failure = await failureOf(
			snapshotSessionCorpus(
				await resolveCorpusSource(root),
				join(destination, "corpus"),
			),
		);

		expect(failure).toBeInstanceOf(SessionCorpusError);
		expect(failure.message).toContain("skills/style");
		expect(failure.message).toContain("ACT-28");
	});

	it("never reads through a .claude symlink in a rendered tree", async () => {
		const rendered = await resources.createControlDirectory();
		const live = await directoryCorpus({
			"style/SKILL.md": "the live skill\n",
		});
		await Bun.write(
			join(rendered, ".claude/output-styles/brief.md"),
			"rendered brief\n",
		);
		await mkdir(join(rendered, ".claude"), { recursive: true });
		await symlink(live, join(rendered, ".claude/skills"));
		const destination = await resources.createControlDirectory();

		const snapshot = await snapshotSessionCorpus(
			{
				kind: "chezmoi",
				ref: "HEAD",
				commit: "abc123",
				root: rendered,
				sourceDirectory: rendered,
			},
			join(destination, "corpus"),
		);

		expect(
			await Bun.file(join(snapshot.root, "skills/style/SKILL.md")).exists(),
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

	it("installs nothing for a live source, whose files the session already reads", async () => {
		const destination = await resources.createControlDirectory();
		const snapshot = await snapshotSessionCorpus(
			await resolveCorpusSource(undefined),
			join(destination, "corpus"),
		);
		const attemptDirectory = await resources.createControlDirectory();

		await installSessionCorpusSnapshot(snapshot, attemptDirectory);

		expect(await Bun.file(join(attemptDirectory, ".claude")).exists()).toBe(
			false,
		);
	});
});
