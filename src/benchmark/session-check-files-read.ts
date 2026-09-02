import { z } from "zod";
import type { Immutable } from "./contracts";
import type { ToolUse } from "./transcript";
import { filesRead } from "./transcript";
import type { CheckResult } from "./session-check-result";

export const filesReadCheckSchema = z
	.object({
		kind: z.literal("files-read"),
		paths: z.array(z.string().min(1)).min(1),
	})
	.strict();

export type FilesReadCheck = z.infer<typeof filesReadCheckSchema>;

export function evaluateFilesRead(
	check: Immutable<FilesReadCheck>,
	toolUses: Immutable<readonly ToolUse[]>,
): CheckResult {
	const read = filesRead(toolUses);
	const missing = check.paths.filter((path) => !read.includes(path));
	if (missing.length === 0) {
		return {
			kind: check.kind,
			status: "PASS",
			detail: `read ${check.paths.join(", ")}`,
		};
	}

	return {
		kind: check.kind,
		status: "FAIL",
		detail: `never read ${missing.join(", ")}`,
	};
}
