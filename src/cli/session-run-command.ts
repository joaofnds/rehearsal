import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { SessionCase } from "#benchmark/case";
import type { Immutable } from "#benchmark/contracts";
import type { SessionSettings } from "#benchmark/claude";
import { runCommand } from "#benchmark/command";
import type { SessionRunConfig } from "#benchmark/config";
import { CLAUDE_TIMEOUT_MS } from "#benchmark/config";
import type { ResolvedCorpusFile } from "#benchmark/corpus-file";
import { CorpusFileError, hashCorpusFiles } from "#benchmark/corpus-file";
import type { ClaudeRunner, SessionAttempt } from "#benchmark/session-attempt";
import { runSessionAttempt } from "#benchmark/session-attempt";
import { claudeProjectsDirectory } from "#benchmark/session-capture";
import { sessionLineage } from "#benchmark/session-lineage";
import type { SessionAttemptRecord } from "#benchmark/session-record";
import { sessionAttemptRecordSchema } from "#benchmark/session-record";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import type { CommandOutput } from "#cli/output";

export const runClaudeCommand: ClaudeRunner = (command, cwd) =>
	runCommand(command, cwd, { timeoutMs: CLAUDE_TIMEOUT_MS });

export interface SessionRunRequest {
	readonly sessionCase: SessionCase;
	readonly config: SessionRunConfig;
	readonly runsDirectory: string;
	readonly runClaude: ClaudeRunner;
	readonly projectsDirectory: string;
}

function settingsOf(config: SessionRunConfig): SessionSettings {
	return {
		model: config.model,
		effort: config.effort,
		budgetUsd: config.sessionBudgetUsd,
	};
}

/**
 * The corpus files resolve before the attempt runs, so a case naming a style
 * that is not installed is refused rather than discovered after the session
 * has been paid for.
 */
async function requireCorpus(
	sessionCase: SessionCase,
): Promise<readonly ResolvedCorpusFile[]> {
	try {
		return await hashCorpusFiles(sessionCase.corpusFiles);
	} catch (error) {
		if (error instanceof CorpusFileError) {
			throw new RefusedPreconditionError(error.message);
		}

		throw error;
	}
}

interface AttemptRecordInputs {
	readonly sessionCase: SessionCase;
	readonly settings: SessionSettings;
	readonly lineage: string;
	readonly corpusFiles: readonly ResolvedCorpusFile[];
	readonly attempt: SessionAttempt;
	readonly elapsedMs: number;
}

/**
 * `effort` and `metrics` are absent rather than explicitly undefined: with
 * exact optional property types an undefined value is a different shape from
 * an omitted key, and the record's schema is strict about which one it takes.
 */
function buildAttemptRecord(
	inputs: Immutable<AttemptRecordInputs>,
): SessionAttemptRecord {
	const { attempt, settings, sessionCase } = inputs;
	const common = {
		schemaVersion: 1,
		caseId: sessionCase.declaration.id,
		lineage: inputs.lineage,
		model: settings.model,
		sessionBudgetUsd: settings.budgetUsd,
		corpusFiles: inputs.corpusFiles.map((file) => ({ ...file })),
		prompt: sessionCase.prompt,
		reply: attempt.reply,
		transcriptFile: attempt.transcriptFile,
		outcome: attempt.outcome,
		checks: attempt.checks.map((check) => ({ ...check })),
		elapsedMs: inputs.elapsedMs,
	} as const;

	if (settings.effort === undefined) {
		return attempt.metrics === undefined
			? common
			: { ...common, metrics: { ...attempt.metrics } };
	}

	return attempt.metrics === undefined
		? { ...common, effort: settings.effort }
		: {
				...common,
				effort: settings.effort,
				metrics: { ...attempt.metrics },
			};
}

export interface SessionRunOutcome {
	readonly recordFile: string;
	readonly record: SessionAttemptRecord;
}

export async function runSessionDebugAttempt(
	request: SessionRunRequest,
): Promise<SessionRunOutcome> {
	const { sessionCase, config } = request;
	const settings = settingsOf(config);
	const corpusFiles = await requireCorpus(sessionCase);
	const lineage = await sessionLineage(sessionCase, corpusFiles, settings);

	const recordDirectory = join(
		request.runsDirectory,
		"sessions",
		sessionCase.declaration.id,
		randomUUID(),
	);
	await mkdir(recordDirectory, { recursive: true });

	const startedAt = Date.now();
	const attempt = await runSessionAttempt({
		sessionCase,
		settings,
		projectsDirectory: request.projectsDirectory,
		recordDirectory,
		runClaude: request.runClaude,
	});

	const record = sessionAttemptRecordSchema.parse(
		buildAttemptRecord({
			sessionCase,
			settings,
			lineage,
			corpusFiles,
			attempt,
			elapsedMs: Date.now() - startedAt,
		}),
	);
	const recordFile = join(recordDirectory, "attempt.json");
	await Bun.write(recordFile, `${JSON.stringify(record, null, 2)}\n`);

	return { recordFile, record };
}

export function defaultSessionRunRequest(
	sessionCase: SessionCase,
	config: SessionRunConfig,
	runsDirectory: string,
): SessionRunRequest {
	return {
		sessionCase,
		config,
		runsDirectory,
		runClaude: runClaudeCommand,
		projectsDirectory: claudeProjectsDirectory(),
	};
}

export function reportSessionChecks(
	record: Immutable<SessionAttemptRecord>,
	output: CommandOutput,
): void {
	for (const check of record.checks) {
		output.stderr(`${check.status} ${check.kind}: ${check.detail}\n`);
	}
}
