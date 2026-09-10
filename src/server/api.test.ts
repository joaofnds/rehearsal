import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
	directorySource,
	RecordedRunsFixture,
} from "#benchmark/run-records-test-support";
import { CONTROL_DIR } from "#benchmark/config";
import { runEventsDatabaseFile } from "#benchmark/run-layout";
import { openRunEventStore } from "#benchmark/run-events";
import { createApiApp } from "./api";

const runEventSchema = z.object({ kind: z.string() }).loose();

function parseSSEFrames(
	body: string,
): readonly z.infer<typeof runEventSchema>[] {
	return body
		.split("\n\n")
		.filter((frame) => frame.length > 0)
		.map((frame) =>
			runEventSchema.parse(
				JSON.parse(
					frame
						.split("\n")
						.filter((line) => line.startsWith("data:"))
						.map((line) => line.slice("data:".length).trim())
						.join("\n"),
				),
			),
		);
}

const corpusResponseSchema = z.object({
	root: z.string(),
	digest: z.string().optional(),
	files: z.array(z.object({ path: z.string() }).loose()),
	refusals: z.array(z.string()),
});

const runHistoryRowSchema = z
	.object({ run: z.string(), stale: z.boolean() })
	.loose();
const runHistoryResponseSchema = z.object({
	rows: z.array(runHistoryRowSchema),
	unreadable: z.array(z.object({ id: z.string(), reason: z.string() })),
});

async function runHistoryResponseFrom(
	response: Response,
): Promise<z.infer<typeof runHistoryResponseSchema>> {
	return runHistoryResponseSchema.parse(await response.json());
}

/**
 * A response body does not carry the concrete path the test planted. Naming
 * that value rather than re-deriving the redactor's pattern is what keeps the
 * check honest: a detector built from the redactor's own logic agrees with the
 * redactor even where the redactor is wrong.
 */
function assertDoesNotLeak(body: string, secret: string): void {
	expect(body).not.toContain(secret);
}

describe(createApiApp.name, () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
		);
	});

	async function emptyDirectory(prefix: string): Promise<string> {
		const root = await mkdtemp(join(tmpdir(), prefix));
		roots.push(root);

		return root;
	}

	async function corpusDirectory(): Promise<string> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-api-corpus-"));
		roots.push(root);
		await mkdir(join(root, "skills", "build"), { recursive: true });
		await mkdir(join(root, "skills", "discuss"), { recursive: true });
		await Bun.write(join(root, "CLAUDE.md"), "the instructions\n");
		await Bun.write(join(root, "skills", "build", "SKILL.md"), "build skill\n");
		await Bun.write(
			join(root, "skills", "discuss", "SKILL.md"),
			"discuss skill\n",
		);

		return root;
	}

	async function writtenFixture(): Promise<RecordedRunsFixture> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-api-"));
		roots.push(root);
		const fixture = new RecordedRunsFixture(root);
		await fixture.write();

		return fixture;
	}

	describe("GET /api/runs", () => {
		it("renders every recorded run as a row", async () => {
			const fixture = await writtenFixture();
			const corpus = await corpusDirectory();
			await fixture.recordCorpusFrom(directorySource(corpus));
			const app = createApiApp({
				runsDirectory: fixture.runsDirectory,
				corpusSource: directorySource(corpus),
			});

			const response = await app.request("/api/runs");
			const body = await runHistoryResponseFrom(response);

			expect(response.status).toBe(200);
			expect(body.rows.some((row) => row.run === fixture.replayableRun)).toBe(
				true,
			);
		});

		it("renders an empty runs directory as no rows, not an error", async () => {
			const root = await mkdtemp(join(tmpdir(), "rehearsal-api-empty-"));
			roots.push(root);
			const app = createApiApp({
				runsDirectory: root,
				corpusSource: directorySource(await corpusDirectory()),
			});

			const response = await app.request("/api/runs");
			const body = await runHistoryResponseFrom(response);

			expect(response.status).toBe(200);
			expect(body.rows).toEqual([]);
		});

		it("recomputes staleness fresh on every request rather than caching it", async () => {
			const fixture = await writtenFixture();
			const corpus = await corpusDirectory();
			await fixture.recordCorpusFrom(directorySource(corpus));
			const app = createApiApp({
				runsDirectory: fixture.runsDirectory,
				corpusSource: directorySource(corpus),
			});

			const firstResponse = await app.request("/api/runs");
			const first = await runHistoryResponseFrom(firstResponse);
			await Bun.write(
				join(corpus, "skills", "build", "SKILL.md"),
				"build skill, edited\n",
			);
			const secondResponse = await app.request("/api/runs");
			const second = await runHistoryResponseFrom(secondResponse);

			const firstRow = first.rows.find(
				(row) => row.run === fixture.replayableRun,
			);
			const secondRow = second.rows.find(
				(row) => row.run === fixture.replayableRun,
			);
			expect(firstRow?.stale).toBe(false);
			expect(secondRow?.stale).toBe(true);
		});
	});

	describe("GET /api/corpus", () => {
		it("renders the corpus root unredacted, since the operator declared it and the server is theirs", async () => {
			const corpus = await corpusDirectory();
			const runsDirectory = await mkdtemp(
				join(tmpdir(), "rehearsal-api-runs-"),
			);
			roots.push(runsDirectory);
			const app = createApiApp({
				runsDirectory,
				corpusSource: directorySource(corpus),
			});

			const response = await app.request("/api/corpus");
			const body: unknown = await response.json();

			expect(response.status).toBe(200);
			expect(body).toMatchObject({ root: corpus });
		});

		it("serves the files it could hash and names the refusal, rather than failing the screen over one entry", async () => {
			const corpus = await corpusDirectory();
			const outside = await emptyDirectory("rehearsal-api-outside-");
			await writeFile(join(outside, "secret.md"), "secret bytes\n");
			await mkdir(join(corpus, "agents"), { recursive: true });
			await symlink(
				join(outside, "secret.md"),
				join(corpus, "agents", "escape.md"),
			);
			const app = createApiApp({
				runsDirectory: await emptyDirectory("rehearsal-api-runs-"),
				corpusSource: directorySource(corpus),
			});

			const response = await app.request("/api/corpus");
			const text = await response.text();
			const body = corpusResponseSchema.parse(JSON.parse(text));

			expect(response.status).toBe(200);
			expect(body.files.map(({ path }) => path)).toEqual([
				"CLAUDE.md",
				"skills/build/SKILL.md",
				"skills/discuss/SKILL.md",
			]);
			expect(body.refusals).toEqual([
				"agents/escape.md resolves outside the tree it is named under, so its bytes are not the ones that tree holds",
			]);
			expect(body.digest).toBeUndefined();
		});

		it("names CLAUDE.md as a refusal when it is itself a link out of the tree, rather than failing the screen", async () => {
			const corpus = await emptyDirectory("rehearsal-api-corpus-");
			const outside = await emptyDirectory("rehearsal-api-outside-");
			await writeFile(join(outside, "secret.md"), "secret bytes\n");
			await symlink(join(outside, "secret.md"), join(corpus, "CLAUDE.md"));
			const app = createApiApp({
				runsDirectory: await emptyDirectory("rehearsal-api-runs-"),
				corpusSource: directorySource(corpus),
			});

			const response = await app.request("/api/corpus");
			const text = await response.text();
			const body = corpusResponseSchema.parse(JSON.parse(text));

			expect(response.status).toBe(200);
			expect(body.refusals).toEqual([
				"Corpus file CLAUDE.md resolves outside the corpus source, which would hash bytes the corpus does not hold",
			]);
			expect(body.files).toEqual([]);
			expect(body.digest).toBeUndefined();
		});

		it("serves a live corpus with an out-of-extent instruction file as a partial report", async () => {
			const corpus = await corpusDirectory();
			const backingRoot = await emptyDirectory("rehearsal-api-backing-");
			const outside = await emptyDirectory("rehearsal-api-outside-");
			await rm(join(corpus, "CLAUDE.md"));
			await writeFile(join(outside, "secret.md"), "SECRET BYTES\n");
			await symlink(join(outside, "secret.md"), join(corpus, "CLAUDE.md"));
			const app = createApiApp({
				runsDirectory: await emptyDirectory("rehearsal-api-runs-"),
				corpusSource: { kind: "live", root: corpus, backingRoot },
			});

			const response = await app.request("/api/corpus");
			const text = await response.text();
			const body = corpusResponseSchema.parse(JSON.parse(text));

			expect(response.status).toBe(200);
			expect(body.files.map(({ path }) => path)).toEqual([
				"skills/build/SKILL.md",
				"skills/discuss/SKILL.md",
			]);
			expect(body.refusals).toEqual([
				"Corpus file CLAUDE.md resolves outside the live corpus extent, which would hash bytes the corpus does not hold",
			]);
			expect(body.digest).toBeUndefined();
			expect(text).not.toContain("SECRET BYTES");
			expect(text).not.toContain(outside);
		});
	});

	describe("GET /api/records/:id", () => {
		it("refuses a record id whose segment escapes the runs directory, without a 500", async () => {
			const fixture = await writtenFixture();
			const app = createApiApp({
				runsDirectory: fixture.runsDirectory,
				corpusSource: directorySource(await corpusDirectory()),
			});

			const response = await app.request(
				`/api/records/${encodeURIComponent("checkpoint:../../etc/passwd/shape")}`,
			);

			expect(response.status).toBeGreaterThanOrEqual(400);
			expect(response.status).toBeLessThan(500);
		});

		it("names no absolute filesystem path in a refusal body", async () => {
			const fixture = await writtenFixture();
			const app = createApiApp({
				runsDirectory: fixture.runsDirectory,
				corpusSource: directorySource(await corpusDirectory()),
			});

			const response = await app.request(
				`/api/records/${encodeURIComponent("run:no-such-run")}`,
			);
			const body = await response.text();

			expect(response.status).toBeGreaterThanOrEqual(400);
			expect(response.status).toBeLessThan(500);
			assertDoesNotLeak(body, fixture.runsDirectory);
		});

		it("names no absolute filesystem path when the checkpoint stage in the id was never recorded", async () => {
			const fixture = await writtenFixture();
			const app = createApiApp({
				runsDirectory: fixture.runsDirectory,
				corpusSource: directorySource(await corpusDirectory()),
			});
			const id = `checkpoint:${fixture.replayableRun}/no-such-stage`;

			const response = await app.request(
				`/api/records/${encodeURIComponent(id)}`,
			);
			const body = await response.text();

			expect(response.status).toBeGreaterThanOrEqual(400);
			expect(response.status).toBeLessThan(500);
			assertDoesNotLeak(body, fixture.runsDirectory);
		});
	});

	describe("GET /api/runs/:run/events", () => {
		it("streams every already-appended event as SSE frames, for a reader attaching mid-run", async () => {
			const runsDirectory = await mkdtemp(
				join(tmpdir(), "rehearsal-api-runs-"),
			);
			roots.push(runsDirectory);
			const store = await openRunEventStore(
				runEventsDatabaseFile(runsDirectory),
			);
			store.append({
				runId: "run-1",
				kind: "stage-started",
				stage: "shape",
				spentUsd: 0,
				elapsedMs: 0,
			});
			store.append({
				runId: "run-1",
				kind: "run-completed",
				stage: "shape",
				spentUsd: 1,
				elapsedMs: 1000,
			});
			store.close();
			const app = createApiApp({
				runsDirectory,
				corpusSource: directorySource(await corpusDirectory()),
			});

			const response = await app.request("/api/runs/run-1/events");
			const frames = parseSSEFrames(await response.text());

			expect(response.headers.get("content-type")).toBe("text/event-stream");
			expect(frames.map(({ kind }) => kind)).toEqual([
				"stage-started",
				"run-completed",
			]);
		});

		it("keeps a run with no events open rather than closing the connection, since the run may not have started emitting yet", async () => {
			const runsDirectory = await mkdtemp(
				join(tmpdir(), "rehearsal-api-runs-"),
			);
			roots.push(runsDirectory);
			const app = createApiApp({
				runsDirectory,
				corpusSource: directorySource(await corpusDirectory()),
			});
			const controller = new AbortController();

			const responsePromise = app.request("/api/runs/no-such-run/events", {
				signal: controller.signal,
			});
			const response = await responsePromise;
			const reader = response.body?.getReader();

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe("text/event-stream");
			controller.abort();
			await reader?.cancel();
		});
	});

	describe("unguarded route-level throw", () => {
		it("sanitizes an absolute path out of an error this module's own handlers did not anticipate", async () => {
			const root = await mkdtemp(join(tmpdir(), "rehearsal-api-throw-"));
			roots.push(root);
			const app = createApiApp({
				runsDirectory: root,
				corpusSource: directorySource(await corpusDirectory()),
			});
			app.get("/api/throws", () => {
				throw new Error(`boom at ${CONTROL_DIR}/secret.json`);
			});

			const response = await app.request("/api/throws");
			const body = await response.text();

			expect(response.status).toBe(500);
			assertDoesNotLeak(body, CONTROL_DIR);
		});

		it("names no absolute path when staleCheckpoints itself throws from a corpus root outside CONTROL_DIR", async () => {
			const fixture = await writtenFixture();
			const corpus = await corpusDirectory();
			await fixture.recordCorpusFrom(directorySource(corpus));
			await rm(join(corpus, "skills", "build"), { recursive: true });
			const app = createApiApp({
				runsDirectory: fixture.runsDirectory,
				corpusSource: directorySource(corpus),
			});

			const response = await app.request("/api/runs");
			const body = await response.text();

			assertDoesNotLeak(body, corpus);
		});
	});
});
