import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveCorpusFile } from "#benchmark/corpus-file";
import { resolveCorpusSource } from "#benchmark/corpus-source";
import { TestResources } from "#benchmark/test-support";

const resources = TestResources.forEachTest();

async function directoryCorpus(): Promise<string> {
	const root = await resources.createControlDirectory();
	await Bun.write(join(root, "output-styles/brief.md"), "variant\n");

	return root;
}

describe(resolveCorpusSource.name, () => {
	it("resolves a directory source to a directory-kind source rooted there", async () => {
		const root = await directoryCorpus();

		const source = await resolveCorpusSource(root);

		expect(source.kind).toBe("directory");
		expect(source.root).toBe(root);
	});

	it("resolves an absent source to the live install", async () => {
		const source = await resolveCorpusSource(undefined);

		expect(source.kind).toBe("live");
		expect(source.root).toBe(join(homedir(), ".claude"));
	});
});

describe("resolving a corpus file against a source", () => {
	it("reads a layout path from the directory source's root", async () => {
		const root = await directoryCorpus();

		expect(
			resolveCorpusFile(
				await resolveCorpusSource(root),
				"output-styles/brief.md",
			),
		).toBe(join(root, "output-styles/brief.md"));
	});

	it("reads a layout path from the live install when the source is live", async () => {
		expect(
			resolveCorpusFile(
				await resolveCorpusSource(undefined),
				"output-styles/brief.md",
			),
		).toBe(join(homedir(), ".claude/output-styles/brief.md"));
	});
});
