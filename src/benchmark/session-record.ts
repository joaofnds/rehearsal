import { z } from "zod";
import { effortSchema } from "./config";
import { claudeCallMetricsSchema } from "./contracts";
import { checkResultSchema } from "./session-check";

/**
 * Where the attempt's corpus bytes were read from, recorded beside the digests
 * so the source survives the run: two runs are comparable only if the record
 * says which corpus each read. A record written before this field existed
 * carries none, and every one of those read the live install.
 */
export const corpusSnapshotOriginSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("live") }).strict(),
	z
		.object({ kind: z.literal("directory"), source: z.string().min(1) })
		.strict(),
]);

export type CorpusSnapshotOrigin = z.infer<typeof corpusSnapshotOriginSchema>;

const corpusFileSchema = z
	.object({
		path: z.string().min(1),
		resolvedPath: z.string().min(1),
		sha256: z.string().regex(/^[0-9a-f]{64}$/u, "Invalid SHA-256 digest"),
	})
	.strict();

/**
 * The manifest is observed name-only (ACT-59, doc-9 gap 2): the transcript
 * never carries the corpus's own bytes, so an entry is a layout path and
 * nothing a hash could attach to.
 */
const contextManifestSchema = z
	.object({
		paths: z.array(z.string().min(1)),
	})
	.strict();

const manifestDivergenceSchema = z
	.object({
		kind: z.enum(["undeclared-file", "unloaded-file"]),
		path: z.string().min(1),
	})
	.strict();

interface RecordedOutcome {
	readonly outcome: "SUCCESSFUL" | "UNSUCCESSFUL" | "NO_REPLY";
	readonly reply?: string | undefined;
	readonly checks: readonly { readonly status: "PASS" | "FAIL" }[];
}

interface RecordProblem {
	readonly message: string;
	readonly path: string;
}

/**
 * A session that produced no reply had nothing to check, so a record carrying
 * either a reply or a check result under that outcome describes something that
 * cannot have happened. A checked attempt is the mirror: it carries the reply
 * it checked and one result per declared check, and it is successful when and
 * only when every one of them passes.
 */
function problemsWith(record: RecordedOutcome): readonly RecordProblem[] {
	if (record.outcome === "NO_REPLY") {
		return noReplyProblems(record);
	}

	return checkedProblems(record);
}

function noReplyProblems(record: RecordedOutcome): readonly RecordProblem[] {
	const problems: RecordProblem[] = [];
	if (record.reply !== undefined) {
		problems.push({
			message: "A session attempt with no reply records no reply",
			path: "reply",
		});
	}
	if (record.checks.length > 0) {
		problems.push({
			message: "A session attempt with no reply evaluates no check",
			path: "checks",
		});
	}

	return problems;
}

function checkedProblems(record: RecordedOutcome): readonly RecordProblem[] {
	const problems: RecordProblem[] = [];
	if (record.reply === undefined) {
		problems.push({
			message:
				"A session attempt that was checked records the reply it checked",
			path: "reply",
		});
	}
	if (record.checks.length === 0) {
		problems.push({
			message:
				"A checked session attempt records one result per declared check",
			path: "checks",
		});

		return problems;
	}

	const passed = record.checks.every(({ status }) => status === "PASS");
	if (passed !== (record.outcome === "SUCCESSFUL")) {
		problems.push({
			message:
				"A session attempt is successful when and only when every check passes",
			path: "outcome",
		});
	}

	return problems;
}

export const sessionAttemptRecordSchema = z
	.object({
		schemaVersion: z.literal(1),
		caseId: z.string().min(1),
		lineage: z.string().min(1),
		model: z.string().min(1),
		effort: effortSchema.optional(),
		sessionBudgetUsd: z.number().positive(),
		corpusFiles: z.array(corpusFileSchema),
		corpusOrigin: corpusSnapshotOriginSchema.optional(),
		contextManifest: contextManifestSchema.optional(),
		divergences: z.array(manifestDivergenceSchema).optional(),
		prompt: z.string().min(1),
		reply: z.string().optional(),
		transcriptFile: z.string().min(1),
		metrics: claudeCallMetricsSchema.optional(),
		outcome: z.enum(["SUCCESSFUL", "UNSUCCESSFUL", "NO_REPLY"]),
		checks: z.array(checkResultSchema),
		elapsedMs: z.number().nonnegative(),
	})
	.strict()
	.superRefine((record, context) => {
		for (const problem of problemsWith(record)) {
			context.addIssue({
				code: "custom",
				message: problem.message,
				path: [problem.path],
			});
		}
	});

export type SessionAttemptRecord = z.infer<typeof sessionAttemptRecordSchema>;

export function parseSessionAttemptRecord(text: string): SessionAttemptRecord {
	return sessionAttemptRecordSchema.parse(JSON.parse(text));
}
