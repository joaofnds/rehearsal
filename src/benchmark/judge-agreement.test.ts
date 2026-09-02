import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildJudgeAgreementReport,
	calibrationObservations,
	finalRubricSha256,
	loadJudgeAgreementReport,
	stageRubricSha256,
} from "./judge-agreement";
import type { JudgeAgreementObservation } from "./judge-agreement";
import type {
	HumanReview,
	JudgeGrade,
	StageGrade,
	StageRubric,
} from "./contracts";

const stageEvidence = [
	{ source: "task" as const, path: "task.md", claim: "fixture evidence" },
];
const finalEvidence = [
	{ source: "diff" as const, path: "change.diff", claim: "fixture evidence" },
];

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

	it("reports null kappa when expected agreement is one", () => {
		const observations: readonly JudgeAgreementObservation[] = [
			{
				judgeModel: "opus",
				stage: "final",
				rubricSha256: "a".repeat(64),
				rubricId: "correctness",
				judgeDecision: "PASS",
				humanDecision: "PASS",
			},
		];

		const report = buildJudgeAgreementReport(observations, 0);

		expect(report.baselines[0]?.criteria[0]).toMatchObject({
			sampleSize: 1,
			observedAgreement: 1,
			cohensKappa: null,
		});
	});

	it("keeps model, rubric, stage, and criterion identities separate", () => {
		const observations: readonly JudgeAgreementObservation[] = [
			{
				judgeModel: "sonnet",
				stage: "build",
				rubricSha256: "b".repeat(64),
				rubricId: "second",
				judgeDecision: "PASS",
				humanDecision: "PASS",
			},
			{
				judgeModel: "opus",
				stage: "shape",
				rubricSha256: "a".repeat(64),
				rubricId: "second",
				judgeDecision: "PASS",
				humanDecision: "PASS",
			},
			{
				judgeModel: "opus",
				stage: "build",
				rubricSha256: "b".repeat(64),
				rubricId: "second",
				judgeDecision: "PASS",
				humanDecision: "PASS",
			},
			{
				judgeModel: "opus",
				stage: "build",
				rubricSha256: "a".repeat(64),
				rubricId: "second",
				judgeDecision: "PASS",
				humanDecision: "PASS",
			},
			{
				judgeModel: "opus",
				stage: "build",
				rubricSha256: "a".repeat(64),
				rubricId: "first",
				judgeDecision: "PASS",
				humanDecision: "PASS",
			},
		];

		const report = buildJudgeAgreementReport(observations, 0);

		expect(
			report.baselines.map((baseline) => ({
				judgeModel: baseline.judgeModel,
				stage: baseline.stage,
				rubricSha256: baseline.rubricSha256,
				rubricIds: baseline.criteria.map(({ rubricId }) => rubricId),
			})),
		).toEqual([
			{
				judgeModel: "opus",
				stage: "build",
				rubricSha256: "a".repeat(64),
				rubricIds: ["first", "second"],
			},
			{
				judgeModel: "opus",
				stage: "build",
				rubricSha256: "b".repeat(64),
				rubricIds: ["second"],
			},
			{
				judgeModel: "opus",
				stage: "shape",
				rubricSha256: "a".repeat(64),
				rubricIds: ["second"],
			},
			{
				judgeModel: "sonnet",
				stage: "build",
				rubricSha256: "b".repeat(64),
				rubricIds: ["second"],
			},
		]);
	});
});

describe(calibrationObservations.name, () => {
	it("labels every original stage and final rubric decision", () => {
		const rubric = {
			hardBlockers: [{ id: "caught", description: "caught blocker" }],
			requirements: [
				{ id: "missed", description: "missed requirement" },
				{ id: "agreed-fail", description: "agreed failure" },
			],
			dimensions: [
				{
					id: "false-positive",
					description: "false positive dimension",
					good: "good",
					excellent: "excellent",
				},
				{
					id: "agreed-pass",
					description: "agreed passing dimension",
					good: "good",
					excellent: "excellent",
				},
			],
		} satisfies StageRubric;
		const grade = {
			hardBlockers: [{ id: "caught", status: "FAIL", evidence: stageEvidence }],
			requirements: [
				{ id: "missed", status: "PASS", evidence: stageEvidence },
				{ id: "agreed-fail", status: "FAIL", evidence: stageEvidence },
			],
			dimensions: [
				{ id: "false-positive", grade: "C", evidence: stageEvidence },
				{ id: "agreed-pass", grade: "A", evidence: stageEvidence },
			],
			summary: "stage grade",
			grade: "F",
			verdict: "STOP",
		} satisfies StageGrade;
		const finalRubric = "# Final rubric\n\n- final-missed\n- final-pass\n";
		const finalGrade = {
			requirements: [
				{ id: "final-missed", status: "PASS", evidence: finalEvidence },
				{ id: "final-pass", status: "PASS", evidence: finalEvidence },
			],
			verdict: "PASS",
			summary: "final grade",
		} satisfies JudgeGrade;
		const humanReview = {
			verdict: "REJECT",
			summary: "calibrated all decisions",
			findings: [
				{
					description: "caught",
					paths: ["caught.ts"],
					stage: "build",
					judgeAssessment: "CAUGHT",
					rubricId: "caught",
				},
				{
					description: "missed",
					paths: ["missed.ts"],
					stage: "build",
					judgeAssessment: "MISSED",
					rubricId: "missed",
				},
				{
					description: "false positive",
					paths: ["false-positive.ts"],
					stage: "build",
					judgeAssessment: "FALSE_POSITIVE",
					rubricId: "false-positive",
				},
				{
					description: "not promoted",
					paths: ["note.ts"],
					stage: "build",
					judgeAssessment: "NOT_PROMOTED",
					rubricId: null,
				},
				{
					description: "final missed",
					paths: ["final.ts"],
					stage: "final",
					judgeAssessment: "MISSED",
					rubricId: "final-missed",
				},
			],
		} satisfies HumanReview;

		const observations = calibrationObservations({
			judgeModel: "opus",
			humanReview,
			stages: [{ stage: "build", rubric, grade }],
			final: { rubric: finalRubric, grade: finalGrade },
		});

		expect(observations).toEqual([
			{
				judgeModel: "opus",
				stage: "build",
				rubricSha256: stageRubricSha256(rubric),
				rubricId: "caught",
				judgeDecision: "FAIL",
				humanDecision: "FAIL",
			},
			{
				judgeModel: "opus",
				stage: "build",
				rubricSha256: stageRubricSha256(rubric),
				rubricId: "missed",
				judgeDecision: "PASS",
				humanDecision: "FAIL",
			},
			{
				judgeModel: "opus",
				stage: "build",
				rubricSha256: stageRubricSha256(rubric),
				rubricId: "agreed-fail",
				judgeDecision: "FAIL",
				humanDecision: "FAIL",
			},
			{
				judgeModel: "opus",
				stage: "build",
				rubricSha256: stageRubricSha256(rubric),
				rubricId: "false-positive",
				judgeDecision: "FAIL",
				humanDecision: "PASS",
			},
			{
				judgeModel: "opus",
				stage: "build",
				rubricSha256: stageRubricSha256(rubric),
				rubricId: "agreed-pass",
				judgeDecision: "PASS",
				humanDecision: "PASS",
			},
			{
				judgeModel: "opus",
				stage: "final",
				rubricSha256: finalRubricSha256(finalRubric),
				rubricId: "final-missed",
				judgeDecision: "PASS",
				humanDecision: "FAIL",
			},
			{
				judgeModel: "opus",
				stage: "final",
				rubricSha256: finalRubricSha256(finalRubric),
				rubricId: "final-pass",
				judgeDecision: "PASS",
				humanDecision: "PASS",
			},
		]);
	});

	it("keeps real defects when a criterion also has a false positive", () => {
		const findings = [
			{
				description: "caught defect",
				paths: ["caught.ts"],
				stage: "final" as const,
				judgeAssessment: "CAUGHT" as const,
				rubricId: "criterion",
			},
			{
				description: "separate false positive",
				paths: ["false-positive.ts"],
				stage: "final" as const,
				judgeAssessment: "FALSE_POSITIVE" as const,
				rubricId: "criterion",
			},
		];
		const humanDecisions = [findings, findings.toReversed()].map(
			(orderedFindings) =>
				calibrationObservations({
					judgeModel: "opus",
					humanReview: {
						verdict: "REJECT",
						summary: "reviewed both findings",
						findings: orderedFindings,
					},
					stages: [],
					final: {
						rubric: "1. `criterion`: contract\n",
						grade: {
							requirements: [
								{ id: "criterion", status: "FAIL", evidence: finalEvidence },
							],
							verdict: "FAIL",
							summary: "failed criterion",
						},
					},
				})[0]?.humanDecision,
		);

		expect(humanDecisions).toEqual(["FAIL", "FAIL"]);
	});

	it.each([
		{ grade: "A" as const, decision: "PASS" },
		{ grade: "B" as const, decision: "PASS" },
		{ grade: "C" as const, decision: "FAIL" },
		{ grade: "D" as const, decision: "FAIL" },
		{ grade: "F" as const, decision: "FAIL" },
	])("maps dimension grade $grade to $decision", ({ grade, decision }) => {
		const [observation] = calibrationObservations({
			judgeModel: "opus",
			humanReview: {
				verdict: "REJECT",
				summary: "note does not alter the decision",
				findings: [
					{
						description: "non-rubric note",
						paths: ["note.ts"],
						stage: "build",
						judgeAssessment: "NOT_PROMOTED",
						rubricId: "dimension",
					},
				],
			},
			stages: [
				{
					stage: "build",
					rubric: {
						hardBlockers: [],
						requirements: [],
						dimensions: [
							{
								id: "dimension",
								description: "dimension contract",
								good: "good",
								excellent: "excellent",
							},
						],
					},
					grade: {
						hardBlockers: [],
						requirements: [],
						dimensions: [{ id: "dimension", grade, evidence: stageEvidence }],
						summary: "dimension grade",
						grade,
						verdict: "STOP",
					},
				},
			],
		});

		expect(observation).toMatchObject({
			judgeDecision: decision,
			humanDecision: decision,
		});
	});
});

describe(loadJudgeAgreementReport.name, () => {
	let runsDirectory: string;

	beforeEach(async () => {
		runsDirectory = await mkdtemp(join(tmpdir(), "judge-agreement-"));
	});

	afterEach(async () => {
		await rm(runsDirectory, { force: true, recursive: true });
	});

	it("joins historical stages to manifests and skips unknown Judge models", async () => {
		const stageArtifact = {
			stage: "shape",
			rubric: {
				hardBlockers: [],
				requirements: [{ id: "goal", description: "state the goal" }],
				dimensions: [
					{
						id: "clarity",
						description: "write clearly",
						good: "clear",
						excellent: "precise",
					},
				],
			},
			grade: {
				hardBlockers: [],
				requirements: [{ id: "goal", status: "PASS", evidence: stageEvidence }],
				dimensions: [{ id: "clarity", grade: "A", evidence: stageEvidence }],
				summary: "clear goal",
				grade: "A",
				verdict: "CONTINUE",
			},
			calibration: {
				humanReview: {
					verdict: "ACCEPT",
					summary: "agrees with both decisions",
					findings: [],
				},
			},
		};
		await Bun.write(
			join(runsDirectory, "future.shape.json"),
			JSON.stringify({ ...stageArtifact, judgeModel: "opus" }),
		);
		await mkdir(join(runsDirectory, "historical.checkpoints"));
		await Bun.write(
			join(runsDirectory, "historical.checkpoints", "manifest.json"),
			JSON.stringify({ judgeModel: "opus" }),
		);
		await Bun.write(
			join(runsDirectory, "historical.shape.json"),
			JSON.stringify(stageArtifact),
		);
		const { calibration: _calibration, ...priorStageArtifact } = stageArtifact;
		await Bun.write(
			join(runsDirectory, "historical.discuss.json"),
			JSON.stringify({ ...priorStageArtifact, stage: "discuss" }),
		);
		await Bun.write(
			join(runsDirectory, "pre-manifest.shape.json"),
			JSON.stringify(stageArtifact),
		);

		const report = await loadJudgeAgreementReport(runsDirectory);

		expect(report).toMatchObject({
			skippedCalibrations: 1,
			baselines: [
				{
					judgeModel: "opus",
					stage: "discuss",
					criteria: [
						{
							rubricId: "clarity",
							sampleSize: 1,
							judgePassHumanPass: 1,
						},
						{
							rubricId: "goal",
							sampleSize: 1,
							judgePassHumanPass: 1,
						},
					],
				},
				{
					judgeModel: "opus",
					stage: "shape",
					criteria: [
						{
							rubricId: "clarity",
							sampleSize: 2,
							judgePassHumanPass: 2,
						},
						{
							rubricId: "goal",
							sampleSize: 2,
							judgePassHumanPass: 2,
						},
					],
				},
			],
		});
	});

	it("includes an unwritten current calibration exactly once", async () => {
		const report = await loadJudgeAgreementReport(runsDirectory, [
			{
				judgeModel: "opus",
				humanReview: {
					verdict: "ACCEPT",
					summary: "agrees with the decision",
					findings: [],
				},
				stages: [],
				final: {
					rubric: "1. `criterion`: contract\n",
					grade: {
						requirements: [
							{ id: "criterion", status: "PASS", evidence: finalEvidence },
						],
						verdict: "PASS",
						summary: "passed criterion",
					},
				},
			},
		]);

		expect(report.baselines).toMatchObject([
			{
				judgeModel: "opus",
				stage: "final",
				criteria: [
					{
						rubricId: "criterion",
						sampleSize: 1,
						judgePassHumanPass: 1,
					},
				],
			},
		]);
	});
});
