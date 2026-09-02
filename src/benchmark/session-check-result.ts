import { z } from "zod";

export const checkResultSchema = z
	.object({
		kind: z.string().min(1),
		status: z.enum(["PASS", "FAIL"]),
		detail: z.string().min(1),
	})
	.strict();

export type CheckResult = z.infer<typeof checkResultSchema>;
