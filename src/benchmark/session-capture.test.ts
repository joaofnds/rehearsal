import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	captureTranscriptPrefix,
	CaptureError,
	projectSlug,
	resolveSessionFile,
} from "#benchmark/session-capture";
import { TestResources } from "#benchmark/test-support";
import { failureOf } from "#cli/cli-test-support";

const testResources = TestResources.forEachTest();

/**
 * A session file lives under a project slug directory, and the source session
 * of a capture may be any of them, so the fixture puts each session under its
 * own slug the way the provider does.
 */
async function projectsDirectory(...names: readonly string[]): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "rehearsal-projects-"));
	testResources.track(directory);
	for (const [index, name] of names.entries()) {
		const slug = join(directory, `-private-tmp-project-${String(index)}`);
		await mkdir(slug, { recursive: true });
		await writeFile(join(slug, `${name}.jsonl`), "{}\n");
	}

	return directory;
}

describe(resolveSessionFile.name, () => {
	const first = "11111111-1111-1111-1111-111111111111";
	const second = "11111111-2222-2222-2222-222222222222";

	it("resolves a prefix that matches exactly one session file", async () => {
		const directory = await projectsDirectory(first, second);

		const resolved = await resolveSessionFile(directory, "11111111-1");

		expect(resolved).toEqual({
			sessionId: first,
			path: join(directory, "-private-tmp-project-0", `${first}.jsonl`),
		});
	});

	it("resolves a full session id", async () => {
		const directory = await projectsDirectory(first, second);

		const resolved = await resolveSessionFile(directory, second);

		expect(resolved.sessionId).toBe(second);
	});

	it("refuses a prefix that matches more than one file, naming both", async () => {
		const directory = await projectsDirectory(first, second);

		expect(resolveSessionFile(directory, "11111111")).rejects.toThrow(
			`Session prefix 11111111 matches 2 session files: ${first}, ${second}`,
		);
	});

	it("names a readable sample and the count when a prefix matches many", async () => {
		const many = Array.from(
			{ length: 12 },
			(_value, index) => `2222222${index}-0000-0000-0000-000000000000`,
		);
		const directory = await projectsDirectory(...many);

		const failure = await failureOf(resolveSessionFile(directory, "2"));

		expect(failure.message).toStartWith(
			"Session prefix 2 matches 12 session files: ",
		);
		expect(failure.message).toEndWith(
			" and 7 more; give more of the session id",
		);
	});

	it("refuses a prefix that matches no file, naming the prefix", async () => {
		const directory = await projectsDirectory(first);

		expect(resolveSessionFile(directory, "deadbeef")).rejects.toThrow(
			"Session prefix deadbeef matches no session file",
		);
	});
});

describe(captureTranscriptPrefix.name, () => {
	async function source(lines: number): Promise<string> {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-source-"));
		testResources.track(directory);
		const path = join(directory, "source.jsonl");
		await writeFile(
			path,
			`${Array.from({ length: lines }, (_value, index) =>
				JSON.stringify({ ordinal: index, filler: "x".repeat(4096) }),
			).join("\n")}\n`,
		);

		return path;
	}

	async function destination(): Promise<string> {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-capture-"));
		testResources.track(directory);

		return join(directory, "prefix.jsonl");
	}

	it("writes exactly the source's first cut lines", async () => {
		const path = await source(5);
		const target = await destination();

		await captureTranscriptPrefix(path, target, 3);

		const written = await Bun.file(target).text();
		const original = await Bun.file(path).text();
		expect(written).toBe(`${original.split("\n").slice(0, 3).join("\n")}\n`);
	});

	it("writes a prefix byte-identical to the source's first lines when the source exceeds one read buffer", async () => {
		const path = await source(400);
		const target = await destination();

		await captureTranscriptPrefix(path, target, 399);

		const written = await Bun.file(target).text();
		const original = await Bun.file(path).text();
		expect(written.length).toBeGreaterThan(1024 * 1024);
		expect(written).toBe(`${original.split("\n").slice(0, 399).join("\n")}\n`);
	});

	/**
	 * A bound relative to the source passes for a subject that never streams at
	 * all, because an observer that is never called leaves the widest carry at
	 * zero. The bound is absolute and the call count is asserted, so reading the
	 * source as one string fails on both counts.
	 */
	const ONE_CHUNK_AND_A_LINE = 768 * 1024;

	it("never holds the whole source, only one read chunk and a partial line", async () => {
		const path = await source(400);
		const sourceBytes = Bun.file(path).size;
		let widest = 0;
		let observations = 0;

		await captureTranscriptPrefix(path, await destination(), 399, {
			carry: (characters) => {
				observations += 1;
				widest = Math.max(widest, characters);
			},
		});

		expect(sourceBytes).toBeGreaterThan(1024 * 1024);
		expect(observations).toBeGreaterThan(1);
		expect(widest).toBeLessThan(ONE_CHUNK_AND_A_LINE);
	});

	it("returns the digest of the bytes it wrote", async () => {
		const path = await source(4);
		const target = await destination();

		const result = await captureTranscriptPrefix(path, target, 2);

		expect(result.sha256).toBe(
			new Bun.CryptoHasher("sha256")
				.update(await Bun.file(target).bytes())
				.digest("hex"),
		);
	});

	it.each([0, -1])(
		"refuses a cut of %p, naming the index and the line count",
		async (cut) => {
			const path = await source(4);

			expect(
				captureTranscriptPrefix(path, await destination(), cut),
			).rejects.toThrow(`Cut ${String(cut)} is outside the source's 4 lines`);
		},
	);

	it("refuses a cut past the source's line count, naming both", async () => {
		const path = await source(4);

		expect(
			captureTranscriptPrefix(path, await destination(), 5),
		).rejects.toThrow("Cut 5 is outside the source's 4 lines");
	});

	it("writes nothing when it refuses the cut", async () => {
		const path = await source(4);
		const target = await destination();

		const failure = await failureOf(captureTranscriptPrefix(path, target, 99));
		const exists = await Bun.file(target).exists();

		expect(failure).toBeInstanceOf(CaptureError);
		expect(exists).toBe(false);
	});

	it("refuses with a CaptureError so the CLI can map it to an exit code", async () => {
		const path = await source(2);

		expect(
			captureTranscriptPrefix(path, await destination(), 0),
		).rejects.toBeInstanceOf(CaptureError);
	});
});

describe(projectSlug.name, () => {
	it("replaces every path separator with a dash", () => {
		expect(projectSlug("/private/tmp/x")).toBe("-private-tmp-x");
	});

	it("names a path through the /tmp symlink differently from its real path", async () => {
		const real = await realpath("/tmp");

		expect(projectSlug(real)).not.toBe(projectSlug("/tmp"));
		expect(projectSlug(`${real}/x`)).toBe(`${real.replaceAll("/", "-")}-x`);
	});
});
