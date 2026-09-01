import { describe, expect, it } from "bun:test";
import type { ConfirmationRepRecord } from "./confirmation-record";
import { confirmationRepRecordSchema } from "./confirmation-record";
import {
	buildComparisonQuality,
	buildPairedEstimate,
} from "./comparison-report";
import type { ComparisonArm } from "./comparison-record";

type StageFixtureOutcome = "pass" | "fail" | "error" | "not-reached";
type FinalFixtureOutcome = "pass" | "fail" | "not-reached";

interface RepFixtureOutcomes {
	readonly discussion: StageFixtureOutcome;
	readonly build: StageFixtureOutcome;
	readonly final: FinalFixtureOutcome;
}

function stageOutcome(
	stage: string,
	outcome: StageFixtureOutcome,
): ConfirmationRepRecord["stages"][number] {
	if (outcome === "not-reached") {
		return {
			stage,
			status: "NOT_REACHED" as const,
			reason: "upstream stopped",
		};
	}
	if (outcome === "error") {
		return {
			stage,
			status: "EXECUTION_FAILED" as const,
			error: "execution failed",
		};
	}

	return {
		stage,
		status: "JUDGED" as const,
		grade: outcome === "pass" ? ("A" as const) : ("D" as const),
		verdict: outcome === "pass" ? ("CONTINUE" as const) : ("STOP" as const),
		elapsedMs: 10,
		evidence: {
			resultSha: "e".repeat(40),
			recordFile: `stages/${stage}.json`,
		},
	};
}

function finalOutcome(
	outcome: FinalFixtureOutcome,
): ConfirmationRepRecord["finalOutcome"] {
	if (outcome === "not-reached") {
		return { status: "NOT_REACHED" as const, reason: "upstream stopped" };
	}

	return {
		status: "JUDGED" as const,
		verdict: outcome === "pass" ? ("PASS" as const) : ("FAIL" as const),
		evidence: {
			resultSha: "e".repeat(40),
			recordFile: "final.json",
		},
	};
}

function repRecord(
	groupId: string,
	ordinal: number,
	outcomes: Readonly<RepFixtureOutcomes>,
): ConfirmationRepRecord {
	const successful =
		outcomes.discussion === "pass" &&
		outcomes.build === "pass" &&
		outcomes.final === "pass";

	return confirmationRepRecordSchema.parse({
		schemaVersion: 1,
		groupId,
		repId: `${groupId}-rep-${ordinal}`,
		ordinal,
		mode: "pipeline",
		worktreePath: `/worktrees/${groupId}-rep-${ordinal}`,
		lineage: { kind: "SOURCE", sha: "a".repeat(40) },
		outcome: successful ? "SUCCESSFUL" : "UNSUCCESSFUL",
		stages: [
			stageOutcome("discuss", outcomes.discussion),
			stageOutcome("build", outcomes.build),
		],
		finalOutcome: finalOutcome(outcomes.final),
		metrics: {
			status: "COMPLETE",
			calls: [
				{
					role: "worker",
					metrics: {
						costUsd: ordinal,
						inputTokens: ordinal * 10,
						outputTokens: ordinal * 2,
						cacheReadTokens: ordinal * 3,
						cacheWriteTokens: ordinal * 4,
						turns: ordinal,
					},
				},
			],
		},
		workerTrajectorySteps: ordinal,
		elapsedMs: ordinal * 100,
	});
}

const PASS: RepFixtureOutcomes = {
	discussion: "pass",
	build: "pass",
	final: "pass",
};
const FAIL: RepFixtureOutcomes = {
	discussion: "fail",
	build: "fail",
	final: "fail",
};

function qualityReps(
	caseId: string,
	role: ComparisonArm,
	outcomes: readonly RepFixtureOutcomes[],
): readonly ConfirmationRepRecord[] {
	return outcomes.map((outcome, index) =>
		repRecord(`${caseId}-${role}`, index + 1, outcome),
	);
}

describe(buildPairedEstimate.name, () => {
	it("averages within cases before estimating paired differences", () => {
		const cases = [
			{
				caseId: "case-1",
				minuend: [1, 1],
				subtrahend: [0, 1],
			},
			{
				caseId: "case-2",
				minuend: [1, 1],
				subtrahend: [0, 0],
			},
		];

		const estimate = buildPairedEstimate(cases);

		expect(estimate).toEqual({
			caseDeltas: [
				{ caseId: "case-1", value: 0.5 },
				{ caseId: "case-2", value: 1 },
			],
			meanDelta: 0.75,
			standardError: 0.25,
		});
	});

	it("ignores rep ordinal order within each case arm", () => {
		const cases = [
			{
				caseId: "case-1",
				minuend: [1, 1],
				subtrahend: [0, 1],
			},
			{
				caseId: "case-2",
				minuend: [1, 1],
				subtrahend: [0, 0],
			},
		];

		const forward = buildPairedEstimate(cases);
		const reversed = buildPairedEstimate(
			cases.map((benchmarkCase) => ({
				caseId: benchmarkCase.caseId,
				minuend: benchmarkCase.minuend.toReversed(),
				subtrahend: benchmarkCase.subtrahend.toReversed(),
			})),
		);

		expect(reversed).toEqual(forward);
	});
});

describe(buildComparisonQuality.name, () => {
	it("reports every case arm and all paired quality contrasts", () => {
		const report = buildComparisonQuality({
			contract: {
				mode: "pipeline",
				declaredStages: ["discuss", "build"],
				reps: 4,
			},
			cases: [
				{
					caseId: "case-1",
					arms: {
						baseline: qualityReps("case-1", "baseline", [
							PASS,
							PASS,
							FAIL,
							{
								discussion: "error",
								build: "not-reached",
								final: "not-reached",
							},
						]),
						candidate: qualityReps("case-1", "candidate", [
							PASS,
							PASS,
							PASS,
							PASS,
						]),
						control: qualityReps("case-1", "control", [FAIL, FAIL, FAIL, FAIL]),
					},
				},
				{
					caseId: "case-2",
					arms: {
						baseline: qualityReps("case-2", "baseline", [
							PASS,
							FAIL,
							FAIL,
							FAIL,
						]),
						candidate: qualityReps("case-2", "candidate", [
							PASS,
							PASS,
							PASS,
							PASS,
						]),
						control: qualityReps("case-2", "control", [FAIL, FAIL, FAIL, FAIL]),
					},
				},
			],
		});

		expect(report.cases[0]?.arms.baseline).toEqual([
			{
				name: "discuss",
				requested: 4,
				attempted: 4,
				notReached: 0,
				failed: 2,
				successful: 2,
				gradeDistribution: Object.fromEntries([
					["A", 2],
					["D", 1],
				]),
				successRate: 0.5,
				standardError: 0.25,
				passK: 0.5 ** 4,
			},
			{
				name: "build",
				requested: 4,
				attempted: 3,
				notReached: 1,
				failed: 1,
				successful: 2,
				gradeDistribution: Object.fromEntries([
					["A", 2],
					["D", 1],
				]),
				successRate: 0.5,
				standardError: 0.25,
				passK: 0.5 ** 4,
			},
			{
				name: "final",
				requested: 4,
				attempted: 3,
				notReached: 1,
				failed: 1,
				successful: 2,
				gradeDistribution: { PASS: 2, FAIL: 1 },
				successRate: 0.5,
				standardError: 0.25,
				passK: 0.5 ** 4,
			},
		]);
		expect(report.contrasts.candidateMinusBaseline.quality[0]).toEqual({
			name: "discuss",
			successRate: {
				caseDeltas: [
					{ caseId: "case-1", value: 0.5 },
					{ caseId: "case-2", value: 0.75 },
				],
				meanDelta: 0.625,
				standardError: 0.125,
			},
			passK: {
				caseDeltas: [
					{ caseId: "case-1", value: 0.9375 },
					{ caseId: "case-2", value: 0.99609375 },
				],
				meanDelta: 0.966796875,
				standardError: 0.029296875,
			},
		});
		expect(
			report.contrasts.candidateMinusControl.quality.map(({ name }) => name),
		).toEqual(["discuss", "build", "final"]);
		expect(
			report.contrasts.baselineMinusControl.quality.map(({ name }) => name),
		).toEqual(["discuss", "build", "final"]);
	});
});
