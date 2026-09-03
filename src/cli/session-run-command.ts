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
import {
	CorpusSourceError,
	resolveCorpusSource,
} from "#benchmark/corpus-source";
import type {
	ClaudeRunner,
	SessionAttempt,
	SessionAttemptRequest,
} from "#benchmark/session-attempt";
import { FixtureError, runSessionAttempt } from "#benchmark/session-attempt";
import type { SessionCorpusSnapshot } from "#benchmark/session-corpus";
import {
	SessionCorpusError,
	snapshotSessionCorpus,
} from "#benchmark/session-corpus";
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

interface AttemptCorpus {
	readonly snapshot: SessionCorpusSnapshot;
	readonly files: readonly ResolvedCorpusFile[];
}

/**
 * The corpus resolves, snapshots, and hashes before the attempt runs, so a
 * source that does not exist, a style the corpus does not hold, or a skill the
 * harness cannot deliver is refused rather than discovered after the session
 * has been paid for. Every one of them is a declared input the command cannot
 * satisfy, so all three exit 3.
 */
async function requireCorpus(
	sessionCase: SessionCase,
	corpus: string | undefined,
	snapshotDirectory: string,
): Promise<AttemptCorpus> {
	try {
		const snapshot = await snapshotSessionCorpus(
			await resolveCorpusSource(corpus),
			snapshotDirectory,
			sessionCase.corpusFiles,
		);

		return {
			snapshot,
			files: await hashCorpusFiles(snapshot, sessionCase.corpusFiles),
		};
	} catch (error) {
		if (
			error instanceof CorpusFileError ||
			error instanceof CorpusSourceError ||
			error instanceof SessionCorpusError
		) {
			throw new RefusedPreconditionError(error.message);
		}

		throw error;
	}
}

/**
 * A fixture tree the harness refuses to seed is a declared input the command
 * cannot satisfy, the same shape of refusal as a corpus file that does not
 * resolve, so it exits 3 rather than as an execution failure.
 */
async function attempted(
	request: SessionAttemptRequest,
): Promise<SessionAttempt> {
	try {
		return await runSessionAttempt(request);
	} catch (error) {
		if (error instanceof FixtureError) {
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
 * The record is assembled rather than declared in one literal because its three
 * optional keys must be omitted, not set to undefined: exact optional property
 * types make those different shapes and the schema is strict about which it
 * takes.
 */
interface MutableAttemptRecord extends SessionAttemptRecord {
	effort?: SessionAttemptRecord["effort"];
	reply?: SessionAttemptRecord["reply"];
	metrics?: SessionAttemptRecord["metrics"];
}

/**
 * An absent `reply` is the session that produced none: the schema pairs it with
 * the `NO_REPLY` outcome and an empty check list, so a reply that never arrived
 * cannot be recorded as one that passed its checks.
 */
function buildAttemptRecord(
	inputs: Immutable<AttemptRecordInputs>,
): SessionAttemptRecord {
	const { attempt, settings, sessionCase } = inputs;
	const record: MutableAttemptRecord = {
		schemaVersion: 1,
		caseId: sessionCase.declaration.id,
		lineage: inputs.lineage,
		model: settings.model,
		sessionBudgetUsd: settings.budgetUsd,
		corpusFiles: inputs.corpusFiles.map((file) => ({ ...file })),
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
	if (attempt.metrics !== undefined) {
		record.metrics = { ...attempt.metrics };
	}

	return record;
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
	const recordDirectory = join(
		request.runsDirectory,
		"sessions",
		sessionCase.declaration.id,
		randomUUID(),
	);
	const corpus = await requireCorpus(
		sessionCase,
		config.corpus,
		join(recordDirectory, "corpus"),
	);
	const corpusFiles = corpus.files;
	const lineage = await sessionLineage(sessionCase, corpusFiles, settings);

	await mkdir(recordDirectory, { recursive: true });

	const startedAt = Date.now();
	const attempt = await attempted({
		sessionCase,
		settings,
		projectsDirectory: request.projectsDirectory,
		recordDirectory,
		runClaude: request.runClaude,
		corpusSnapshot: corpus.snapshot,
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
