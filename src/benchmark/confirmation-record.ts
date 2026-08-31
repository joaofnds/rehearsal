import { z } from "zod";
import { claudeCallMetricsSchema, stageLetterGradeSchema } from "./contracts";

const identitySchema = z
	.string()
	.regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u, "Invalid confirmation identity");
const shaSchema = z.string().regex(/^[0-9a-f]{40}$/u, "Invalid Git SHA");
const elapsedSchema = z.number().nonnegative();

const resultEvidenceSchema = z
	.object({
		resultSha: shaSchema,
		recordFile: z.string().min(1),
	})
	.strict();

const judgedStageSchema = z
	.object({
		stage: z.string().min(1),
		status: z.literal("JUDGED"),
		grade: stageLetterGradeSchema,
		verdict: z.enum(["CONTINUE", "STOP"]),
		elapsedMs: elapsedSchema,
		evidence: resultEvidenceSchema,
	})
	.strict();

const failedStageSchema = z
	.object({
		stage: z.string().min(1),
		status: z.enum(["EXECUTION_FAILED", "METRICS_MISSING"]),
		elapsedMs: elapsedSchema.optional(),
		error: z.string().min(1),
		worktreePath: z.string().min(1).optional(),
	})
	.strict();

const notReachedStageSchema = z
	.object({
		stage: z.string().min(1),
		status: z.literal("NOT_REACHED"),
		reason: z.string().min(1),
	})
	.strict();

const stageOutcomeSchema = z.union([
	judgedStageSchema,
	failedStageSchema,
	notReachedStageSchema,
]);

const finalOutcomeSchema = z.union([
	z
		.object({
			status: z.literal("JUDGED"),
			verdict: z.enum(["PASS", "FAIL"]),
			evidence: resultEvidenceSchema,
		})
		.strict(),
	z
		.object({
			status: z.enum(["EXECUTION_FAILED", "METRICS_MISSING"]),
			error: z.string().min(1),
			worktreePath: z.string().min(1).optional(),
		})
		.strict(),
	z
		.object({
			status: z.literal("NOT_REACHED"),
			reason: z.string().min(1),
		})
		.strict(),
	z.object({ status: z.literal("NOT_APPLICABLE") }).strict(),
]);

const callEvidenceSchema = z
	.object({
		role: z.enum(["worker", "product-owner", "stage-judge", "final-judge"]),
		metrics: claudeCallMetricsSchema,
	})
	.strict();

const metricsEvidenceSchema = z.discriminatedUnion("status", [
	z
		.object({
			status: z.literal("COMPLETE"),
			calls: z.array(callEvidenceSchema).min(1),
		})
		.strict(),
	z
		.object({
			status: z.literal("MISSING"),
			calls: z.array(callEvidenceSchema),
			missing: z.array(z.string().min(1)).min(1),
		})
		.strict(),
]);

const lineageSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("SOURCE"), sha: shaSchema }).strict(),
	z
		.object({
			kind: z.literal("CHECKPOINT"),
			lineage: z.string().min(1),
			targetSha: shaSchema,
		})
		.strict(),
]);

export const confirmationRepRecordSchema = z
	.object({
		schemaVersion: z.literal(1),
		groupId: identitySchema,
		repId: identitySchema,
		ordinal: z.number().int().positive(),
		mode: z.enum(["stage", "pipeline"]),
		worktreePath: z.string().min(1),
		lineage: lineageSchema,
		outcome: z.enum(["SUCCESSFUL", "UNSUCCESSFUL"]),
		stages: z.array(stageOutcomeSchema).min(1),
		finalOutcome: finalOutcomeSchema,
		metrics: metricsEvidenceSchema,
		workerTrajectorySteps: z.number().int().nonnegative(),
		elapsedMs: elapsedSchema,
	})
	.strict()
	.superRefine((record, context) => {
		if (record.repId !== `${record.groupId}-rep-${record.ordinal}`) {
			context.addIssue({
				code: "custom",
				message: "Rep identity must match its group and ordinal",
				path: ["repId"],
			});
		}
		if (record.metrics.status === "MISSING") {
			if (record.outcome === "SUCCESSFUL") {
				context.addIssue({
					code: "custom",
					message: "Missing provider metrics cannot produce a successful rep",
					path: ["outcome"],
				});
			}

			return;
		}

		const workerTurns = record.metrics.calls
			.filter(({ role }) => role === "worker")
			.reduce((total, call) => total + call.metrics.turns, 0);
		if (record.workerTrajectorySteps !== workerTurns) {
			context.addIssue({
				code: "custom",
				message:
					"Worker trajectory steps must equal provider-reported worker turns",
				path: ["workerTrajectorySteps"],
			});
		}
		if (record.outcome !== "SUCCESSFUL") {
			return;
		}

		const stagesPassed = record.stages.every(
			(stage) =>
				stage.status === "JUDGED" &&
				stage.verdict === "CONTINUE" &&
				(stage.grade === "A" || stage.grade === "B"),
		);
		const finalPassed =
			record.mode === "stage"
				? record.finalOutcome.status === "NOT_APPLICABLE"
				: record.finalOutcome.status === "JUDGED" &&
					record.finalOutcome.verdict === "PASS";
		if (!stagesPassed || !finalPassed) {
			context.addIssue({
				code: "custom",
				message: "Successful reps require passing stage and final outcomes",
				path: ["outcome"],
			});
		}
	});

export type ConfirmationRepRecord = z.infer<typeof confirmationRepRecordSchema>;

export function parseConfirmationRepRecord(
	text: string,
): ConfirmationRepRecord {
	return confirmationRepRecordSchema.parse(JSON.parse(text));
}
