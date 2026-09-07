import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
	directorySource,
	RecordedRunsFixture,
} from "#benchmark/run-records-test-support";
import { CONTROL_DIR } from "#benchmark/config";
import { createApiApp } from "./api";

const runHistoryRowSchema = z
	.object({ run: z.string(), stale: z.boolean() })
	.loose();
const runHistoryResponseSchema = z.object({
	rows: z.array(runHistoryRowSchema),
});

async function runHistoryResponseFrom(
	response: Response,
): Promise<z.infer<typeof runHistoryResponseSchema>> {
	return runHistoryResponseSchema.parse(await response.json());
}

describe(createApiApp.name, () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
		);
	});

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
			expect(body).not.toContain(CONTROL_DIR);
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
			expect(body).not.toContain(CONTROL_DIR);
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
			expect(body).not.toContain(CONTROL_DIR);
		});
	});
});
