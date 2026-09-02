import { describe, expect, it } from "bun:test";
import { buildComparisonQuality } from "./comparison-quality";
import { comparisonReps, FAIL, PASS } from "./comparison-test-fixtures";

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
						baseline: comparisonReps("case-1", "baseline", [
							PASS,
							PASS,
							FAIL,
							{
								discussion: "error",
								build: "not-reached",
								final: "not-reached",
							},
						]),
						candidate: comparisonReps("case-1", "candidate", [
							PASS,
							PASS,
							PASS,
							PASS,
						]),
						control: comparisonReps("case-1", "control", [
							FAIL,
							FAIL,
							FAIL,
							FAIL,
						]),
					},
				},
				{
					caseId: "case-2",
					arms: {
						baseline: comparisonReps("case-2", "baseline", [
							PASS,
							FAIL,
							FAIL,
							FAIL,
						]),
						candidate: comparisonReps("case-2", "candidate", [
							PASS,
							PASS,
							PASS,
							PASS,
						]),
						control: comparisonReps("case-2", "control", [
							FAIL,
							FAIL,
							FAIL,
							FAIL,
						]),
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
		expect(report.contrasts.candidateMinusControl.quality[0]).toEqual({
			name: "discuss",
			successRate: {
				caseDeltas: [
					{ caseId: "case-1", value: 1 },
					{ caseId: "case-2", value: 1 },
				],
				meanDelta: 1,
				standardError: 0,
			},
			passK: {
				caseDeltas: [
					{ caseId: "case-1", value: 1 },
					{ caseId: "case-2", value: 1 },
				],
				meanDelta: 1,
				standardError: 0,
			},
		});
		expect(report.contrasts.baselineMinusControl.quality[0]).toEqual({
			name: "discuss",
			successRate: {
				caseDeltas: [
					{ caseId: "case-1", value: 0.5 },
					{ caseId: "case-2", value: 0.25 },
				],
				meanDelta: 0.375,
				standardError: 0.125,
			},
			passK: {
				caseDeltas: [
					{ caseId: "case-1", value: 0.0625 },
					{ caseId: "case-2", value: 0.00390625 },
				],
				meanDelta: 0.033203125,
				standardError: 0.029296875,
			},
		});
	});
});
