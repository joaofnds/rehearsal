import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
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
	readonly ids: readonly string[];
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
			ids,
			reason: `No record in ${path} carries a session id, so it names no session to capture`,
		};
	}

	return {
		ids,
		reason: `Records in ${path} carry ${String(ids.length)} session ids: ${ids.join(", ")}, so it names no single session to capture`,
	};
}

interface TranscriptSearch {
	readonly sessions: readonly ResolvedSession[];
	readonly unnamed: readonly UnnamedTranscript[];
}

/**
 * Every transcript under a directory, however deep. The provider files its
 * sessions by the slug of the directory each ran in, and a capture may name a
 * session that ran anywhere, so the search covers the whole tree rather than
 * asking the caller which slug to look in.
 *
 * A store that was never written holds no sessions rather than failing the
 * search, the same reading `run-layout` gives a run directory that does not
 * exist: a machine that has run the harness but never a session of its own has
 * no interactive store, and its saved attempts are still capturable.
 */
export async function transcriptsUnder(
	directory: string,
): Promise<readonly string[]> {
	const entries = await readdir(directory, { recursive: true }).catch(() => []);

	return entries
		.filter((entry) => entry.endsWith(SESSION_FILE_SUFFIX))
		.map((entry) => join(directory, entry));
}

/**
 * A session's subagents each write their own transcript under the session's
 * directory, carrying the session's id, so a store holds several files claiming
 * one identity. The session's own transcript is the one its store named for it,
 * `<sessionId>.jsonl`, and the others are records of the session rather than the
 * session to resume. Where no file carries that name, the claim names no file to
 * capture and is reported rather than dropped.
 */
function claimedSession(
	sessionId: string,
	claiming: readonly ResolvedSession[],
): ResolvedSession | UnnamedTranscript {
	const [only] = claiming;
	if (only !== undefined && claiming.length === 1) {
		return only;
	}

	const own = claiming.find(
		({ path }) => basename(path) === `${sessionId}${SESSION_FILE_SUFFIX}`,
	);
	if (own !== undefined) {
		return own;
	}

	const paths = claiming.map(({ path }) => path).toSorted();

	return {
		ids: [sessionId],
		reason: `Session ${sessionId} is claimed by ${String(claiming.length)} transcripts and named by none of them: ${paths.join(", ")}`,
	};
}

function isResolved(
	candidate: ResolvedSession | UnnamedTranscript,
): candidate is ResolvedSession {
	return "path" in candidate;
}

/**
 * A transcript's records settle which session it holds, except where they name
 * more than one: a resumed session carries the id it inherited beside its own.
 * The store named the file for the session that owns it, so where that name is
 * among the ids it is the one to take, and where it is not the transcript names
 * no single session.
 */
function namedIdentity(
	path: string,
	ids: readonly string[],
): ResolvedSession | undefined {
	const named = ids.find(
		(id) => basename(path) === `${id}${SESSION_FILE_SUFFIX}`,
	);

	return named === undefined ? undefined : { sessionId: named, path };
}

async function searched(paths: readonly string[]): Promise<TranscriptSearch> {
	const claimed = new Map<string, ResolvedSession[]>();
	const nameless: UnnamedTranscript[] = [];
	for (const path of paths) {
		const ids = await sessionIdsIn(path);
		const [only] = ids;
		if (only === undefined) {
			nameless.push(unnamed(path, ids));
			continue;
		}

		const session =
			ids.length === 1 ? { sessionId: only, path } : namedIdentity(path, ids);
		if (session === undefined) {
			nameless.push(unnamed(path, ids));
			continue;
		}

		claimed.set(session.sessionId, [
			...(claimed.get(session.sessionId) ?? []),
			session,
		]);
	}

	const sessions: ResolvedSession[] = [];
	for (const [sessionId, claiming] of claimed) {
		const candidate = claimedSession(sessionId, claiming);
		if (isResolved(candidate)) {
			sessions.push(candidate);
			continue;
		}

		nameless.push(candidate);
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

/**
 * A store holds thousands of transcripts, some of them unidentifiable for
 * reasons that have nothing to do with the session the operator named, so a
 * mistyped prefix must not be answered by naming an unrelated file. The prefix
 * points at an unidentifiable transcript when one of its ids starts with the
 * prefix, and at the only transcript searched whatever the prefix is.
 */
function pointedAt(
	nameless: readonly UnnamedTranscript[],
	transcripts: number,
	prefix: string,
): UnnamedTranscript | undefined {
	const matched = nameless.find(({ ids }) =>
		ids.some((id) => id.startsWith(prefix)),
	);
	if (matched !== undefined) {
		return matched;
	}

	return transcripts === 1 ? nameless[0] : undefined;
}

/**
 * A transcript is offered to the search by path rather than by store, because
 * the stores name their files by three different conventions and none of them
 * is the session's identity. The caller that knows a store's layout enumerates
 * it; this reads the identity out of the bytes.
 */
export async function resolveSessionFile(
	transcripts: readonly string[],
	prefix: string,
): Promise<ResolvedSession> {
	const search = await searched(transcripts);
	const matches = search.sessions.filter((session) =>
		session.sessionId.startsWith(prefix),
	);
	const [only] = matches;
	if (only === undefined) {
		throw new CaptureError(
			pointedAt(search.unnamed, transcripts.length, prefix)?.reason ??
				`Session prefix ${prefix} matches no session file`,
		);
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
