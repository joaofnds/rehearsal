import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { LineObserver } from "./file-lines";
import { fileLines, IGNORE_CARRY } from "./file-lines";

const SESSION_FILE_SUFFIX = ".jsonl";

export class CaptureError extends Error {
	public override name = "CaptureError";
}

export function claudeProjectsDirectory(): string {
	return join(homedir(), ".claude", "projects");
}

/**
 * The project slug is the working directory's real path with every separator
 * replaced by a dash, which is how the provider names the directory it writes
 * a session file into.
 */
export function projectSlug(realPath: string): string {
	return realPath.replaceAll("/", "-");
}

export interface ResolvedSession {
	readonly sessionId: string;
	readonly path: string;
}

/**
 * A session file lives under the slug of the directory it ran in, and the
 * session a capture names may have run anywhere, so the search covers every
 * slug rather than asking the caller which one to look in.
 */
async function sessionsUnder(
	projectsDirectory: string,
): Promise<readonly ResolvedSession[]> {
	let entries: readonly string[];
	try {
		entries = await readdir(projectsDirectory, { recursive: true });
	} catch {
		throw new CaptureError(`No session directory at ${projectsDirectory}`);
	}

	return entries
		.filter((entry) => entry.endsWith(SESSION_FILE_SUFFIX))
		.map((entry) => ({
			sessionId: basename(entry, SESSION_FILE_SUFFIX),
			path: join(projectsDirectory, entry),
		}))
		.toSorted((left, right) => (left.sessionId < right.sessionId ? -1 : 1));
}

const AMBIGUITY_SAMPLE = 5;

/**
 * A one-character prefix can match every session on the machine, and a message
 * that lists all of them is unreadable at the terminal the agent reads it in.
 * The count is the fact that resolves the ambiguity; the sample is enough to
 * recognize which sessions they are.
 */
function ambiguity(matches: readonly ResolvedSession[]): string {
	const named = matches
		.slice(0, AMBIGUITY_SAMPLE)
		.map(({ sessionId }) => sessionId)
		.join(", ");
	const rest = matches.length - AMBIGUITY_SAMPLE;
	if (rest <= 0) {
		return named;
	}

	return `${named} and ${String(rest)} more; give more of the session id`;
}

export async function resolveSessionFile(
	projectsDirectory: string,
	prefix: string,
): Promise<ResolvedSession> {
	const sessions = await sessionsUnder(projectsDirectory);
	const matches = sessions.filter((session) =>
		session.sessionId.startsWith(prefix),
	);
	const [only] = matches;
	if (only === undefined) {
		throw new CaptureError(`Session prefix ${prefix} matches no session file`);
	}
	if (matches.length > 1) {
		throw new CaptureError(
			`Session prefix ${prefix} matches ${String(matches.length)} session files: ${ambiguity(matches)}`,
		);
	}

	return only;
}

export interface CapturedPrefix {
	readonly sha256: string;
	readonly lines: number;
}

async function countLines(path: string): Promise<number> {
	let lines = 0;
	for await (const line of fileLines(path)) {
		lines += line === "" ? 0 : 1;
	}

	return lines;
}

export async function captureTranscriptPrefix(
	sourcePath: string,
	destinationPath: string,
	cut: number,
	observer: LineObserver = IGNORE_CARRY,
): Promise<CapturedPrefix> {
	const total = await countLines(sourcePath);
	if (!Number.isInteger(cut) || cut < 1 || cut > total) {
		throw new CaptureError(
			`Cut ${String(cut)} is outside the source's ${String(total)} lines`,
		);
	}

	const hasher = new Bun.CryptoHasher("sha256");
	const writer = Bun.file(destinationPath).writer();
	let written = 0;

	for await (const line of fileLines(sourcePath, observer)) {
		if (written === cut) {
			break;
		}

		const bytes = new TextEncoder().encode(`${line}\n`);
		hasher.update(bytes);
		await writer.write(bytes);
		written += 1;
	}
	await writer.end();

	return { sha256: hasher.digest("hex"), lines: written };
}
