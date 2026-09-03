import { describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { z } from "zod";
import type { humanFindingSchema } from "#benchmark/contracts";
import { humanReviewSchema } from "#benchmark/contracts";
import { benchmarkRunPaths } from "#benchmark/run-layout";
import { TestResources } from "#benchmark/test-support";
import { failureOf, recordOutput } from "#cli/cli-test-support";
import { UsageError } from "#cli/commands";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import { runReview } from "#cli/review-command";

const testResources = TestResources.forEachTest();

const RUN_NAME = "2026-09-03T00-00-00.000Z";

const finding: z.infer<typeof humanFindingSchema> = {
	description: "The worker drops request metadata.",
	paths: ["src/audit/worker.ts"],
	stage: "build",
	judgeAssessment: "MISSED",
	rubricId: "worker-metadata",
};

async function runsDirectoryWithArtifact(): Promise<string> {
	const runsDirectory = await mkdtemp(join(tmpdir(), "rehearsal-runs-"));
	testResources.track(runsDirectory);
	await Bun.write(
		benchmarkRunPaths(runsDirectory, RUN_NAME).artifactFile,
		JSON.stringify({ status: "AWAITING_HUMAN_REVIEW" }),
	);

	return runsDirectory;
}

describe(runReview.name, () => {
	it("writes the review the flags describe", async () => {
		const runsDirectory = await runsDirectoryWithArtifact();
		const { output, stdout } = recordOutput();

		await runReview(
			{
				id: RUN_NAME,
				runsDirectory,
				json: false,
				verdict: "REJECT",
				summary: "The worker loses metadata.",
				findings: [JSON.stringify(finding)],
				file: undefined,
			},
			output,
		);

		const { reviewFile } = benchmarkRunPaths(runsDirectory, RUN_NAME);
		const written = humanReviewSchema.parse(
			JSON.parse(await Bun.file(reviewFile).text()),
		);
		expect(written.verdict).toBe("REJECT");
		expect(written.summary).toBe("The worker loses metadata.");
		expect(written.findings).toEqual([finding]);
		expect(stdout).toEqual([`${reviewFile}\n`]);
	});

	it("records repeated findings in the order they were given", async () => {
		const runsDirectory = await runsDirectoryWithArtifact();
		const { output } = recordOutput();
		const second = { ...finding, rubricId: "worker-ordering" };

		await runReview(
			{
				id: RUN_NAME,
				runsDirectory,
				json: false,
				verdict: "REJECT",
				summary: "Two defects.",
				findings: [JSON.stringify(finding), JSON.stringify(second)],
				file: undefined,
			},
			output,
		);

		const written = humanReviewSchema.parse(
			JSON.parse(
				await Bun.file(
					benchmarkRunPaths(runsDirectory, RUN_NAME).reviewFile,
				).text(),
			),
		);
		expect(written.findings.map(({ rubricId }) => rubricId)).toEqual([
			"worker-metadata",
			"worker-ordering",
		]);
	});

	it("writes the parsed review a --file names", async () => {
		const runsDirectory = await runsDirectoryWithArtifact();
		const file = join(runsDirectory, "given.json");
		await Bun.write(
			file,
			JSON.stringify({
				verdict: "ACCEPT",
				summary: "Nothing to promote.",
				findings: [],
			}),
		);
		const { output } = recordOutput();

		await runReview(
			{
				id: RUN_NAME,
				runsDirectory,
				json: false,
				verdict: undefined,
				summary: undefined,
				findings: [],
				file,
			},
			output,
		);

		const written = humanReviewSchema.parse(
			JSON.parse(
				await Bun.file(
					benchmarkRunPaths(runsDirectory, RUN_NAME).reviewFile,
				).text(),
			),
		);
		expect(written.verdict).toBe("ACCEPT");
	});

	it("refuses a --file the schema rejects and leaves the review file alone", async () => {
		const runsDirectory = await runsDirectoryWithArtifact();
		const { reviewFile } = benchmarkRunPaths(runsDirectory, RUN_NAME);
		await Bun.write(reviewFile, "the review already there");
		const file = join(runsDirectory, "given.json");
		await Bun.write(file, JSON.stringify({ verdict: "MAYBE" }));
		const { output } = recordOutput();

		const failure = await failureOf(
			runReview(
				{
					id: RUN_NAME,
					runsDirectory,
					json: false,
					verdict: undefined,
					summary: undefined,
					findings: [],
					file,
				},
				output,
			),
		);

		expect(failure).toBeInstanceOf(UsageError);
		expect(await Bun.file(reviewFile).text()).toBe("the review already there");
	});

	it("refuses --file together with the flags that describe a review", async () => {
		const runsDirectory = await runsDirectoryWithArtifact();
		const { output } = recordOutput();

		const failure = await failureOf(
			runReview(
				{
					id: RUN_NAME,
					runsDirectory,
					json: false,
					verdict: "REJECT",
					summary: undefined,
					findings: [],
					file: "/tmp/review.json",
				},
				output,
			),
		);

		expect(failure).toBeInstanceOf(UsageError);
		expect(failure.message).toContain("--file");
		expect(failure.message).toContain("--verdict");
	});

	it("refuses a review described by neither --file nor the flags", async () => {
		const runsDirectory = await runsDirectoryWithArtifact();
		const { output } = recordOutput();

		const failure = await failureOf(
			runReview(
				{
					id: RUN_NAME,
					runsDirectory,
					json: false,
					verdict: undefined,
					summary: undefined,
					findings: [],
					file: undefined,
				},
				output,
			),
		);

		expect(failure).toBeInstanceOf(UsageError);
		expect(failure.message).toContain("--file");
	});

	it("refuses a run with no artifact and writes no review", async () => {
		const runsDirectory = await mkdtemp(join(tmpdir(), "rehearsal-runs-"));
		testResources.track(runsDirectory);
		const { output } = recordOutput();

		const failure = await failureOf(
			runReview(
				{
					id: RUN_NAME,
					runsDirectory,
					json: false,
					verdict: "REJECT",
					summary: "No run here.",
					findings: [],
					file: undefined,
				},
				output,
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure.message).toContain(RUN_NAME);
		expect(
			await Bun.file(
				benchmarkRunPaths(runsDirectory, RUN_NAME).reviewFile,
			).exists(),
		).toBe(false);
	});

	it("prints the review record's own bytes for --json", async () => {
		const runsDirectory = await runsDirectoryWithArtifact();
		const { output, stdout } = recordOutput();

		await runReview(
			{
				id: RUN_NAME,
				runsDirectory,
				json: true,
				verdict: "REJECT",
				summary: "The worker loses metadata.",
				findings: [],
				file: undefined,
			},
			output,
		);

		expect(stdout).toHaveLength(1);
		const printed = stdout.join("");
		expect(JSON.parse(printed)).toEqual(
			JSON.parse(
				await Bun.file(
					benchmarkRunPaths(runsDirectory, RUN_NAME).reviewFile,
				).text(),
			),
		);
	});

	it("accepts the run as run:<name> and as a bare name", async () => {
		const runsDirectory = await runsDirectoryWithArtifact();
		const { output } = recordOutput();

		await runReview(
			{
				id: `run:${RUN_NAME}`,
				runsDirectory,
				json: false,
				verdict: "REJECT",
				summary: "Prefixed.",
				findings: [],
				file: undefined,
			},
			output,
		);

		const written = humanReviewSchema.parse(
			JSON.parse(
				await Bun.file(
					benchmarkRunPaths(runsDirectory, RUN_NAME).reviewFile,
				).text(),
			),
		);
		expect(written.summary).toBe("Prefixed.");
	});

	it("refuses a run id naming a path outside the runs directory", async () => {
		const runsDirectory = await runsDirectoryWithArtifact();
		const { output } = recordOutput();

		const failure = await failureOf(
			runReview(
				{
					id: "run:../escape",
					runsDirectory,
					json: false,
					verdict: "REJECT",
					summary: "Escaping.",
					findings: [],
					file: undefined,
				},
				output,
			),
		);

		expect(failure).toBeInstanceOf(UsageError);
		expect(failure.message).toContain("outside the runs directory");
	});

	it("refuses a --finding that is not one JSON finding object", async () => {
		const runsDirectory = await runsDirectoryWithArtifact();
		const { output } = recordOutput();

		const failure = await failureOf(
			runReview(
				{
					id: RUN_NAME,
					runsDirectory,
					json: false,
					verdict: "REJECT",
					summary: "Malformed finding.",
					findings: ["not json"],
					file: undefined,
				},
				output,
			),
		);

		expect(failure).toBeInstanceOf(UsageError);
	});
});
