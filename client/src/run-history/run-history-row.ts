import { z } from "zod";

export const runHistoryRowSchema = z
	.object({
		run: z.string(),
		caseId: z.string(),
		status: z.string(),
		stage: z.string().optional(),
		grade: z.string().optional(),
		corpus: z.object({ digest: z.string() }).readonly().optional(),
		stale: z.boolean(),
		staleCauses: z.array(z.string()).readonly(),
	})
	.readonly();

export const unreadableRunSchema = z
	.object({ id: z.string(), reason: z.string() })
	.readonly();

export const runHistoryResponseSchema = z
	.object({
		rows: z.array(runHistoryRowSchema).readonly(),
		unreadable: z.array(unreadableRunSchema).readonly().default([]),
	})
	.readonly();

export type RunHistoryRow = z.infer<typeof runHistoryRowSchema>;
