import { join } from "node:path";
import type { BenchmarkCase, CaseDeclaration } from "#benchmark/case";
import {
	CaseDeclarationError,
	CASES_DIRECTORY,
	listCases,
	loadCase,
	readCaseDeclaration,
} from "#benchmark/case";
import { CONTROL_DIR } from "#benchmark/config";
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

export function requireCase(caseId: string): Promise<BenchmarkCase> {
	return asRefusedPrecondition(() => loadCase(caseId));
}

function declarationFile(caseId: string): string {
	return join(CONTROL_DIR, CASES_DIRECTORY, caseId, "case.json");
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
