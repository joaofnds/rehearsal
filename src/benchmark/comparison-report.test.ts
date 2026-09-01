import { describe, expect, it } from "bun:test";
import type {
	ConfirmationGroupRecord,
	ConfirmationRepRecord,
} from "./confirmation-record";
import {
	confirmationGroupRecordSchema,
	confirmationRepRecordSchema,
} from "./confirmation-record";
import type {
	ComparisonArmEvidence,
	ComparisonEvidence,
} from "./comparison-evidence";
import {
	buildComparisonReport,
	buildComparisonQuality,
	buildComparisonResources,
	buildPairedEstimate,
} from "./comparison-report";
import type { ComparisonArm } from "./comparison-record";
import { parseComparisonReport } from "./comparison-record";
import type { Immutable } from "./contracts";

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
	metricScale = 1,
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
						costUsd: ordinal * metricScale,
						inputTokens: ordinal * 10 * metricScale,
						outputTokens: ordinal * 2 * metricScale,
						cacheReadTokens: ordinal * 3 * metricScale,
						cacheWriteTokens: ordinal * 4 * metricScale,
						turns: ordinal * metricScale,
					},
				},
			],
		},
		workerTrajectorySteps: ordinal * metricScale,
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
	metricScale = 1,
): readonly ConfirmationRepRecord[] {
	return outcomes.map((outcome, index) =>
		repRecord(`${caseId}-${role}`, index + 1, outcome, metricScale),
	);
}

function withMissingMetrics(
	record: Immutable<ConfirmationRepRecord>,
	missing: string,
): ConfirmationRepRecord {
	return confirmationRepRecordSchema.parse({
		...record,
		outcome: "UNSUCCESSFUL",
		metrics: { status: "MISSING", calls: [], missing: [missing] },
		workerTrajectorySteps: 0,
	});
}

function reportArmEvidence(
	caseId: string,
	role: ComparisonArm,
	reps: readonly Immutable<ConfirmationRepRecord>[],
): ComparisonArmEvidence {
	const groupId = `${caseId}-${role}`;
	const corpus = {
		kind: "corpus" as const,
		path: "inputs/corpus/SKILL.md",
		sha256: { baseline: "1", candidate: "2", control: "3" }[role].repeat(64),
	};
	const record: ConfirmationGroupRecord = confirmationGroupRecordSchema.parse({
		schemaVersion: 1,
		groupId,
		mode: "pipeline",
		reps: 4,
		declaredStages: ["discuss", "build"],
		inputs: {
			lineage: { kind: "SOURCE", sha: "a".repeat(40) },
			files: [
				corpus,
				{
					kind: "task",
					path: "inputs/task.md",
					sha256: (caseId === "case-1" ? "4" : "5").repeat(64),
				},
			],
			model: "sonnet",
			judgeModel: "opus",
			sessionBudgetUsd: 5,
			pipelinePath: "pipelines/default.json",
		},
		projectedCost: {
			reps: 4,
			perRepMaximumUsd: 30,
			totalMaximumUsd: 120,
		},
		approval: { method: "yes", approved: true },
		repRecords: reps.map((rep) => ({
			repId: rep.repId,
			ordinal: rep.ordinal,
			path: `reps/${rep.repId}/rep.json`,
		})),
		reportFile: "report.json",
		makespanMs: 400,
	});

	return {
		role,
		group: {
			path: `groups/${groupId}/group.json`,
			sha256: "6".repeat(64),
			record,
		},
		reps: reps.map((rep) => ({
			path: `groups/${groupId}/reps/${rep.repId}/rep.json`,
			sha256: "7".repeat(64),
			record: rep,
		})),
		executedCorpus: [corpus],
	};
}

function reportEvidence(): ComparisonEvidence {
	const cases = ["case-1", "case-2"].map((caseId) => {
		const baseline = qualityReps(caseId, "baseline", [PASS, PASS, FAIL, FAIL]);
		const candidate = qualityReps(caseId, "candidate", [
			PASS,
			PASS,
			PASS,
			PASS,
		]);
		const control = qualityReps(caseId, "control", [FAIL, FAIL, FAIL, FAIL]);

		return {
			caseId,
			arms: {
				baseline: reportArmEvidence(caseId, "baseline", baseline),
				candidate: reportArmEvidence(caseId, "candidate", candidate),
				control: reportArmEvidence(caseId, "control", control),
			},
		};
	});

	return {
		manifest: {
			path: "/tmp/comparison.json",
			sha256: "8".repeat(64),
		},
		cases,
		contract: {
			mode: "pipeline",
			declaredStages: ["discuss", "build"],
			reps: 4,
		},
	};
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
				minuend: [1, 0],
				subtrahend: [1, 0],
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
				minuend: benchmarkCase.minuend,
				subtrahend: benchmarkCase.subtrahend.toReversed(),
			})),
		);

		expect(forward).toEqual({
			caseDeltas: [
				{ caseId: "case-1", value: 0 },
				{ caseId: "case-2", value: 1 },
			],
			meanDelta: 0.5,
			standardError: 0.5,
		});
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

describe(buildComparisonResources.name, () => {
	it("reports complete resource means and unavailable missing-metric contrasts", () => {
		const caseOneControl = [
			repRecord("case-1-control", 1, FAIL, 0),
			withMissingMetrics(
				repRecord("case-1-control", 2, FAIL, 0),
				"stage-judge call metrics",
			),
			repRecord("case-1-control", 3, FAIL, 0),
			repRecord("case-1-control", 4, FAIL, 0),
		];
		const report = buildComparisonResources({
			contract: {
				mode: "pipeline",
				declaredStages: ["discuss", "build"],
				reps: 4,
			},
			cases: [
				{
					caseId: "case-1",
					arms: {
						baseline: qualityReps(
							"case-1",
							"baseline",
							[PASS, PASS, PASS, PASS],
							1,
						),
						candidate: qualityReps(
							"case-1",
							"candidate",
							[PASS, PASS, PASS, PASS],
							2,
						),
						control: caseOneControl,
					},
				},
				{
					caseId: "case-2",
					arms: {
						baseline: qualityReps(
							"case-2",
							"baseline",
							[PASS, PASS, PASS, PASS],
							1,
						),
						candidate: qualityReps(
							"case-2",
							"candidate",
							[PASS, PASS, PASS, PASS],
							3,
						),
						control: qualityReps(
							"case-2",
							"control",
							[FAIL, FAIL, FAIL, FAIL],
							0,
						),
					},
				},
			],
		});

		expect(report.cases[0]?.arms.candidate).toMatchObject({
			status: "AVAILABLE",
			completeReps: 4,
			missingMetricReps: 0,
			total: {
				costUsd: { values: [2, 4, 6, 8], mean: 5 },
				inputTokens: { values: [20, 40, 60, 80], mean: 50 },
				outputTokens: { values: [4, 8, 12, 16], mean: 10 },
				cacheReadTokens: { values: [6, 12, 18, 24], mean: 15 },
				cacheWriteTokens: { values: [8, 16, 24, 32], mean: 20 },
			},
			workerTurns: { values: [2, 4, 6, 8], mean: 5 },
		});
		expect(report.cases[0]?.arms.control).toEqual({
			status: "UNAVAILABLE",
			completeReps: 3,
			missingMetricReps: 1,
			missingEvidence: [
				{
					repId: "case-1-control-rep-2",
					ordinal: 2,
					missing: ["stage-judge call metrics"],
				},
			],
		});
		expect(report.contrasts.candidateMinusBaseline.resources).toMatchObject({
			status: "AVAILABLE",
			total: {
				costUsd: {
					caseDeltas: [
						{ caseId: "case-1", value: 2.5 },
						{ caseId: "case-2", value: 5 },
					],
					meanDelta: 3.75,
					standardError: 1.25,
				},
			},
		});
		expect(report.contrasts.candidateMinusControl.resources).toEqual({
			status: "UNAVAILABLE",
			missingEvidence: [
				{
					caseId: "case-1",
					arm: "control",
					repId: "case-1-control-rep-2",
					ordinal: 2,
					missing: ["stage-judge call metrics"],
				},
			],
		});
		expect(report.contrasts.baselineMinusControl.resources.status).toBe(
			"UNAVAILABLE",
		);
	});
});

describe(buildComparisonReport.name, () => {
	it("records strict versioned results and all frozen source provenance", () => {
		const report = buildComparisonReport(reportEvidence());
		const candidate = report.cases.at(0)?.arms.candidate;

		expect(parseComparisonReport(JSON.stringify(report))).toEqual(report);
		expect(report.schemaVersion).toBe(1);
		expect(report.manifest).toEqual({ sha256: "8".repeat(64) });
		expect(report.mode).toBe("pipeline");
		expect(report.declaredStages).toEqual(["discuss", "build"]);
		expect(report.reps).toBe(4);
		expect(candidate?.role).toBe("candidate");
		expect(candidate?.source.group).toEqual({
			path: "groups/case-1-candidate/group.json",
			sha256: "6".repeat(64),
		});
		expect(candidate?.source.reps.at(0)).toEqual({
			repId: "case-1-candidate-rep-1",
			ordinal: 1,
			path: "groups/case-1-candidate/reps/case-1-candidate-rep-1/rep.json",
			sha256: "7".repeat(64),
		});
		expect(candidate?.executedCorpus).toEqual([
			{
				path: "inputs/corpus/SKILL.md",
				sha256: "2".repeat(64),
			},
		]);
		expect(report.contrasts.candidateMinusBaseline.minuend).toBe("candidate");
		expect(report.contrasts.candidateMinusBaseline.subtrahend).toBe("baseline");
		expect(() =>
			parseComparisonReport(
				JSON.stringify({ ...report, unexpected: "not strict" }),
			),
		).toThrow();
	});
});
