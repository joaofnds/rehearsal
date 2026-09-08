import { randomUUID } from "node:crypto";
import type { SessionCase } from "#benchmark/case";
import type { Immutable } from "#benchmark/contracts";
import type { SessionSettings } from "#benchmark/claude";
import { runCommand } from "#benchmark/command";
import type { SessionRunConfig } from "#benchmark/config";
import { CLAUDE_TIMEOUT_MS } from "#benchmark/config";
import type { ResolvedCorpusFile } from "#benchmark/corpus-file";
import { CorpusFileError, hashCorpusFiles } from "#benchmark/corpus-file";
import {
	corpusEntries,
	projectEntries,
	reconcileManifest,
} from "#benchmark/context-manifest";
import { resolveCorpusSource } from "#benchmark/corpus-source";
import type {
	ClaudeRunner,
	SessionAttempt,
	SessionAttemptRequest,
} from "#benchmark/session-attempt";
import {
	runSessionAttempt,
	SessionInputError,
} from "#benchmark/session-attempt";
import type { SessionCorpusSnapshot } from "#benchmark/session-corpus";
import {
	SessionCorpusError,
	snapshotSessionCorpus,
} from "#benchmark/session-corpus";
import { sessionAttemptPaths } from "#benchmark/run-layout";
import { claudeProjectsDirectory } from "#benchmark/session-capture";
import { SymlinkedEntryError } from "#benchmark/file-presence";
import { sessionLineage } from "#benchmark/session-lineage";
import type {
	CorpusSnapshotOrigin,
	SessionAttemptRecord,
} from "#benchmark/session-record";
import { sessionAttemptRecordSchema } from "#benchmark/session-record";
import { asUsageErrorAsync } from "#cli/commands";
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
 * A `--corpus` string the parser cannot turn into a corpus is an unparseable
 * flag value, which is a usage error; a corpus that resolves but holds no
 * declared file, or holds one the harness cannot deliver, is a declared input
 * the command cannot satisfy, which is a refused precondition. Both come before
 * the attempt runs, so neither is discovered after the session is paid for.
 */
async function requireCorpus(
	sessionCase: SessionCase,
	corpus: string | undefined,
	snapshotDirectory: string,
): Promise<AttemptCorpus> {
	const source = await asUsageErrorAsync(() => resolveCorpusSource(corpus));

	try {
		const snapshot = await snapshotSessionCorpus(
			source,
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
			error instanceof SessionCorpusError
		) {
			throw new RefusedPreconditionError(error.message);
		}

		throw error;
	}
}

/**
 * The fixture tree is hashed into the lineage before the attempt seeds it, so
 * a tree the harness would refuse to seed is refused here first. Without this
 * translation the earlier walk would surface a raw error where the later copy
 * gives a named refusal, and which one a case author saw would depend on
 * nothing they can see.
 */
async function lineageOf(
	sessionCase: SessionCase,
	corpusFiles: readonly ResolvedCorpusFile[],
	settings: SessionSettings,
): Promise<string> {
	try {
		return await sessionLineage(sessionCase, corpusFiles, settings);
	} catch (error) {
		if (error instanceof SymlinkedEntryError) {
			throw new RefusedPreconditionError(error.message);
		}

		throw error;
	}
}

/**
 * A fixture tree the harness refuses to seed, and a transcript prefix whose
 * bytes are not the ones the case declares, are declared inputs the command
 * cannot satisfy, the same shape of refusal as a corpus file that does not
 * resolve, so they exit 3 rather than as an execution failure.
 */
async function attempted(
	request: SessionAttemptRequest,
): Promise<SessionAttempt> {
	try {
		return await runSessionAttempt(request);
	} catch (error) {
		if (error instanceof SessionInputError) {
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
	readonly corpusOrigin: CorpusSnapshotOrigin;
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
	contextManifest?: SessionAttemptRecord["contextManifest"];
	divergences?: SessionAttemptRecord["divergences"];
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
	if (attempt.metrics !== undefined) {
		record.metrics = { ...attempt.metrics };
	}
	if (attempt.contextManifest !== undefined) {
		record.contextManifest = {
			paths: attempt.contextManifest.paths.map((entry) => ({ ...entry })),
		};
		record.divergences = [
			...reconcileManifest(attempt.contextManifest, [
				...corpusEntries(sessionCase.corpusFiles),
				...projectEntries(sessionCase.projectFiles),
			]),
		];
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
	const attemptPaths = sessionAttemptPaths(request.runsDirectory, {
		caseId: sessionCase.declaration.id,
		uuid: randomUUID(),
	});
	const recordDirectory = attemptPaths.directory;
	const corpus = await requireCorpus(
		sessionCase,
		config.corpus,
		attemptPaths.corpusDirectory,
	);
	const corpusFiles = corpus.files;
	const lineage = await lineageOf(sessionCase, corpusFiles, settings);

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
			corpusOrigin: corpus.snapshot.origin,
			attempt,
			elapsedMs: Date.now() - startedAt,
		}),
	);
	const { recordFile } = attemptPaths;
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
