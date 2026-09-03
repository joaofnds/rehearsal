import { z } from "zod";
import { effortSchema } from "./config";
import type { Immutable } from "./contracts";
import {
	evidenceSchema,
	judgeGradeSchema,
	stageGradeSchema,
	stageRubricSchema,
	judgeAttemptListSchema,
	stageJudgeInputSchema,
	stageScorecardSchema,
} from "./contracts";

/**
 * What `calibrate` reads back out of a run's own records: the frozen evidence
 * a rejudge is applied to, and the knobs the Judges ran under. Loose at the
 * top level, because the artifact carries far more than this and a reader that
 * refused the rest would refuse every artifact a later card adds a field to.
 *
 * The effort and the budget are optional because a stage record written before
 * they were recorded carries neither, and its evidence was still paid for. A
 * rejudge needs a budget and refuses when the record has none; a calibration
 * that rejudges nothing needs neither.
 */
const judgeKnobsSchema = z.object({
	judgeModel: z.string().min(1),
	judgeEffort: effortSchema.optional(),
	sessionBudgetUsd: z.number().positive().optional(),
});

const localCheckResultSchema = z.object({
	status: z.enum(["PASS", "FAIL"]),
	evidence: z.array(evidenceSchema),
});

export const calibratableArtifactSchema = judgeKnobsSchema
	.extend({
		status: z.enum(["AWAITING_HUMAN_REVIEW", "COMPLETE", "FAILED"]),
		caseId: z.string().min(1),
		sourceRoot: z.string().min(1),
		resultSha: z.string().min(1),
		instructions: z.string(),
		rubric: z.string().min(1),
		grade: judgeGradeSchema,
		baselineContext: z.array(
			z.object({ path: z.string(), content: z.string() }),
		),
		diff: z.string(),
		changedPaths: z.array(z.string()),
		checkIntegrity: localCheckResultSchema,
		localChecks: localCheckResultSchema,
		stageScorecards: z.array(stageScorecardSchema),
		reviewFile: z.string().min(1),
	})
	.loose();

/**
 * A stopped stage's own record. It carries the Judge model only since the
 * card that started recording it, and `calibrate` needs one to name the
 * agreement baseline, so a record without it is refused rather than guessed.
 */
export const calibratableStageRecordSchema = judgeKnobsSchema
	.extend({
		stage: z.string().min(1),
		rubricPath: z.string().min(1),
		rubric: stageRubricSchema,
		input: stageJudgeInputSchema,
		prompt: z.string(),
		attempts: judgeAttemptListSchema,
		costUsd: z.number(),
		grade: stageGradeSchema,
		calibration: z.unknown().optional(),
	})
	.loose();

export type CalibratableArtifact = Immutable<
	z.infer<typeof calibratableArtifactSchema>
>;

export type CalibratableStageRecord = Immutable<
	z.infer<typeof calibratableStageRecordSchema>
>;
