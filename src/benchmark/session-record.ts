import { z } from "zod";
import { effortSchema } from "./config";
import { claudeCallMetricsSchema } from "./contracts";
import { checkResultSchema } from "./session-check";

const corpusFileSchema = z
	.object({
		path: z.string().min(1),
		resolvedPath: z.string().min(1),
		sha256: z.string().regex(/^[0-9a-f]{64}$/u, "Invalid SHA-256 digest"),
	})
	.strict();

export const sessionAttemptRecordSchema = z
	.object({
		schemaVersion: z.literal(1),
		caseId: z.string().min(1),
		lineage: z.string().min(1),
		model: z.string().min(1),
		effort: effortSchema.optional(),
		sessionBudgetUsd: z.number().positive(),
		corpusFiles: z.array(corpusFileSchema),
		prompt: z.string().min(1),
		reply: z.string(),
		transcriptFile: z.string().min(1),
		metrics: claudeCallMetricsSchema.optional(),
		outcome: z.enum(["SUCCESSFUL", "UNSUCCESSFUL"]),
		checks: z.array(checkResultSchema).min(1),
		elapsedMs: z.number().nonnegative(),
	})
	.strict()
	.superRefine((record, context) => {
		const passed = record.checks.every(({ status }) => status === "PASS");
		if (passed === (record.outcome === "SUCCESSFUL")) {
			return;
		}

		context.addIssue({
			code: "custom",
			message:
				"A session attempt is successful when and only when every check passes",
			path: ["outcome"],
		});
	});

export type SessionAttemptRecord = z.infer<typeof sessionAttemptRecordSchema>;

export function parseSessionAttemptRecord(text: string): SessionAttemptRecord {
	return sessionAttemptRecordSchema.parse(JSON.parse(text));
}
