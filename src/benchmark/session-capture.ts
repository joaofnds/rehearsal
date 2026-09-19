import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
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

const sessionRecordSchema = z.object({ sessionId: z.string().min(1) });

/**
 * A transcript names its own session from the inside, on every record, and that
 * is the only identity a fork can use: `forkTranscript` rewrites the id by
 * replacing its occurrences in the bytes, so an id the records do not carry
 * rewrites nothing. The file name is no such identity. The provider happens to
 * name its own files `<sessionId>.jsonl`, but every transcript the harness
 * preserves is named `transcript.jsonl`, so a name-derived id collapses every
 * saved attempt onto one string.
 *
 * The id is read from the `sessionId` field rather than matched as a pattern: a
 * transcript carries many uuids, of which one is the session's.
 */
async function sessionIdsIn(path: string): Promise<readonly string[]> {
	const found = new Set<string>();
	for await (const line of fileLines(path)) {
		const id = declaredSessionId(line);
		if (id !== undefined) {
			found.add(id);
		}
	}

	return [...found];
}

function declaredSessionId(line: string): string | undefined {
	if (line.trim() === "") {
		return undefined;
	}

	try {
		const record = sessionRecordSchema.safeParse(JSON.parse(line));

		return record.success ? record.data.sessionId : undefined;
	} catch {
		return undefined;
	}
}

interface UnnamedTranscript {
	readonly path: string;
	readonly reason: string;
}

/**
 * A transcript carrying no id names no session, and one carrying several names
 * no single session. Either way it cannot be captured, and the operator who
 * pointed at it needs the file named rather than a report that their prefix
 * matched nothing.
 */
function unnamed(path: string, ids: readonly string[]): UnnamedTranscript {
	if (ids.length === 0) {
		return {
			path,
			reason: `No record in ${path} carries a session id, so it names no session to capture`,
		};
	}

	return {
		path,
		reason: `Records in ${path} carry ${String(ids.length)} session ids: ${ids.join(", ")}, so it names no single session to capture`,
	};
}

interface TranscriptSearch {
	readonly sessions: readonly ResolvedSession[];
	readonly unnamed: readonly UnnamedTranscript[];
}

/**
 * A session file lives under the slug of the directory it ran in, and the
 * session a capture names may have run anywhere, so the search covers every
 * slug rather than asking the caller which one to look in.
 */
async function sessionsUnder(directory: string): Promise<TranscriptSearch> {
	let entries: readonly string[];
	try {
		entries = await readdir(directory, { recursive: true });
	} catch {
		throw new CaptureError(`No session directory at ${directory}`);
	}

	const sessions: ResolvedSession[] = [];
	const nameless: UnnamedTranscript[] = [];
	for (const entry of entries.filter((name) =>
		name.endsWith(SESSION_FILE_SUFFIX),
	)) {
		const path = join(directory, entry);
		const ids = await sessionIdsIn(path);
		const [only] = ids;
		if (only === undefined || ids.length > 1) {
			nameless.push(unnamed(path, ids));
			continue;
		}

		sessions.push({ sessionId: only, path });
	}

	return {
		sessions: sessions.toSorted((left, right) =>
			left.sessionId < right.sessionId ? -1 : 1,
		),
		unnamed: nameless,
	};
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
	const search = await sessionsUnder(projectsDirectory);
	const matches = search.sessions.filter((session) =>
		session.sessionId.startsWith(prefix),
	);
	const [only] = matches;
	if (only === undefined) {
		const [nameless] = search.unnamed;
		if (nameless !== undefined) {
			throw new CaptureError(nameless.reason);
		}

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
		lines += line.trim() === "" ? 0 : 1;
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
		written += line.trim() === "" ? 0 : 1;
	}
	await writer.end();

	return { sha256: hasher.digest("hex"), lines: written };
}
