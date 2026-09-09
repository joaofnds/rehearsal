import { z } from "zod";
import type { SessionCase } from "./case";
import type { SessionSettings } from "./claude";
import { effortSchema } from "./config";
import {
	corpusEntries,
	projectEntries,
	reconcileManifest,
} from "./context-manifest";
import { claudeCallMetricsSchema } from "./contracts";
import type { ResolvedCorpusFile } from "./corpus-file";
import { checkResultSchema } from "./session-check";
import type { SessionAttempt } from "./session-attempt";

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

const contextHalfSchema = z.enum(["corpus", "project"]);

const manifestEntrySchema = z
	.object({
		path: z.string().min(1),
		half: contextHalfSchema,
	})
	.strict();

/**
 * The manifest is observed name-only (ACT-59, doc-9 gap 2): the transcript
 * never carries the corpus's own bytes, so an entry is a layout path and
 * nothing a hash could attach to.
 */
const contextManifestSchema = z
	.object({
		paths: z.array(manifestEntrySchema),
	})
	.strict();

const manifestDivergenceSchema = z
	.object({
		kind: z.enum(["undeclared-file", "unloaded-file"]),
		path: z.string().min(1),
		half: contextHalfSchema,
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

const legacySessionAttemptRecordSchema = z
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

const executionFailedSessionAttemptRecordSchema = z
	.object({
		schemaVersion: z.literal(2),
		caseId: z.string().min(1),
		lineage: z.string().min(1),
		model: z.string().min(1),
		effort: effortSchema.optional(),
		sessionBudgetUsd: z.number().positive(),
		corpusFiles: z.array(corpusFileSchema),
		corpusOrigin: corpusSnapshotOriginSchema.optional(),
		contextManifest: z.undefined().optional(),
		divergences: z.undefined().optional(),
		prompt: z.string().min(1),
		reply: z.undefined().optional(),
		error: z.string().min(1),
		transcriptFile: z.string().min(1),
		metrics: claudeCallMetricsSchema.optional(),
		outcome: z.literal("EXECUTION_FAILED"),
		checks: z.array(checkResultSchema).length(0),
		elapsedMs: z.number().nonnegative(),
	})
	.strict();

export const sessionAttemptRecordSchema = z.union([
	legacySessionAttemptRecordSchema,
	executionFailedSessionAttemptRecordSchema,
]);

export type LegacySessionAttemptRecord = z.infer<
	typeof legacySessionAttemptRecordSchema
>;
export type SessionAttemptRecord = z.infer<typeof sessionAttemptRecordSchema>;

export function parseSessionAttemptRecord(text: string): SessionAttemptRecord {
	return sessionAttemptRecordSchema.parse(JSON.parse(text));
}

export interface SessionAttemptRecordInputs {
	readonly sessionCase: SessionCase;
	readonly settings: SessionSettings;
	readonly lineage: string;
	readonly corpusFiles: readonly ResolvedCorpusFile[];
	readonly corpusOrigin: CorpusSnapshotOrigin;
	readonly attempt: SessionAttempt;
	readonly elapsedMs: number;
	readonly error?: string | undefined;
}

interface MutableSessionAttemptRecord {
	schemaVersion: 1 | 2;
	caseId: string;
	lineage: string;
	model: string;
	effort?: SessionSettings["effort"];
	sessionBudgetUsd: number;
	corpusFiles: ResolvedCorpusFile[];
	corpusOrigin: CorpusSnapshotOrigin;
	contextManifest?: SessionAttempt["contextManifest"];
	divergences?: ReturnType<typeof reconcileManifest>;
	prompt: string;
	reply?: string;
	error?: string;
	transcriptFile: string;
	metrics?: SessionAttempt["metrics"];
	outcome: SessionAttempt["outcome"];
	checks: SessionAttempt["checks"];
	elapsedMs: number;
}

export function buildSessionAttemptRecord(
	inputs: Readonly<SessionAttemptRecordInputs>,
): SessionAttemptRecord {
	const { attempt, sessionCase, settings } = inputs;
	const record: MutableSessionAttemptRecord = {
		schemaVersion: attempt.outcome === "EXECUTION_FAILED" ? 2 : 1,
		caseId: sessionCase.declaration.id,
		lineage: inputs.lineage,
		model: settings.model,
		sessionBudgetUsd: settings.budgetUsd,
		corpusFiles: inputs.corpusFiles.map((file) => ({ ...file })),
		corpusOrigin: inputs.corpusOrigin,
		prompt: sessionCase.prompt,
		transcriptFile: attempt.transcriptFile,
		outcome: attempt.outcome,
		checks: attempt.checks.map((check) => ({ ...check })),
		elapsedMs: inputs.elapsedMs,
	};
	if (settings.effort !== undefined) {
		record.effort = settings.effort;
	}
	if (attempt.reply !== undefined) {
		record.reply = attempt.reply;
	}
	if (inputs.error !== undefined) {
		record.error = inputs.error;
	}
	if (attempt.metrics !== undefined) {
		record.metrics = { ...attempt.metrics };
	}
	if (attempt.contextManifest !== undefined) {
		record.contextManifest = {
			paths: attempt.contextManifest.paths.map((entry) => ({ ...entry })),
		};
		record.divergences = reconcileManifest(attempt.contextManifest, [
			...corpusEntries(sessionCase.corpusFiles),
			...projectEntries(sessionCase.projectFiles),
		]);
	}

	return sessionAttemptRecordSchema.parse(record);
}
