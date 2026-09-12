import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
	directorySource,
	RecordedRunsFixture,
} from "#benchmark/run-records-test-support";
import {
	COMPARISON_ARMS,
	parseComparisonReport,
	serializeComparisonReport,
	sessionComparisonReportSchema,
} from "#benchmark/comparison-record";
import { comparisonReportPaths } from "#benchmark/run-layout";
import { createApiApp } from "./api";

const attributionSchema = z.discriminatedUnion("claim", [
	z.object({ claim: z.literal("identical") }),
	z.object({
		claim: z.literal("attributable"),
		differingPath: z.string(),
		differingPaths: z.tuple([z.string()]),
	}),
	z.object({
		claim: z.literal("refused"),
		differingPaths: z.array(z.string()).min(2),
	}),
]);
const qualityIntervalSchema = z
	.object({ low: z.string(), high: z.string() })
	.optional();
const qualityReadingSchema = z.object({
	interval: z.object({
		minuend: qualityIntervalSchema,
		subtrahend: qualityIntervalSchema,
	}),
	verdict: z.discriminatedUnion("kind", [
		z.object({ kind: z.literal("insideRerunNoise") }),
		z.object({ kind: z.literal("unchangedAlreadyClear") }),
		z.object({ kind: z.literal("separated"), arm: z.string() }),
	]),
});
const comparisonResponseSchema = z.object({
	report: z
		.object({
			mode: z.enum(["stage", "pipeline", "session"]),
			cases: z.array(z.object({ caseId: z.string() })),
		})
		.loose(),
	attribution: z.record(z.string(), z.record(z.string(), attributionSchema)),
	qualityReadings: z.record(
		z.string(),
		z.record(z.string(), z.record(z.string(), qualityReadingSchema)),
	),
});

async function comparisonResponseFrom(
	response: Response,
): Promise<z.infer<typeof comparisonResponseSchema>> {
	return comparisonResponseSchema.parse(await response.json());
}

async function rewriteFixtureAsSession(
	fixture: RecordedRunsFixture,
): Promise<void> {
	const { reportFile } = comparisonReportPaths(
		fixture.runsDirectory,
		fixture.comparisonDigest,
	);
	const pipeline = parseComparisonReport(await Bun.file(reportFile).text());
	if (pipeline.schemaVersion !== 2) {
		throw new Error("expected the fixture to write a current pipeline report");
	}

	const session = sessionComparisonReportSchema.parse({
		...pipeline,
		schemaVersion: 3,
		mode: "session",
		declaredStages: ["checks"],
		judgeAgreement: { ...pipeline.judgeAgreement, baselines: [] },
		cases: pipeline.cases.map(({ caseId, arms }) => ({
			caseId,
			arms: Object.fromEntries(
				COMPARISON_ARMS.map((role) => [
					role,
					{
						...arms[role],
						source: {
							...arms[role].source,
							reps: arms[role].source.reps.map((rep) => ({
								...rep,
								attempt: {
									path: `attempts/${rep.repId}.json`,
									sha256: "a".repeat(64),
								},
							})),
						},
						executedCorpus:
							role === "control"
								? []
								: arms[role].executedCorpus.map((file) => ({
										...file,
										path: "inputs/corpus/output-styles/brief.md",
									})),
						quality: [{ ...arms[role].quality[0], name: "checks" }],
					},
				]),
			),
		})),
		contrasts: Object.fromEntries(
			Object.entries(pipeline.contrasts).map(([pair, contrast]) => [
				pair,
				{
					...contrast,
					quality: [{ ...contrast.quality[0], name: "checks" }],
				},
			]),
		),
	});

	await Bun.write(reportFile, serializeComparisonReport(session));
}

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
		expect(body.report.cases.map(({ caseId }) => caseId)).toEqual([
			"case-1",
			"case-2",
		]);
		for (const caseId of ["case-1", "case-2"]) {
			expect(Object.keys(body.attribution[caseId] ?? {}).toSorted()).toEqual([
				"baselineMinusControl",
				"candidateMinusBaseline",
				"candidateMinusControl",
			]);
			expect(body.attribution[caseId]?.["candidateMinusBaseline"]).toEqual({
				claim: "attributable",
				differingPath: "inputs/corpus/SKILL.md",
				differingPaths: ["inputs/corpus/SKILL.md"],
			});
		}
	});

	it("uses session-mode layout paths in the public response", async () => {
		const fixture = await writtenFixture();
		await rewriteFixtureAsSession(fixture);
		const app = createApiApp({
			runsDirectory: fixture.runsDirectory,
			corpusSource: directorySource(await corpusDirectory()),
		});

		const response = await app.request(
			`/api/comparisons/${fixture.comparisonDigest}`,
		);
		const body = await comparisonResponseFrom(response);

		expect(response.status).toBe(200);
		expect(body.report.mode).toBe("session");
		expect(body.attribution["case-1"]?.["candidateMinusBaseline"]).toEqual({
			claim: "attributable",
			differingPath: "output-styles/brief.md",
			differingPaths: ["output-styles/brief.md"],
		});
	});

	it("renders a quality reading for the discuss measure, per case per contrast", async () => {
		const fixture = await writtenFixture();
		const app = createApiApp({
			runsDirectory: fixture.runsDirectory,
			corpusSource: directorySource(await corpusDirectory()),
		});

		const response = await app.request(
			`/api/comparisons/${fixture.comparisonDigest}`,
		);
		const body = await comparisonResponseFrom(response);

		expect(
			body.qualityReadings["case-1"]?.["candidateMinusBaseline"]?.["discuss"],
		).toEqual({
			interval: {
				minuend: { low: "A", high: "A" },
				subtrahend: { low: "A", high: "D" },
			},
			verdict: { kind: "insideRerunNoise" },
		});
		expect(
			body.qualityReadings["case-1"]?.["candidateMinusControl"]?.["discuss"],
		).toEqual({
			interval: {
				minuend: { low: "A", high: "A" },
				subtrahend: { low: "D", high: "D" },
			},
			verdict: { kind: "separated", arm: "candidate" },
		});
	});

	it("renders a quality reading for every declared-stage measure and, in pipeline mode, the final row", async () => {
		const fixture = await writtenFixture();
		const app = createApiApp({
			runsDirectory: fixture.runsDirectory,
			corpusSource: directorySource(await corpusDirectory()),
		});

		const response = await app.request(
			`/api/comparisons/${fixture.comparisonDigest}`,
		);
		const body = await comparisonResponseFrom(response);
		const readings = body.qualityReadings["case-1"]?.["candidateMinusBaseline"];

		expect(Object.keys(readings ?? {}).toSorted()).toEqual([
			"build",
			"discuss",
			"final",
		]);
		expect(readings?.["build"]).toEqual({
			interval: {
				minuend: { low: "A", high: "A" },
				subtrahend: { low: "A", high: "D" },
			},
			verdict: { kind: "insideRerunNoise" },
		});
		expect(readings?.["final"]).toEqual({
			interval: {
				minuend: { low: "PASS", high: "PASS" },
				subtrahend: { low: "PASS", high: "FAIL" },
			},
			verdict: { kind: "insideRerunNoise" },
		});
	});

	it("renders exactly the report's three canonical contrasts per case, not all six ordered pairs", async () => {
		const fixture = await writtenFixture();
		const app = createApiApp({
			runsDirectory: fixture.runsDirectory,
			corpusSource: directorySource(await corpusDirectory()),
		});

		const response = await app.request(
			`/api/comparisons/${fixture.comparisonDigest}`,
		);
		const body = await comparisonResponseFrom(response);

		expect(Object.keys(body.attribution["case-1"] ?? {}).toSorted()).toEqual([
			"baselineMinusControl",
			"candidateMinusBaseline",
			"candidateMinusControl",
		]);
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
