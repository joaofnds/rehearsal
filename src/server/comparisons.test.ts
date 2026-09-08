import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
	directorySource,
	RecordedRunsFixture,
} from "#benchmark/run-records-test-support";
import { createApiApp } from "./api";
import { armPairLabel } from "./comparisons";

const attributionSchema = z.discriminatedUnion("claim", [
	z.object({ claim: z.literal("identical") }),
	z.object({
		claim: z.literal("refused"),
		differingPaths: z.array(z.string()),
	}),
]);
const comparisonResponseSchema = z.object({
	report: z
		.object({ cases: z.array(z.object({ caseId: z.string() })) })
		.loose(),
	attribution: z.record(z.string(), z.record(z.string(), attributionSchema)),
});

async function comparisonResponseFrom(
	response: Response,
): Promise<z.infer<typeof comparisonResponseSchema>> {
	return comparisonResponseSchema.parse(await response.json());
}

describe(armPairLabel.name, () => {
	it("decodes a pair key into its minuend and subtrahend arm names", () => {
		expect(armPairLabel("candidateMinusBaseline")).toBe(
			"candidate vs baseline",
		);
	});

	it("decodes every arm pair the server itself constructs", () => {
		expect(armPairLabel("baselineMinusControl")).toBe("baseline vs control");
		expect(armPairLabel("controlMinusCandidate")).toBe("control vs candidate");
	});
});

describe("GET /api/comparisons/:digest", () => {
	const roots: string[] = [];

	afterEach(async () => {
		await Promise.all(
			roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
		);
	});

	async function corpusDirectory(): Promise<string> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-comparisons-corpus-"));
		roots.push(root);

		return root;
	}

	async function writtenFixture(): Promise<RecordedRunsFixture> {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-comparisons-"));
		roots.push(root);
		const fixture = new RecordedRunsFixture(root);
		await fixture.write();

		return fixture;
	}

	it("renders the recorded report plus attribution for every case and contrast", async () => {
		const fixture = await writtenFixture();
		const app = createApiApp({
			runsDirectory: fixture.runsDirectory,
			corpusSource: directorySource(await corpusDirectory()),
		});

		const response = await app.request(
			`/api/comparisons/${fixture.comparisonDigest}`,
		);
		const body = await comparisonResponseFrom(response);

		expect(response.status).toBe(200);
		expect(body.report.cases.length).toBeGreaterThanOrEqual(2);
		expect(body.attribution["case-1"]?.["candidateMinusBaseline"]).toEqual({
			claim: "refused",
			differingPaths: ["inputs/corpus/SKILL.md"],
		});
	});

	it("refuses a digest whose segment escapes the runs directory, without a 500", async () => {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-comparisons-escape-"));
		roots.push(root);
		const app = createApiApp({
			runsDirectory: root,
			corpusSource: directorySource(await corpusDirectory()),
		});

		const response = await app.request(
			`/api/comparisons/${encodeURIComponent("../../etc/passwd")}`,
		);

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(response.status).toBeLessThan(500);
	});

	it("refuses a digest that names no recorded comparison, without a 500", async () => {
		const root = await mkdtemp(join(tmpdir(), "rehearsal-comparisons-empty-"));
		roots.push(root);
		const app = createApiApp({
			runsDirectory: root,
			corpusSource: directorySource(await corpusDirectory()),
		});

		const response = await app.request(`/api/comparisons/${"9".repeat(64)}`);

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(response.status).toBeLessThan(500);
	});
});
