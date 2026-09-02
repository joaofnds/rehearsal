import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type {
	CaseDeclaration,
	LoadedCase,
	SessionCaseDeclaration,
} from "#benchmark/case";
import {
	caseDeclarationPath,
	CaseDeclarationError,
	casesRoot,
	listCases,
	loadCase,
	readCaseDeclaration,
	transcriptPrefixPath,
} from "#benchmark/case";
import {
	captureTranscriptPrefix,
	CaptureError,
	resolveSessionFile,
} from "#benchmark/session-capture";
import { UsageError } from "#cli/commands";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import type { CommandOutput } from "#cli/output";

/**
 * A case named by a well-formed flag that does not exist is a precondition the
 * command refuses, not a malformed command line, so it exits 3 like the other
 * named-but-absent inputs rather than 2.
 */
async function asRefusedPrecondition<Loaded>(
	load: () => Promise<Loaded>,
): Promise<Loaded> {
	try {
		return await load();
	} catch (error) {
		if (error instanceof CaseDeclarationError) {
			throw new RefusedPreconditionError(error.message);
		}

		throw error;
	}
}

export function requireCase(caseId: string): Promise<LoadedCase> {
	return asRefusedPrecondition(() => loadCase(caseId));
}

function declarationFile(caseId: string, root?: string): string {
	return caseDeclarationPath(caseId, root ?? casesRoot());
}

function serialize(
	record: CaseDeclaration | readonly CaseDeclaration[],
): string {
	return `${JSON.stringify(record, null, 2)}\n`;
}

export interface CaseListRequest {
	readonly json: boolean;
}

export async function runCaseList(
	request: CaseListRequest,
	output: CommandOutput,
): Promise<void> {
	const listing = await asRefusedPrecondition(() => listCases());
	for (const { reason } of listing.unreadable) {
		output.stderr(`${reason}\n`);
	}
	if (request.json) {
		output.stdout(serialize(listing.declarations));

		return;
	}

	for (const declaration of listing.declarations) {
		output.stdout(`${declaration.id}\t${declaration.title}\n`);
	}
}

export interface CaseShowRequest {
	readonly caseId: string | undefined;
	readonly json: boolean;
}

export async function runCaseShow(
	request: CaseShowRequest,
	output: CommandOutput,
): Promise<void> {
	const { caseId } = request;
	if (caseId === undefined) {
		throw new UsageError("Provide the case id: rehearsal case show <case-id>");
	}

	const declaration: CaseDeclaration = await asRefusedPrecondition(() =>
		readCaseDeclaration(caseId),
	);

	output.stdout(
		request.json ? serialize(declaration) : `${declarationFile(caseId)}\n`,
	);
}

export interface CaseCaptureRequest {
	readonly caseId: string | undefined;
	readonly session: string | undefined;
	readonly cut: string | undefined;
	readonly json: boolean;
}

export interface CaseCaptureDependencies {
	readonly projectsDirectory: string;
	readonly output: CommandOutput;
	readonly casesDirectory?: string | undefined;
}

function requiredFlag(value: string | undefined, flag: string): string {
	if (value === undefined || value === "") {
		throw new UsageError(
			`Provide ${flag}: rehearsal case capture <case-id> --session <id> --cut <index>`,
		);
	}

	return value;
}

function parsedCut(value: string): number {
	const cut = Number(value);
	if (!Number.isInteger(cut)) {
		throw new UsageError(`Cut ${value} is not an integer`);
	}

	return cut;
}

async function requireSessionDeclaration(
	caseId: string,
	root: string,
): Promise<SessionCaseDeclaration> {
	const declaration: CaseDeclaration = await asRefusedPrecondition(() =>
		readCaseDeclaration(caseId, root),
	);
	if (declaration.kind !== "session") {
		throw new RefusedPreconditionError(
			`Case ${caseId} is a pipeline case; only a session case holds a transcript prefix`,
		);
	}

	return declaration;
}

/**
 * A cut the source cannot satisfy is a value the command line got wrong, so it
 * exits 2; a session id that names no file is a precondition the command
 * refuses, so it exits 3. Both arrive here as one CaptureError and are told
 * apart by which input the failure is about.
 */
async function captured(
	sourcePath: string,
	destinationPath: string,
	cut: number,
): Promise<Awaited<ReturnType<typeof captureTranscriptPrefix>>> {
	try {
		return await captureTranscriptPrefix(sourcePath, destinationPath, cut);
	} catch (error) {
		if (error instanceof CaptureError) {
			throw new UsageError(error.message);
		}

		throw error;
	}
}

async function resolved(
	projectsDirectory: string,
	session: string,
): Promise<Awaited<ReturnType<typeof resolveSessionFile>>> {
	try {
		return await resolveSessionFile(projectsDirectory, session);
	} catch (error) {
		if (error instanceof CaptureError) {
			throw new RefusedPreconditionError(error.message);
		}

		throw error;
	}
}

export async function runCaseCapture(
	request: CaseCaptureRequest,
	dependencies: CaseCaptureDependencies,
): Promise<void> {
	const caseId = requiredFlag(request.caseId, "the case id");
	const session = requiredFlag(request.session, "--session");
	const cut = parsedCut(requiredFlag(request.cut, "--cut"));
	const root = dependencies.casesDirectory ?? casesRoot();
	const declaration = await requireSessionDeclaration(caseId, root);

	const source = await resolved(dependencies.projectsDirectory, session);
	const file = `${source.sessionId}-cut-${String(cut)}.jsonl`;
	const destination = transcriptPrefixPath(caseId, file);
	await mkdir(dirname(destination), { recursive: true });
	const prefix = await captured(source.path, destination, cut);

	const updated: SessionCaseDeclaration = {
		...declaration,
		transcript: {
			file,
			sha256: prefix.sha256,
			sourceSession: source.sessionId,
			cut,
		},
	};
	await Bun.write(declarationFile(caseId, root), serialize(updated));

	dependencies.output.stdout(
		request.json ? serialize(updated) : `${declarationFile(caseId, root)}\n`,
	);
}
