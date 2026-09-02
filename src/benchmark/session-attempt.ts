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
 * Observed on claude 2.1.258: a resumed headless session keeps its session id
 * and appends to the file it resumed, so the listing gains no entry and the
 * transcript to read back is the forked file. A run that does write a new file
 * is covered by the same diff. Never a delete by pattern and never by the id
 * the fork wrote: a live session of João's has appeared in a project directory
 * mid-run, and it is not the attempt's to remove.
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
	const created: string[] = [];
	if (forkedFile !== undefined) {
		created.push(forkedFile);
	}

	try {
		const output = await request.runClaude(
			sessionCaseArgs(sessionCase, settings, resumeSessionId),
			attemptDirectory,
		);
		const after = await listSlug(slug);
		const [written] = addedEntries(before, after);
		if (written !== undefined) {
			created.push(join(slug, written));
		}

		return await recordAttempt(request, attemptDirectory, {
			output,
			writtenTranscript:
				written === undefined ? forkedFile : join(slug, written),
		});
	} finally {
		await removeAttemptFiles(attemptDirectory, created);
	}
}

interface AttemptOutput {
	readonly output: string;
	readonly writtenTranscript: string | undefined;
}

async function recordAttempt(
	request: SessionAttemptRequest,
	attemptDirectory: string,
	attempt: AttemptOutput,
): Promise<SessionAttempt> {
	const { writtenTranscript } = attempt;
	const transcriptFile = join(request.recordDirectory, "transcript.jsonl");

	await mkdir(request.recordDirectory, { recursive: true });
	await Bun.write(
		transcriptFile,
		writtenTranscript === undefined
			? ""
			: await Bun.file(writtenTranscript).text(),
	);

	const envelope = readClaudeEnvelope(attempt.output);
	const reply = envelope.result ?? "";
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

/**
 * Only the files this attempt is known to have created: the transcript it
 * forked in and the one the provider wrote, identified by the listing diff.
 * The list is built as they appear rather than read back at the end, so a
 * failure after the provider wrote its transcript still removes it.
 */
async function removeAttemptFiles(
	attemptDirectory: string,
	created: readonly string[],
): Promise<void> {
	for (const path of created) {
		await rm(path, { force: true });
	}

	await rm(attemptDirectory, { force: true, recursive: true });
}
