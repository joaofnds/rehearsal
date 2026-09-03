import { afterEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { CalibrationIncompleteError } from "#benchmark/calibration";
import { CONTROL_DIR } from "#benchmark/config";
import { calibratableArtifactSchema } from "#benchmark/calibration-record";
import { loadJudgeAgreementReport } from "#benchmark/judge-agreement";
import type { CurrentControlSources, JudgeKnobs } from "#cli/calibrate-command";
import { readControlSources, runCalibrate } from "#cli/calibrate-command";
import {
	FINAL_RUBRIC,
	RUN_NAME,
	stageRubricText,
	stageScorecard,
	writeReview,
	writeRunFixture,
	writeStoppedStageFixture,
} from "#cli/calibrate-test-support";
import { failureOf, recordOutput } from "#cli/cli-test-support";
import { UsageError } from "#cli/commands";
import { RefusedPreconditionError } from "#cli/interactive-stdin";

const directories: string[] = [];

afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

/**
 * The instructions and the case's final rubric as the run froze them, so a
 * test that means to change only the stage rubric changes only that. Every
 * observation here is over a fixture, and the control repository's own
 * CLAUDE.md and rubric.md are not what the fixture recorded.
 */
const unchangedControlSources = (): Promise<CurrentControlSources> =>
	Promise.resolve({ instructions: "Instructions", finalRubric: FINAL_RUBRIC });

const MISSED_SCOPE = {
	description: "The stage never fixed the scope.",
	paths: ["backlog/docs/spec.md"],
	stage: "discuss",
	judgeAssessment: "MISSED",
	rubricId: "scope",
};

const artifactSchema = z
	.object({
		status: z.string(),
		calibration: z
			.object({
				rejudgeConfirmedByHuman: z.boolean().optional(),
				stageRubricsChanged: z.array(z.string()),
			})
			.optional(),
		judgeAgreement: z.object({ skippedCalibrations: z.number() }).optional(),
	})
	.loose();

async function fixtureWithEditedStageRubric(): Promise<
	Awaited<ReturnType<typeof writeRunFixture>>
> {
	const fixture = await writeRunFixture();
	directories.push(fixture.runsDirectory);
	await Bun.write(
		fixture.stageRubricPath,
		stageRubricText("Scope is explicit and observable"),
	);
	await writeReview(fixture.reviewFile, [MISSED_SCOPE]);

	return fixture;
}

function rejudgingStage(): Parameters<typeof runCalibrate>[1] {
	return () => ({
		stageJudge: (_scorecard, source) =>
			Promise.resolve({
				...stageScorecard(source.rubricPath, "FAIL"),
				rubric: source.rubric,
			}),
		finalJudge: () =>
			Promise.reject(new Error("no final rejudge in this test")),
	});
}

describe(readControlSources.name, () => {
	it("reads the final rubric the case declares", async () => {
		const sources = await readControlSources("audit-log", "the frozen rubric");

		expect(sources.finalRubric).toBe(
			await Bun.file(join(CONTROL_DIR, "cases/audit-log/rubric.md")).text(),
		);
	});

	it("reads the frozen rubric for a run that recorded no case", async () => {
		const sources = await readControlSources(undefined, "the frozen rubric");

		expect(sources.finalRubric).toBe("the frozen rubric");
	});

	/**
	 * An unreadable case is refused rather than answered with the frozen
	 * rubric, which by construction reads as "the rubric did not change" and
	 * would discard the reviewer's edit with no rejudge and exit 0.
	 */
	it("refuses a case that is not there", async () => {
		const failure = await failureOf(
			readControlSources("no-such-case", "the frozen rubric"),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure?.message).toContain("no-such-case");
	});

	it("refuses a case that declares no final rubric", async () => {
		const failure = await failureOf(
			readControlSources("smoke", "the frozen rubric"),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure?.message).toContain("smoke");
	});
});

describe(runCalibrate.name, () => {
	it("refuses a rejudge without --confirm-rejudge and writes nothing", async () => {
		const fixture = await fixtureWithEditedStageRubric();
		const before = await Bun.file(fixture.artifactFile).text();
		const { output, stdout, stderr } = recordOutput();

		const failure = await failureOf(
			runCalibrate(
				{
					id: RUN_NAME,
					runsDirectory: fixture.runsDirectory,
					json: false,
					confirmRejudge: false,
					readCurrentSources: unchangedControlSources,
				},
				rejudgingStage(),
				output,
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(stdout).toEqual([]);
		expect(stderr.join("")).toContain("scope");
		expect(await Bun.file(fixture.artifactFile).text()).toBe(before);
	});

	it("completes the artifact with --confirm-rejudge", async () => {
		const fixture = await fixtureWithEditedStageRubric();
		const { output, stdout } = recordOutput();

		await runCalibrate(
			{
				id: RUN_NAME,
				runsDirectory: fixture.runsDirectory,
				json: false,
				confirmRejudge: true,
				readCurrentSources: unchangedControlSources,
			},
			rejudgingStage(),
			output,
		);

		const artifact = artifactSchema.parse(
			JSON.parse(await Bun.file(fixture.artifactFile).text()),
		);
		expect(artifact.status).toBe("COMPLETE");
		expect(artifact.calibration?.rejudgeConfirmedByHuman).toBe(true);
		expect(artifact.calibration?.stageRubricsChanged).toEqual(["discuss"]);
		expect(artifact.judgeAgreement?.skippedCalibrations).toBe(0);
		expect(stdout).toEqual([`${fixture.artifactFile}\n`]);
	});

	it("completes without --confirm-rejudge when nothing changed", async () => {
		const fixture = await writeRunFixture();
		directories.push(fixture.runsDirectory);
		await writeReview(fixture.reviewFile, []);
		const { output } = recordOutput();

		await runCalibrate(
			{
				id: RUN_NAME,
				runsDirectory: fixture.runsDirectory,
				json: false,
				confirmRejudge: false,
				readCurrentSources: unchangedControlSources,
			},
			() => ({
				stageJudge: () =>
					Promise.reject(new Error("no stage rejudge was needed")),
				finalJudge: () =>
					Promise.reject(new Error("no final rejudge was needed")),
			}),
			output,
		);

		const artifact = artifactSchema.parse(
			JSON.parse(await Bun.file(fixture.artifactFile).text()),
		);
		expect(artifact.status).toBe("COMPLETE");
		expect(artifact.calibration?.rejudgeConfirmedByHuman).toBeUndefined();
		expect(artifact.calibration?.stageRubricsChanged).toEqual([]);
	});

	it("refuses a review inconsistent with the grades and leaves the artifact", async () => {
		const fixture = await writeRunFixture();
		directories.push(fixture.runsDirectory);
		await writeReview(fixture.reviewFile, [
			{ ...MISSED_SCOPE, judgeAssessment: "CAUGHT" },
		]);
		const { output, stderr } = recordOutput();

		const failure = await failureOf(
			runCalibrate(
				{
					id: RUN_NAME,
					runsDirectory: fixture.runsDirectory,
					json: false,
					confirmRejudge: true,
					readCurrentSources: unchangedControlSources,
				},
				rejudgingStage(),
				output,
			),
		);

		expect(failure).toBeInstanceOf(CalibrationIncompleteError);
		expect(stderr.join("")).toContain("did not catch");
		const artifact = artifactSchema.parse(
			JSON.parse(await Bun.file(fixture.artifactFile).text()),
		);
		expect(artifact.status).toBe("AWAITING_HUMAN_REVIEW");
	});

	it("refuses a run with no review file and makes no provider call", async () => {
		const fixture = await writeRunFixture();
		directories.push(fixture.runsDirectory);
		const { output } = recordOutput();

		const failure = await failureOf(
			runCalibrate(
				{
					id: RUN_NAME,
					runsDirectory: fixture.runsDirectory,
					json: false,
					confirmRejudge: true,
					readCurrentSources: unchangedControlSources,
				},
				() => ({
					stageJudge: () => Promise.reject(new Error("no provider call")),
					finalJudge: () => Promise.reject(new Error("no provider call")),
				}),
				output,
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure.message).toContain(".review.json");
	});

	it("refuses a run already COMPLETE without rejudging", async () => {
		const fixture = await writeRunFixture({ status: "COMPLETE" });
		directories.push(fixture.runsDirectory);
		await writeReview(fixture.reviewFile, []);
		const { output } = recordOutput();

		const failure = await failureOf(
			runCalibrate(
				{
					id: RUN_NAME,
					runsDirectory: fixture.runsDirectory,
					json: false,
					confirmRejudge: true,
					readCurrentSources: unchangedControlSources,
				},
				() => ({
					stageJudge: () => Promise.reject(new Error("no provider call")),
					finalJudge: () => Promise.reject(new Error("no provider call")),
				}),
				output,
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure.message).toContain("COMPLETE");
	});

	it("records the final rubric edit and its revised grade", async () => {
		const fixture = await writeRunFixture();
		directories.push(fixture.runsDirectory);
		await writeReview(fixture.reviewFile, [
			{
				description: "The final Judge missed the worker defect.",
				paths: ["src/audit/worker.ts"],
				stage: "final",
				judgeAssessment: "MISSED",
				rubricId: "worker-metadata",
			},
		]);
		const controlRubric = `${FINAL_RUBRIC}4. \`worker-metadata\`: The row keeps request metadata.\n`;
		const { output } = recordOutput();

		await runCalibrate(
			{
				id: RUN_NAME,
				runsDirectory: fixture.runsDirectory,
				json: false,
				confirmRejudge: true,
				readCurrentSources: () =>
					Promise.resolve({
						instructions: "Instructions",
						finalRubric: controlRubric,
					}),
			},
			() => ({
				stageJudge: () => Promise.reject(new Error("no stage rejudge")),
				finalJudge: () =>
					Promise.resolve({
						prompt: "revised prompt",
						attempts: [],
						costUsd: 0,
						grade: {
							requirements: [
								{
									id: "worker-metadata",
									status: "FAIL",
									evidence: [
										{
											source: "diff",
											path: "src/audit/worker.ts",
											claim: "metadata missing",
										},
									],
								},
							],
							verdict: "FAIL",
							summary: "revised",
						},
					}),
			}),
			output,
		);

		const artifact = artifactSchema.parse(
			JSON.parse(await Bun.file(fixture.artifactFile).text()),
		);
		expect(artifact.status).toBe("COMPLETE");
		expect(artifact.calibration?.rejudgeConfirmedByHuman).toBe(true);
	});

	it("completes a stopped stage's record when no artifact was written", async () => {
		const fixture = await writeStoppedStageFixture();
		directories.push(fixture.runsDirectory);
		await Bun.write(
			fixture.stageRubricPath,
			stageRubricText("Scope is explicit and observable"),
		);
		await writeReview(fixture.reviewFile, [MISSED_SCOPE]);
		const { output, stdout } = recordOutput();

		await runCalibrate(
			{
				id: RUN_NAME,
				runsDirectory: fixture.runsDirectory,
				json: false,
				confirmRejudge: true,
				readCurrentSources: unchangedControlSources,
			},
			rejudgingStage(),
			output,
		);

		const record = z
			.object({
				calibration: z.object({
					stageRubricsChanged: z.array(z.string()),
				}),
				judgeAgreement: z.object({ skippedCalibrations: z.number() }),
			})
			.loose()
			.parse(JSON.parse(await Bun.file(fixture.stageFile).text()));
		expect(record.calibration.stageRubricsChanged).toEqual(["discuss"]);
		expect(record.judgeAgreement.skippedCalibrations).toBe(0);
		expect(stdout).toEqual([`${fixture.stageFile}\n`]);
	});

	it("rejudges a stopped stage under the Judge knobs the record froze", async () => {
		const fixture = await writeStoppedStageFixture();
		directories.push(fixture.runsDirectory);
		await Bun.write(
			fixture.stageRubricPath,
			stageRubricText("Scope is explicit and observable"),
		);
		await writeReview(fixture.reviewFile, [MISSED_SCOPE]);
		const { output } = recordOutput();
		const knobs: JudgeKnobs[] = [];

		await runCalibrate(
			{
				id: RUN_NAME,
				runsDirectory: fixture.runsDirectory,
				json: false,
				confirmRejudge: true,
				readCurrentSources: unchangedControlSources,
			},
			(recorded) => {
				knobs.push(recorded);

				return rejudgingStage()(recorded);
			},
			output,
		);

		expect(knobs).toEqual([
			{ judgeModel: "sonnet", judgeEffort: "medium", sessionBudgetUsd: 5 },
		]);
	});

	/**
	 * A stage record written before this card carries the Judge's model but
	 * neither its effort nor the session budget. It still calibrates: a record
	 * the command cannot parse is a record it reports as absent, and the
	 * evidence in it was paid for.
	 */
	it("calibrates a stage record written without the Judge knobs", async () => {
		const fixture = await writeStoppedStageFixture({ judgeModel: "sonnet" });
		directories.push(fixture.runsDirectory);
		await writeReview(fixture.reviewFile, []);
		const { output } = recordOutput();

		await runCalibrate(
			{
				id: RUN_NAME,
				runsDirectory: fixture.runsDirectory,
				json: false,
				confirmRejudge: false,
				readCurrentSources: unchangedControlSources,
			},
			() => ({
				stageJudge: () => Promise.reject(new Error("no provider call")),
				finalJudge: () => Promise.reject(new Error("no provider call")),
			}),
			output,
		);

		const record = z
			.object({
				calibration: z.object({ stageRubricsChanged: z.array(z.string()) }),
				judgeAgreement: z.object({ skippedCalibrations: z.number() }),
			})
			.loose()
			.parse(JSON.parse(await Bun.file(fixture.stageFile).text()));
		expect(record.calibration.stageRubricsChanged).toEqual([]);
		expect(record.judgeAgreement.skippedCalibrations).toBe(0);
	});

	/**
	 * This card adds no field a reader must have, so an artifact written before
	 * it reads the same way as one written after. The pre-card shape is the one
	 * `buildRunArtifact` wrote without a retention ref; the post-card shape is
	 * what `calibrate` leaves behind. One reader parses both.
	 */
	it("reads a pre-card artifact and the one it writes through the same parser", async () => {
		const fixture = await writeRunFixture();
		directories.push(fixture.runsDirectory);
		const preCard = calibratableArtifactSchema.parse(
			JSON.parse(await Bun.file(fixture.artifactFile).text()),
		);
		await writeReview(fixture.reviewFile, []);
		const { output } = recordOutput();

		await runCalibrate(
			{
				id: RUN_NAME,
				runsDirectory: fixture.runsDirectory,
				json: false,
				confirmRejudge: false,
				readCurrentSources: unchangedControlSources,
			},
			() => ({
				stageJudge: () => Promise.reject(new Error("no provider call")),
				finalJudge: () => Promise.reject(new Error("no provider call")),
			}),
			output,
		);

		const postCard = calibratableArtifactSchema.parse(
			JSON.parse(await Bun.file(fixture.artifactFile).text()),
		);
		expect(preCard.status).toBe("AWAITING_HUMAN_REVIEW");
		expect(postCard.status).toBe("COMPLETE");
		expect(postCard.resultSha).toBe(preCard.resultSha);
		const agreement = await loadJudgeAgreementReport(fixture.runsDirectory);
		expect(agreement.skippedCalibrations).toBe(0);
	});

	/**
	 * Through the production reader, not the seam: an artifact naming a case
	 * that is not there is refused, rather than recorded COMPLETE with the
	 * reviewer's rubric edit discarded as "unchanged".
	 */
	it("refuses a run whose case cannot be read", async () => {
		const fixture = await writeRunFixture({ caseId: "no-such-case" });
		directories.push(fixture.runsDirectory);
		await writeReview(fixture.reviewFile, []);
		const { output } = recordOutput();

		const failure = await failureOf(
			runCalibrate(
				{
					id: RUN_NAME,
					runsDirectory: fixture.runsDirectory,
					json: false,
					confirmRejudge: false,
				},
				() => ({
					stageJudge: () => Promise.reject(new Error("no provider call")),
					finalJudge: () => Promise.reject(new Error("no provider call")),
				}),
				output,
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure?.message).toContain("no-such-case");
		const artifact = artifactSchema.parse(
			JSON.parse(await Bun.file(fixture.artifactFile).text()),
		);
		expect(artifact.status).toBe("AWAITING_HUMAN_REVIEW");
	});

	it("accepts the run as run:<name> and refuses one naming a path outside", async () => {
		const fixture = await writeRunFixture();
		directories.push(fixture.runsDirectory);
		await writeReview(fixture.reviewFile, []);
		const { output } = recordOutput();

		await runCalibrate(
			{
				id: `run:${RUN_NAME}`,
				runsDirectory: fixture.runsDirectory,
				json: false,
				confirmRejudge: false,
				readCurrentSources: unchangedControlSources,
			},
			() => ({
				stageJudge: () => Promise.reject(new Error("no provider call")),
				finalJudge: () => Promise.reject(new Error("no provider call")),
			}),
			output,
		);

		const failure = await failureOf(
			runCalibrate(
				{
					id: "run:../escape",
					runsDirectory: fixture.runsDirectory,
					json: false,
					confirmRejudge: false,
					readCurrentSources: unchangedControlSources,
				},
				() => ({
					stageJudge: () => Promise.reject(new Error("no provider call")),
					finalJudge: () => Promise.reject(new Error("no provider call")),
				}),
				output,
			),
		);

		expect(failure).toBeInstanceOf(UsageError);
		expect(failure.message).toContain("outside the runs directory");
	});
});
