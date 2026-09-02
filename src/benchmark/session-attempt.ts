import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionCase } from "./case";
import { readClaudeCallMetrics, readClaudeEnvelope } from "./claude";
import type { SessionSettings } from "./claude";
import type { ClaudeCallMetrics } from "./contracts";
import { projectSlug } from "./session-capture";
import type { CheckResult } from "./session-check";
import { evaluateChecks } from "./session-check";
import { parseTranscript, toolUses } from "./transcript";

export type ClaudeRunner = (
	command: readonly string[],
	cwd: string,
) => Promise<string>;

export interface SessionAttemptRequest {
	readonly sessionCase: SessionCase;
	readonly settings: SessionSettings;
	readonly projectsDirectory: string;
	readonly recordDirectory: string;
	readonly runClaude: ClaudeRunner;
}

export interface SessionAttempt {
	readonly attemptDirectory: string;
	readonly reply: string;
	readonly transcriptFile: string;
	readonly metrics: ClaudeCallMetrics | undefined;
	readonly outcome: "SUCCESSFUL" | "UNSUCCESSFUL";
	readonly checks: readonly CheckResult[];
}

export async function forkTranscript(
	sourcePath: string,
	destinationPath: string,
	sourceSession: string,
	freshSession: string,
): Promise<void> {
	const source = await Bun.file(sourcePath).text();
	await Bun.write(
		destinationPath,
		source.replaceAll(sourceSession, freshSession),
	);
}

export function sessionCaseArgs(
	sessionCase: SessionCase,
	settings: SessionSettings,
	resumeSessionId: string | undefined,
): string[] {
	return [
		"claude",
		"-p",
		sessionCase.prompt,
		"--model",
		settings.model,
		...(settings.effort === undefined ? [] : ["--effort", settings.effort]),
		"--max-budget-usd",
		String(settings.budgetUsd),
		"--output-format",
		"json",
		"--tools",
		sessionCase.tools.join(","),
		...(sessionCase.settings === undefined
			? []
			: ["--settings", JSON.stringify(sessionCase.settings)]),
		...(sessionCase.agents === undefined
			? []
			: ["--agents", JSON.stringify(sessionCase.agents)]),
		...(resumeSessionId === undefined ? [] : ["--resume", resumeSessionId]),
	];
}

async function listSlug(slug: string): Promise<ReadonlySet<string>> {
	try {
		return new Set(await readdir(slug));
	} catch {
		return new Set();
	}
}

/**
 * A resumed headless session is given a further session id and writes its own
 * file, so the transcript to read back is the entry the second listing has and
 * the first does not. Never a delete by pattern and never by the id the fork
 * wrote: a live session of João's has appeared in a project directory mid-run.
 */
function addedEntries(
	before: ReadonlySet<string>,
	after: ReadonlySet<string>,
): readonly string[] {
	return [...after].filter((entry) => !before.has(entry)).toSorted();
}

interface PreparedSession {
	readonly forkedFile: string | undefined;
	readonly resumeSessionId: string | undefined;
}

async function prepareResume(
	sessionCase: SessionCase,
	slug: string,
): Promise<PreparedSession> {
	const { transcriptPath, declaration } = sessionCase;
	if (transcriptPath === undefined || declaration.transcript === undefined) {
		return { forkedFile: undefined, resumeSessionId: undefined };
	}

	const freshSession = randomUUID();
	const forkedFile = join(slug, `${freshSession}.jsonl`);
	await mkdir(slug, { recursive: true });
	await forkTranscript(
		transcriptPath,
		forkedFile,
		declaration.transcript.sourceSession,
		freshSession,
	);

	return { forkedFile, resumeSessionId: freshSession };
}

export async function runSessionAttempt(
	request: SessionAttemptRequest,
): Promise<SessionAttempt> {
	const { sessionCase, settings } = request;
	const attemptDirectory = await realpath(
		await mkdtemp(join(tmpdir(), "rehearsal-attempt-")),
	);
	if (sessionCase.fixturePath !== undefined) {
		await cp(sessionCase.fixturePath, attemptDirectory, { recursive: true });
	}

	const slug = join(request.projectsDirectory, projectSlug(attemptDirectory));
	const { forkedFile, resumeSessionId } = await prepareResume(
		sessionCase,
		slug,
	);
	const before = await listSlug(slug);

	try {
		const output = await request.runClaude(
			sessionCaseArgs(sessionCase, settings, resumeSessionId),
			attemptDirectory,
		);
		const after = await listSlug(slug);
		const [written] = addedEntries(before, after);

		return await recordAttempt(request, attemptDirectory, slug, {
			output,
			writtenEntry: written,
		});
	} finally {
		await removeAttemptFiles(attemptDirectory, forkedFile);
	}
}

interface AttemptOutput {
	readonly output: string;
	readonly writtenEntry: string | undefined;
}

async function recordAttempt(
	request: SessionAttemptRequest,
	attemptDirectory: string,
	slug: string,
	attempt: AttemptOutput,
): Promise<SessionAttempt> {
	const envelope = readClaudeEnvelope(attempt.output);
	const reply = envelope.result ?? "";
	const transcriptFile = join(request.recordDirectory, "transcript.jsonl");
	const sourceEntry =
		attempt.writtenEntry === undefined
			? undefined
			: join(slug, attempt.writtenEntry);

	await mkdir(request.recordDirectory, { recursive: true });
	await Bun.write(
		transcriptFile,
		sourceEntry === undefined ? "" : await Bun.file(sourceEntry).text(),
	);
	if (sourceEntry !== undefined) {
		await rm(sourceEntry, { force: true });
	}

	const transcript = parseTranscript(await Bun.file(transcriptFile).text());
	const result = evaluateChecks(request.sessionCase.checks, {
		reply,
		toolUses: toolUses(transcript),
	});

	return {
		attemptDirectory,
		reply,
		transcriptFile,
		metrics: readClaudeCallMetrics(envelope),
		outcome: result.outcome,
		checks: result.results,
	};
}

async function removeAttemptFiles(
	attemptDirectory: string,
	forkedFile: string | undefined,
): Promise<void> {
	if (forkedFile !== undefined) {
		await rm(forkedFile, { force: true });
	}

	await rm(attemptDirectory, { force: true, recursive: true });
}
