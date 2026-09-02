import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type {
	HumanReview,
	JudgeGrade,
	StageGrade,
	StageRubric,
} from "./contracts";
import {
	humanReviewSchema,
	judgeGradeSchema,
	stageJudgeOutputSchema,
	stageLetterGradeSchema,
	stageRubricSchema,
} from "./contracts";

export type AgreementDecision = "PASS" | "FAIL";

export interface JudgeAgreementObservation {
	readonly judgeModel: string;
	readonly stage: string;
	readonly rubricSha256: string;
	readonly rubricId: string;
	readonly judgeDecision: AgreementDecision;
	readonly humanDecision: AgreementDecision;
}

export interface JudgeAgreementCriterion {
	readonly rubricId: string;
	readonly sampleSize: number;
	readonly judgePassHumanPass: number;
	readonly judgeFailHumanFail: number;
	readonly judgePassHumanFail: number;
	readonly judgeFailHumanPass: number;
	readonly observedAgreement: number;
	readonly cohensKappa: number | null;
}

export interface JudgeAgreementBaseline {
	readonly judgeModel: string;
	readonly stage: string;
	readonly rubricSha256: string;
	readonly criteria: readonly JudgeAgreementCriterion[];
}

export interface JudgeAgreementReport {
	readonly skippedCalibrations: number;
	readonly baselines: readonly JudgeAgreementBaseline[];
}

const judgeAgreementCriterionSchema = z
	.object({
		rubricId: z.string().min(1),
		sampleSize: z.number().int().positive(),
		judgePassHumanPass: z.number().int().nonnegative(),
		judgeFailHumanFail: z.number().int().nonnegative(),
		judgePassHumanFail: z.number().int().nonnegative(),
		judgeFailHumanPass: z.number().int().nonnegative(),
		observedAgreement: z.number().min(0).max(1),
		cohensKappa: z.number().min(-1).max(1).nullable(),
	})
	.strict();
const judgeAgreementBaselineSchema = z
	.object({
		judgeModel: z.string().min(1),
		stage: z.string().min(1),
		rubricSha256: z.string().regex(/^[0-9a-f]{64}$/u),
		criteria: z.array(judgeAgreementCriterionSchema).min(1),
	})
	.strict();
export const judgeAgreementReportSchema = z
	.object({
		skippedCalibrations: z.number().int().nonnegative(),
		baselines: z.array(judgeAgreementBaselineSchema),
	})
	.strict();

export interface CalibratedStage {
	readonly stage: string;
	readonly rubric: StageRubric;
	readonly grade: StageGrade;
}

export interface CalibratedFinal {
	readonly rubric: string;
	readonly grade: JudgeGrade;
}

export interface JudgeAgreementCalibration {
	readonly judgeModel: string;
	readonly humanReview: HumanReview;
	readonly stages: readonly CalibratedStage[];
	readonly final?: CalibratedFinal | undefined;
}

const stageGradeSchema = stageJudgeOutputSchema.extend({
	grade: stageLetterGradeSchema,
	verdict: z.enum(["CONTINUE", "STOP"]),
});
const calibrationSchema = z.object({ humanReview: humanReviewSchema }).loose();
const calibratedStageArtifactSchema = z
	.object({
		stage: z.string().min(1),
		judgeModel: z.string().min(1).optional(),
		rubric: stageRubricSchema,
		grade: stageGradeSchema,
		calibration: calibrationSchema,
	})
	.loose();
const stageScorecardSchema = calibratedStageArtifactSchema.omit({
	judgeModel: true,
	calibration: true,
});
const calibratedFinalArtifactSchema = z
	.object({
		status: z.literal("COMPLETE"),
		judgeModel: z.string().min(1),
		rubric: z.string().min(1),
		grade: judgeGradeSchema,
		stageScorecards: z.array(stageScorecardSchema),
		calibration: calibrationSchema,
	})
	.loose();
const judgeManifestSchema = z.object({ judgeModel: z.string().min(1) }).loose();

interface MutableCriterionCounts {
	judgePassHumanPass: number;
	judgeFailHumanFail: number;
	judgePassHumanFail: number;
	judgeFailHumanPass: number;
}

interface MutableBaseline {
	readonly judgeModel: string;
	readonly stage: string;
	readonly rubricSha256: string;
	readonly criteria: Map<string, MutableCriterionCounts>;
}

function compareText(left: string, right: string): number {
	if (left < right) {
		return -1;
	}
	if (left > right) {
		return 1;
	}

	return 0;
}

function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

export function stageRubricSha256(rubric: StageRubric): string {
	return sha256(JSON.stringify(rubric));
}

export function finalRubricSha256(rubric: string): string {
	return sha256(rubric);
}

function humanDecision(
	review: HumanReview,
	stage: string,
	rubricId: string,
	judgeDecision: AgreementDecision,
): AgreementDecision {
	const finding = review.findings.find(
		(candidate) =>
			candidate.stage === stage &&
			candidate.rubricId === rubricId &&
			candidate.judgeAssessment !== "NOT_PROMOTED",
	);
	if (finding === undefined) {
		return judgeDecision;
	}
	if (finding.judgeAssessment === "FALSE_POSITIVE") {
		return "PASS";
	}

	return "FAIL";
}

function stageDecision(grade: StageGrade, rubricId: string): AgreementDecision {
	const blocker = grade.hardBlockers.find(({ id }) => id === rubricId);
	if (blocker !== undefined) {
		return blocker.status;
	}
	const requirement = grade.requirements.find(({ id }) => id === rubricId);
	if (requirement !== undefined) {
		return requirement.status;
	}
	const dimension = grade.dimensions.find(({ id }) => id === rubricId);
	if (dimension !== undefined) {
		return dimension.grade === "A" || dimension.grade === "B" ? "PASS" : "FAIL";
	}

	throw new Error(`Stage grade is missing rubric criterion ${rubricId}`);
}

function stageObservations(
	judgeModel: string,
	review: HumanReview,
	stage: Readonly<CalibratedStage>,
): readonly JudgeAgreementObservation[] {
	const rubricSha256 = stageRubricSha256(stage.rubric);
	const rubricIds = [
		...stage.rubric.hardBlockers,
		...stage.rubric.requirements,
		...stage.rubric.dimensions,
	].map(({ id }) => id);

	return rubricIds.map((rubricId) => {
		const judgeDecision = stageDecision(stage.grade, rubricId);

		return {
			judgeModel,
			stage: stage.stage,
			rubricSha256,
			rubricId,
			judgeDecision,
			humanDecision: humanDecision(
				review,
				stage.stage,
				rubricId,
				judgeDecision,
			),
		};
	});
}

function finalObservations(
	judgeModel: string,
	review: HumanReview,
	final: Readonly<CalibratedFinal>,
): readonly JudgeAgreementObservation[] {
	const rubricSha256 = finalRubricSha256(final.rubric);

	return final.grade.requirements.map(({ id: rubricId, status }) => ({
		judgeModel,
		stage: "final",
		rubricSha256,
		rubricId,
		judgeDecision: status,
		humanDecision: humanDecision(review, "final", rubricId, status),
	}));
}

export function calibrationObservations(
	input: Readonly<JudgeAgreementCalibration>,
): readonly JudgeAgreementObservation[] {
	const stages = input.stages.flatMap((stage) =>
		stageObservations(input.judgeModel, input.humanReview, stage),
	);
	if (input.final === undefined) {
		return stages;
	}

	return [
		...stages,
		...finalObservations(input.judgeModel, input.humanReview, input.final),
	];
}

async function readJson(path: string): Promise<unknown | undefined> {
	try {
		return JSON.parse(await Bun.file(path).text());
	} catch {
		return undefined;
	}
}

async function historicalStageJudgeModel(
	runsDirectory: string,
	fileName: string,
	stage: string,
): Promise<string | undefined> {
	const suffix = `.${stage}.json`;
	if (!fileName.endsWith(suffix)) {
		return undefined;
	}

	const runName = fileName.slice(0, -suffix.length);
	const document = await readJson(
		join(runsDirectory, `${runName}.checkpoints`, "manifest.json"),
	);
	const manifest = judgeManifestSchema.safeParse(document);

	return manifest.success ? manifest.data.judgeModel : undefined;
}

export async function loadJudgeAgreementReport(
	runsDirectory: string,
	currentCalibrations: readonly Readonly<JudgeAgreementCalibration>[] = [],
): Promise<JudgeAgreementReport> {
	const observations = currentCalibrations.flatMap((calibration) =>
		calibrationObservations(calibration),
	);
	let skippedCalibrations = 0;
	const entries = await readdir(runsDirectory, { withFileTypes: true });
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".json")) {
			continue;
		}

		const document = await readJson(join(runsDirectory, entry.name));
		const stage = calibratedStageArtifactSchema.safeParse(document);
		if (stage.success) {
			const judgeModel =
				stage.data.judgeModel ??
				(await historicalStageJudgeModel(
					runsDirectory,
					entry.name,
					stage.data.stage,
				));
			if (judgeModel === undefined) {
				skippedCalibrations += 1;
				continue;
			}

			observations.push(
				...calibrationObservations({
					judgeModel,
					humanReview: stage.data.calibration.humanReview,
					stages: [stage.data],
				}),
			);
			continue;
		}

		const final = calibratedFinalArtifactSchema.safeParse(document);
		if (final.success) {
			observations.push(
				...calibrationObservations({
					judgeModel: final.data.judgeModel,
					humanReview: final.data.calibration.humanReview,
					stages: final.data.stageScorecards,
					final: { rubric: final.data.rubric, grade: final.data.grade },
				}),
			);
		}
	}

	return buildJudgeAgreementReport(observations, skippedCalibrations);
}

export function filterJudgeAgreementReport(
	report: Readonly<JudgeAgreementReport>,
	judgeModels: readonly string[],
): JudgeAgreementReport {
	const included = new Set(judgeModels);

	return {
		skippedCalibrations: report.skippedCalibrations,
		baselines: report.baselines.filter(({ judgeModel }) =>
			included.has(judgeModel),
		),
	};
}

function summarizeCriterion(
	rubricId: string,
	counts: Readonly<MutableCriterionCounts>,
): JudgeAgreementCriterion {
	const sampleSize =
		counts.judgePassHumanPass +
		counts.judgeFailHumanFail +
		counts.judgePassHumanFail +
		counts.judgeFailHumanPass;
	const observedAgreement =
		(counts.judgePassHumanPass + counts.judgeFailHumanFail) / sampleSize;
	const kappaDenominator =
		(counts.judgePassHumanPass + counts.judgePassHumanFail) *
			(counts.judgePassHumanFail + counts.judgeFailHumanFail) +
		(counts.judgeFailHumanPass + counts.judgeFailHumanFail) *
			(counts.judgePassHumanPass + counts.judgeFailHumanPass);
	const cohensKappa =
		kappaDenominator === 0
			? null
			: (2 *
					(counts.judgePassHumanPass * counts.judgeFailHumanFail -
						counts.judgePassHumanFail * counts.judgeFailHumanPass)) /
				kappaDenominator;

	return {
		rubricId,
		sampleSize,
		...counts,
		observedAgreement,
		cohensKappa,
	};
}

function baselineKey(observation: Readonly<JudgeAgreementObservation>): string {
	return JSON.stringify([
		observation.judgeModel,
		observation.stage,
		observation.rubricSha256,
	]);
}

function incrementCounts(
	counts: MutableCriterionCounts,
	observation: Readonly<JudgeAgreementObservation>,
): void {
	if (observation.judgeDecision === "PASS") {
		if (observation.humanDecision === "PASS") {
			counts.judgePassHumanPass += 1;
		} else {
			counts.judgePassHumanFail += 1;
		}
	} else if (observation.humanDecision === "PASS") {
		counts.judgeFailHumanPass += 1;
	} else {
		counts.judgeFailHumanFail += 1;
	}
}

export function buildJudgeAgreementReport(
	observations: readonly Readonly<JudgeAgreementObservation>[],
	skippedCalibrations: number,
): JudgeAgreementReport {
	const baselines = new Map<string, MutableBaseline>();
	for (const observation of observations) {
		const key = baselineKey(observation);
		let baseline = baselines.get(key);
		if (baseline === undefined) {
			baseline = {
				judgeModel: observation.judgeModel,
				stage: observation.stage,
				rubricSha256: observation.rubricSha256,
				criteria: new Map(),
			};
			baselines.set(key, baseline);
		}

		let counts = baseline.criteria.get(observation.rubricId);
		if (counts === undefined) {
			counts = {
				judgePassHumanPass: 0,
				judgeFailHumanFail: 0,
				judgePassHumanFail: 0,
				judgeFailHumanPass: 0,
			};
			baseline.criteria.set(observation.rubricId, counts);
		}
		incrementCounts(counts, observation);
	}

	return {
		skippedCalibrations,
		baselines: [...baselines.values()]
			.toSorted(
				(left, right) =>
					compareText(left.judgeModel, right.judgeModel) ||
					compareText(left.stage, right.stage) ||
					compareText(left.rubricSha256, right.rubricSha256),
			)
			.map((baseline) => ({
				judgeModel: baseline.judgeModel,
				stage: baseline.stage,
				rubricSha256: baseline.rubricSha256,
				criteria: [...baseline.criteria.entries()]
					.toSorted(([left], [right]) => compareText(left, right))
					.map(([rubricId, counts]) => summarizeCriterion(rubricId, counts)),
			})),
	};
}
