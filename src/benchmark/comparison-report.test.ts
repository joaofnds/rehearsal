import { describe, expect, it } from "bun:test";
import { buildComparisonReport } from "./comparison-report";
import {
	parseComparisonReport,
	serializeComparisonReport,
} from "./comparison-record";
import { comparisonEvidenceFixture } from "./comparison-test-fixtures";

describe(buildComparisonReport.name, () => {
	it("records strict versioned results and all frozen source provenance", () => {
		const judgeAgreement = {
			skippedCalibrations: 1,
			baselines: [
				{
					judgeModel: "opus",
					stage: "final",
					rubricSha256: "9".repeat(64),
					criteria: [
						{
							rubricId: "correctness",
							sampleSize: 1,
							judgePassHumanPass: 1,
							judgeFailHumanFail: 0,
							judgePassHumanFail: 0,
							judgeFailHumanPass: 0,
							observedAgreement: 1,
							cohensKappa: null,
						},
					],
				},
			],
		};

		const report = buildComparisonReport(
			comparisonEvidenceFixture(),
			judgeAgreement,
		);
		const candidate = report.cases.at(0)?.arms.candidate;

		expect(parseComparisonReport(JSON.stringify(report))).toEqual(report);
		expect(serializeComparisonReport(report)).toBe(
			`${JSON.stringify(report, null, 2)}\n`,
		);
		expect(report.schemaVersion).toBe(2);
		expect(report.judgeAgreement).toEqual(judgeAgreement);
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

	it("parses persisted version-one reports strictly", () => {
		const current = buildComparisonReport(comparisonEvidenceFixture(), {
			skippedCalibrations: 0,
			baselines: [],
		});
		if (current.schemaVersion !== 2) {
			throw new Error("expected a stage or pipeline comparison report");
		}
		const { judgeAgreement: _judgeAgreement, ...reportWithoutAgreement } =
			current;
		const legacy = { ...reportWithoutAgreement, schemaVersion: 1 as const };

		expect(parseComparisonReport(JSON.stringify(legacy))).toEqual(legacy);
		expect(() =>
			parseComparisonReport(
				JSON.stringify({ ...legacy, unexpected: "not strict" }),
			),
		).toThrow();
	});
});
