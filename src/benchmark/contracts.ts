import { z } from "zod";
import type { Effort, WorkflowStage } from "./config";

export const evidenceSchema = z.object({
	source: z.enum(["diff", "baseline-context", "local-checks"]),
	path: z.string().min(1),
	claim: z.string().min(1),
});

export const judgeGradeSchema = z.object({
	requirements: z.array(
		z.object({
			id: z.string().min(1),
			status: z.enum(["PASS", "FAIL"]),
			evidence: z.array(evidenceSchema).min(1),
		}),
	),
	verdict: z.enum(["PASS", "FAIL"]),
	summary: z.string().min(1),
});

export const stageTurnSchema = z.object({
	status: z
		.enum(["QUESTION", "COMPLETE"])
		.describe(
			"QUESTION when product input is required; COMPLETE only after the native skill has finished and saved its durable artifact",
		),
	message: z
		.string()
		.min(1)
		.describe(
			"One question with its recommendation and context, or a concise completion summary",
		),
});

export const productAnswerSchema = z.object({
	answer: z.string().min(1),
});

export const humanFindingSchema = z
	.object({
		description: z.string().min(1),
		paths: z.array(z.string().min(1)),
		judgeAssessment: z.enum([
			"CAUGHT",
			"MISSED",
			"FALSE_POSITIVE",
			"NOT_PROMOTED",
		]),
		rubricId: z.string().min(1).nullable(),
	})
	.superRefine((finding, context) => {
		if (finding.judgeAssessment === "NOT_PROMOTED" || finding.rubricId) return;

		context.addIssue({
			code: "custom",
			message: "Judge-related findings require a rubric ID",
			path: ["rubricId"],
		});
	});

export const humanReviewSchema = z.object({
	verdict: z.enum(["ACCEPT", "REJECT"]),
	summary: z.string().min(1),
	findings: z.array(humanFindingSchema),
});

export const claudeEnvelopeSchema = z
	.object({
		session_id: z.string().min(1),
		total_cost_usd: z.number().nonnegative().optional(),
		is_error: z.boolean().optional(),
		result: z.string().optional(),
		structured_output: z.unknown().optional(),
	})
	.passthrough();

export const judgeEnvelopeSchema = z
	.object({
		structured_output: judgeGradeSchema.optional(),
		result: z.string().optional(),
	})
	.passthrough();

export type JudgeGrade = z.infer<typeof judgeGradeSchema>;
export type HumanReview = z.infer<typeof humanReviewSchema>;
export type StageTurn = z.infer<typeof stageTurnSchema>;
export type ClaudeEnvelope = z.infer<typeof claudeEnvelopeSchema>;

export interface ContextFile {
	readonly path: string;
	readonly content: string;
}

export interface LocalCheckResult {
	readonly status: "PASS" | "FAIL";
	readonly evidence: z.infer<typeof evidenceSchema>[];
}

export interface StageExchange {
	readonly agent: StageTurn;
	readonly productOwnerAnswer?: string;
}

export interface StageTranscript {
	readonly stage: WorkflowStage;
	readonly sessionId: string;
	readonly costUsd: number;
	readonly exchanges: readonly StageExchange[];
}

export interface CalibrationResult {
	readonly humanReview: HumanReview;
	readonly instructionsChanged: boolean;
	readonly updatedInstructions?: string;
	readonly rubricChanged: boolean;
	readonly updatedRubric?: string;
	readonly revisedRubricIds?: readonly string[];
	readonly revisedJudgePrompt?: string;
	readonly revisedGrade?: JudgeGrade;
	readonly rejudgeConfirmedByHuman?: boolean;
}

export interface RunArtifact {
	readonly status: "AWAITING_HUMAN_REVIEW" | "COMPLETE";
	readonly timestamp: string;
	readonly controlSha: string;
	readonly sourceRoot: string;
	readonly sourceOrigin?: string;
	readonly sourceSha: string;
	readonly taskSha: string;
	readonly resultSha: string;
	readonly model: string;
	readonly effort?: Effort;
	readonly judgeModel: string;
	readonly judgeEffort?: Effort;
	readonly sessionBudgetUsd: number;
	readonly bunVersion: string;
	readonly claudeVersion: string;
	readonly task: string;
	readonly productBrief: string;
	readonly instructions: string;
	readonly rubric: string;
	readonly rubricIds: readonly string[];
	readonly baselineContext: readonly ContextFile[];
	readonly taskId: string;
	readonly productOwnerSessionId: string;
	readonly productOwnerCostUsd: number;
	readonly workflow: readonly StageTranscript[];
	readonly taskState: string;
	readonly judgePrompt: string;
	readonly diff: string;
	readonly checkIntegrity: LocalCheckResult;
	readonly localChecks: LocalCheckResult;
	readonly grade: JudgeGrade;
	readonly reviewFile: string;
	readonly calibration?: CalibrationResult;
}

export function claudeJsonSchema(schema: z.ZodType) {
	const compatibleEntries = Object.entries(z.toJSONSchema(schema)).filter(
		([key]) => key !== "$schema",
	);

	return JSON.stringify(Object.fromEntries(compatibleEntries));
}
