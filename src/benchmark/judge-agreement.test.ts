import { describe, expect, it } from "bun:test";
import {
	buildJudgeAgreementReport,
	type JudgeAgreementObservation,
} from "./judge-agreement";

describe(buildJudgeAgreementReport.name, () => {
	it("reports raw agreement counts and Cohen's kappa", () => {
		const baseline = {
			judgeModel: "opus",
			stage: "build",
			rubricSha256: "a".repeat(64),
			rubricId: "correctness",
		};
		const observations: readonly JudgeAgreementObservation[] = [
			{ ...baseline, judgeDecision: "PASS", humanDecision: "PASS" },
			{ ...baseline, judgeDecision: "PASS", humanDecision: "PASS" },
			{ ...baseline, judgeDecision: "FAIL", humanDecision: "FAIL" },
			{ ...baseline, judgeDecision: "FAIL", humanDecision: "FAIL" },
			{ ...baseline, judgeDecision: "PASS", humanDecision: "FAIL" },
			{ ...baseline, judgeDecision: "FAIL", humanDecision: "PASS" },
		];

		const report = buildJudgeAgreementReport(observations, 0);

		expect(report).toEqual({
			skippedCalibrations: 0,
			baselines: [
				{
					judgeModel: "opus",
					stage: "build",
					rubricSha256: "a".repeat(64),
					criteria: [
						{
							rubricId: "correctness",
							sampleSize: 6,
							judgePassHumanPass: 2,
							judgeFailHumanFail: 2,
							judgePassHumanFail: 1,
							judgeFailHumanPass: 1,
							observedAgreement: 2 / 3,
							cohensKappa: 1 / 3,
						},
					],
				},
			],
		});
	});
});
