import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, realpath, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionCase } from "./case";
import { readClaudeCallMetrics, readClaudeEnvelope } from "./claude";
import type { SessionSettings } from "./claude";
import type { ClaudeCallMetrics } from "./contracts";
import { terminatedFileLines } from "./file-lines";
import { projectSlug } from "./session-capture";
import type { CheckResult } from "./session-check";
import { evaluateChecks } from "./session-check";
import { parseTranscriptFile, toolUses } from "./transcript";

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

/**
 * A session that terminated without producing a reply (max turns, an exhausted
 * budget) has no reply to check, which is a different fact from a reply that
 * failed one. `reply` is absent exactly when the outcome is `NO_REPLY`, so no
 * value of this type says a check passed over a reply that never arrived.
 */
export interface SessionAttempt {
	readonly attemptDirectory: string;
	readonly reply: string | undefined;
	readonly transcriptFile: string;
	readonly metrics: ClaudeCallMetrics | undefined;
	readonly outcome: "SUCCESSFUL" | "UNSUCCESSFUL" | "NO_REPLY";
	readonly checks: readonly CheckResult[];
}

/**
 * A transcript prefix is a session file, which runs to several megabytes, and
 * a session id never spans two records, so the rewrite goes line by line rather
 * than over one string holding the whole file. Each line keeps the terminator
 * it had, so the fork differs from its source in the session id and nothing
 * else.
 */
export async function forkTranscript(
	sourcePath: string,
	destinationPath: string,
	sourceSession: string,
	freshSession: string,
): Promise<void> {
	const writer = Bun.file(destinationPath).writer();

	for await (const line of terminatedFileLines(sourcePath)) {
		const rewritten = line.text.replaceAll(sourceSession, freshSession);
		await writer.write(line.terminated ? `${rewritten}\n` : rewritten);
	}

	await writer.end();
}

export interface SessionNaming {
	readonly sessionId: string;
	readonly resumed: boolean;
}

/**
 * The attempt names its own session so that the session file it will own is
 * known before the call rather than inferred from the directory afterwards: a
 * resumed session is named by the uuid the fork rewrote, a fresh one by
 * `--session-id`. Without a name of its own, a failed call leaves a transcript
 * the harness cannot identify and therefore must not delete.
 */
export function sessionCaseArgs(
	sessionCase: SessionCase,
	settings: SessionSettings,
	session: SessionNaming,
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
		session.resumed ? "--resume" : "--session-id",
		session.sessionId,
	];
}

/**
 * A resumed session is the fork the harness wrote under a fresh uuid; a session
 * with no transcript is named by that uuid through `--session-id`. Either way
 * the attempt owns exactly `<sessionId>.jsonl` under its slug.
 */
async function prepareSession(
	sessionCase: SessionCase,
	slug: string,
): Promise<SessionNaming> {
	const sessionId = randomUUID();
	const { transcriptPath, declaration } = sessionCase;
	if (transcriptPath === undefined || declaration.transcript === undefined) {
		return { sessionId, resumed: false };
	}

	await mkdir(slug, { recursive: true });
	await forkTranscript(
		transcriptPath,
		join(slug, `${sessionId}.jsonl`),
		declaration.transcript.sourceSession,
		sessionId,
	);

	return { sessionId, resumed: true };
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
	const session = await prepareSession(sessionCase, slug);
	const transcriptPath = join(slug, `${session.sessionId}.jsonl`);

	try {
		const output = await request.runClaude(
			sessionCaseArgs(sessionCase, settings, session),
			attemptDirectory,
		);

		return await recordAttempt(request, attemptDirectory, {
			output,
			writtenTranscript: transcriptPath,
		});
	} finally {
		await removeAttemptFiles(attemptDirectory, slug, transcriptPath);
	}
}

interface AttemptOutput {
	readonly output: string;
	readonly writtenTranscript: string;
}

async function recordAttempt(
	request: SessionAttemptRequest,
	attemptDirectory: string,
	attempt: AttemptOutput,
): Promise<SessionAttempt> {
	const written = Bun.file(attempt.writtenTranscript);
	const transcriptFile = join(request.recordDirectory, "transcript.jsonl");

	await mkdir(request.recordDirectory, { recursive: true });
	await Bun.write(transcriptFile, (await written.exists()) ? written : "");

	const envelope = readClaudeEnvelope(attempt.output);
	const metrics = readClaudeCallMetrics(envelope);
	const reply = envelope.result;
	if (reply === undefined) {
		return {
			attemptDirectory,
			reply,
			transcriptFile,
			metrics,
			outcome: "NO_REPLY",
			checks: [],
		};
	}

	const transcript = await parseTranscriptFile(transcriptFile);
	const result = evaluateChecks(request.sessionCase.checks, {
		reply,
		toolUses: toolUses(transcript),
	});

	return {
		attemptDirectory,
		reply,
		transcriptFile,
		metrics,
		outcome: result.outcome,
		checks: result.results,
	};
}

/**
 * The projects directory holds live sessions of João's, and one has appeared in
 * a slug directory mid-run, so the only entry removed is the one the attempt
 * named itself. The slug goes with `rmdir`, which removes it only when it is
 * empty: a file the attempt cannot account for keeps its directory rather than
 * being deleted with it. Cleanup runs whether the call returned or threw, so a
 * provider that wrote its transcript and then failed leaves nothing behind.
 */
async function removeAttemptFiles(
	attemptDirectory: string,
	slug: string,
	transcriptPath: string,
): Promise<void> {
	await rm(transcriptPath, { force: true });
	await rmdir(slug).catch(() => undefined);

	await rm(attemptDirectory, { force: true, recursive: true });
}
