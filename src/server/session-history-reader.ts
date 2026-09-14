import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import {
	parseConfirmationGroupRecord,
	parseConfirmationRepRecord,
} from "#benchmark/confirmation-record";
import { parseSessionAttemptRecord } from "#benchmark/session-record";
import {
	sessionHistoryDetail,
	sessionHistoryReport,
} from "#benchmark/session-history";
import type {
	SessionHistoryDetail,
	SessionHistoryReport,
	SessionHistoryReportInput,
} from "#benchmark/session-history";

const IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

export class SessionHistoryReaderError extends Error {
	public override name = "SessionHistoryReaderError";

	public constructor(
		public readonly kind: "not-found" | "refused",
		message: string,
	) {
		super(message);
	}
}

interface SessionAttemptHistoryIdentity {
	readonly runsDirectory: string;
	readonly caseId: string;
	readonly uuid: string;
}

interface ConfirmationAttemptHistoryIdentity {
	readonly runsDirectory: string;
	readonly groupId: string;
	readonly repId: string;
}

function assertIdentity(value: string): void {
	if (!IDENTITY.test(value)) {
		throw new SessionHistoryReaderError("refused", "Invalid saved-attempt identity");
	}
}

function contained(path: string, root: string): boolean {
	const fromRoot = relative(root, path);

	return fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== "..");
}

async function canonicalRunsRoot(runsDirectory: string): Promise<string> {
	const root = await realpath(runsDirectory).catch(() => undefined);
	if (root === undefined) {
		throw new SessionHistoryReaderError("not-found", "No saved run directory");
	}

	return root;
}

async function verifiedDirectory(
	root: string,
	segments: readonly string[],
): Promise<string> {
	let current = root;
	for (const segment of segments) {
		assertIdentity(segment);
		current = resolve(current, segment);
		const status = await lstat(current).catch(() => undefined);
		if (status === undefined) {
			throw new SessionHistoryReaderError(
				"not-found",
				"No saved attempt at this identity",
			);
		}
		if (status.isSymbolicLink() || !status.isDirectory()) {
			throw new SessionHistoryReaderError(
				"refused",
				"Saved-attempt path is not a real directory",
			);
		}
		const canonical = await realpath(current).catch(() => undefined);
		if (canonical === undefined || !contained(canonical, root)) {
			throw new SessionHistoryReaderError(
				"refused",
				"Saved-attempt path leaves the runs directory",
			);
		}
		current = canonical;
	}

	return current;
}

async function verifiedFile(
	root: string,
	directory: string,
	name: string,
	required: boolean,
): Promise<string | undefined> {
	assertIdentity(name);
	const path = resolve(directory, name);
	const status = await lstat(path).catch(() => undefined);
	if (status === undefined) {
		if (required) {
			throw new SessionHistoryReaderError(
				"not-found",
				"Saved-attempt evidence is unavailable",
			);
		}

		return undefined;
	}
	if (status.isSymbolicLink() || !status.isFile()) {
		throw new SessionHistoryReaderError(
			"refused",
			"Saved-attempt evidence is not a real file",
		);
	}
	const canonical = await realpath(path).catch(() => undefined);
	if (canonical === undefined || !contained(canonical, root)) {
		throw new SessionHistoryReaderError(
			"refused",
			"Saved-attempt evidence leaves the runs directory",
		);
	}

	return canonical;
}

async function readVerifiedFile(path: string): Promise<string> {
	const handle = await open(path, constants.O_RDONLY + constants.O_NOFOLLOW);
	try {
		const status = await handle.stat();
		if (!status.isFile()) {
			throw new SessionHistoryReaderError(
				"refused",
				"Saved-attempt evidence is not a regular file",
			);
		}

		return await handle.readFile({ encoding: "utf8" });
	} finally {
		await handle.close();
	}
}

async function reportInput(
	attemptFile: string,
	transcriptFile: string | undefined,
	id: string,
): Promise<SessionHistoryReportInput> {
	const attempt = parseSessionAttemptRecord(await readVerifiedFile(attemptFile));
	const transcript =
		transcriptFile === undefined
			? undefined
			: await readVerifiedFile(transcriptFile);

	return {
		attempt: {
			caseId: attempt.caseId,
			id,
			model: attempt.model,
			outcome: attempt.outcome,
			corpusFiles: attempt.corpusFiles.map(({ path, resolvedPath }) => ({
				path,
				resolvedPath,
			})),
		},
		transcript,
		prefixLinesExcluded: attempt.transcriptDiagnostics?.prefixLinesExcluded,
		diagnostics: attempt.transcriptDiagnostics,
	};
}

async function standaloneInput(
	identity: Readonly<SessionAttemptHistoryIdentity>,
): Promise<SessionHistoryReportInput> {
	assertIdentity(identity.caseId);
	assertIdentity(identity.uuid);
	const root = await canonicalRunsRoot(identity.runsDirectory);
	const directory = await verifiedDirectory(root, [
		"sessions",
		identity.caseId,
		identity.uuid,
	]);
	const attemptFile = await verifiedFile(root, directory, "attempt.json", true);
	if (attemptFile === undefined) {
		throw new SessionHistoryReaderError("not-found", "Saved attempt is unavailable");
	}
	const transcriptFile = await verifiedFile(
		root,
		directory,
		"transcript.jsonl",
		false,
	);
	const input = await reportInput(attemptFile, transcriptFile, identity.uuid);
	if (input.attempt.caseId !== identity.caseId) {
		throw new SessionHistoryReaderError(
			"refused",
			"Saved attempt does not own this case identity",
		);
	}

	return input;
}

async function confirmationInput(
	identity: Readonly<ConfirmationAttemptHistoryIdentity>,
): Promise<SessionHistoryReportInput> {
	assertIdentity(identity.groupId);
	assertIdentity(identity.repId);
	const root = await canonicalRunsRoot(identity.runsDirectory);
	const groupDirectory = await verifiedDirectory(root, [
		"confirmations",
		identity.groupId,
	]);
	const repDirectory = await verifiedDirectory(root, [
		"confirmations",
		identity.groupId,
		"reps",
		identity.repId,
	]);
	const groupFile = await verifiedFile(root, groupDirectory, "group.json", true);
	const repFile = await verifiedFile(root, repDirectory, "rep.json", true);
	const attemptFile = await verifiedFile(root, repDirectory, "attempt.json", true);
	if (groupFile === undefined || repFile === undefined || attemptFile === undefined) {
		throw new SessionHistoryReaderError(
			"not-found",
			"Saved confirmation attempt is unavailable",
		);
	}
	const group = parseConfirmationGroupRecord(await readVerifiedFile(groupFile));
	const rep = parseConfirmationRepRecord(await readVerifiedFile(repFile));
	if (group.mode !== "session" || rep.mode !== "session") {
		throw new SessionHistoryReaderError(
			"refused",
			"Confirmation attempt is not a session",
		);
	}
	const expectedRepPath = relative(groupDirectory, repFile);
	const owned = group.repRecords.some(
		(reference) =>
			reference.repId === identity.repId && reference.path === expectedRepPath,
	);
	if (
		group.groupId !== identity.groupId ||
		rep.groupId !== identity.groupId ||
		rep.repId !== identity.repId ||
		!owned
	) {
		throw new SessionHistoryReaderError(
			"refused",
			"Confirmation group does not own this rep",
		);
	}
	const transcriptFile = await verifiedFile(
		root,
		repDirectory,
		"transcript.jsonl",
		false,
	);
	const input = await reportInput(attemptFile, transcriptFile, identity.repId);
	if (input.attempt.caseId !== group.caseId || input.attempt.caseId !== rep.caseId) {
		throw new SessionHistoryReaderError(
			"refused",
			"Confirmation attempt case identity differs",
		);
	}

	return input;
}

export async function readSessionAttemptHistory(
	identity: Readonly<SessionAttemptHistoryIdentity>,
): Promise<SessionHistoryReport> {
	return sessionHistoryReport(await standaloneInput(identity));
}

export async function readSessionAttemptHistoryDetail(
	identity: Readonly<SessionAttemptHistoryIdentity>,
	eventId: string,
): Promise<SessionHistoryDetail | undefined> {
	return sessionHistoryDetail(await standaloneInput(identity), eventId);
}

export async function readConfirmationAttemptHistory(
	identity: Readonly<ConfirmationAttemptHistoryIdentity>,
): Promise<SessionHistoryReport> {
	return sessionHistoryReport(await confirmationInput(identity));
}

export async function readConfirmationAttemptHistoryDetail(
	identity: Readonly<ConfirmationAttemptHistoryIdentity>,
	eventId: string,
): Promise<SessionHistoryDetail | undefined> {
	return sessionHistoryDetail(await confirmationInput(identity), eventId);
}
