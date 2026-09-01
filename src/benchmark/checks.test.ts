import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
	captureBaselineContext,
	captureCheckIntegrity,
	captureFileHashes,
} from "./checks";
import { runCommand } from "./command";
import { MAX_CONTEXT_FILE_BYTES } from "./config";
import { captureBuildCandidate } from "./target";
import { TestResources, commitAll } from "./test-support";

const testResources = TestResources.forEachTest();

describe(captureCheckIntegrity.name, () => {
	it("fails when a candidate weakens a check definition", async () => {
		const source = await testResources.createRepository();
		const baselineHashes = await captureFileHashes(source.directory);
		await Bun.write(
			join(source.directory, "package.json"),
			'{"scripts":{"typecheck":"true","check":"true","test:unit":"true"}}\n',
		);

		const result = await captureCheckIntegrity(
			source.directory,
			baselineHashes,
		);

		expect(result.status).toBe("FAIL");
		expect(result.evidence[0]?.claim).toContain("package.json");
	});
});

describe(captureBuildCandidate.name, () => {
	it("freezes untracked Build files", async () => {
		const source = await testResources.createRepository();
		await Bun.write(
			join(source.directory, "uncommitted.ts"),
			"export const uncommitted = true;\n",
		);

		const candidate = await captureBuildCandidate(source.directory, source.sha);

		expect(candidate.changedPaths).toContain("uncommitted.ts");
		expect(candidate.diff).toContain("export const uncommitted = true;");
	});

	it("omits untracked content beyond the capture limit", async () => {
		const source = await testResources.createRepository();
		await Bun.write(
			join(source.directory, "huge.log"),
			"y".repeat(MAX_CONTEXT_FILE_BYTES + 1),
		);

		const candidate = await captureBuildCandidate(source.directory, source.sha);

		expect(candidate.changedPaths).toContain("huge.log");
		expect(candidate.diff).toContain("bytes omitted");
		expect(candidate.diff).not.toContain("yyyy");
	});

	it("summarizes committed binary changes instead of embedding them", async () => {
		const source = await testResources.createRepository();
		await Bun.write(
			join(source.directory, "asset.bin"),
			new Uint8Array([137, 80, 78, 71, 0, 13, 10, 26]),
		);
		await commitAll(source.directory, "feat: add binary asset");

		const candidate = await captureBuildCandidate(source.directory, source.sha);

		expect(candidate.diff).toContain("Binary files");
		expect(candidate.diff).not.toContain("GIT binary patch");
	});
});

describe(captureBaselineContext.name, () => {
	it("captures every tracked file except the lockfile", async () => {
		const source = await testResources.createRepository();

		const tracked = await runCommand(["git", "ls-files"], source.directory);
		const context = await captureBaselineContext(source.directory);

		expect(tracked).toContain("bun.lock");
		expect(context.map(({ path }) => path).toSorted()).toEqual([
			"base.txt",
			"package.json",
		]);
	});

	it("replaces files beyond the per-file capture limit with an omission marker", async () => {
		const source = await testResources.createRepository();
		await Bun.write(
			join(source.directory, "huge.txt"),
			"x".repeat(MAX_CONTEXT_FILE_BYTES + 1),
		);
		await commitAll(source.directory, "chore: huge file");

		const context = await captureBaselineContext(source.directory);
		const huge = context.find(({ path }) => path === "huge.txt");

		expect(huge?.content).toContain("bytes omitted");
		expect(huge?.content).not.toContain("xxxx");
	});

	it("replaces binary files with a binary marker", async () => {
		const source = await testResources.createRepository();
		await Bun.write(
			join(source.directory, "image.bin"),
			new Uint8Array([137, 80, 78, 71, 0, 13, 10, 26]),
		);
		await commitAll(source.directory, "chore: binary file");

		const context = await captureBaselineContext(source.directory);
		const binary = context.find(({ path }) => path === "image.bin");

		expect(binary?.content).toBe("[binary file omitted]");
	});
});
