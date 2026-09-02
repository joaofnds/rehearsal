import { describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { CaseDeclaration } from "#benchmark/case";
import { caseDeclarationSchema, CASES_DIRECTORY } from "#benchmark/case";
import { CONTROL_DIR, DEFAULT_CASE_ID } from "#benchmark/config";
import { failureOf, recordOutput } from "#cli/cli-test-support";
import { runCaseList, runCaseShow } from "#cli/case-command";
import { RefusedPreconditionError } from "#cli/interactive-stdin";

function printedDeclarations(text: string): readonly CaseDeclaration[] {
	return z.array(caseDeclarationSchema).parse(z.json().parse(JSON.parse(text)));
}

function printedDeclaration(text: string): CaseDeclaration {
	return caseDeclarationSchema.parse(z.json().parse(JSON.parse(text)));
}

describe(runCaseList.name, () => {
	it("prints one line per declared case with its id and title", async () => {
		const recorder = recordOutput();

		await runCaseList({ json: false }, recorder.output);

		expect(recorder.stderr).toEqual([]);
		const lines = recorder.stdout.join("").trimEnd().split("\n");
		expect(lines).toContain(
			`${DEFAULT_CASE_ID}\tAsynchronous audit log module against the NestJS template`,
		);
	});

	it("prints every declaration as one JSON array with --json", async () => {
		const recorder = recordOutput();

		await runCaseList({ json: true }, recorder.output);

		const declarations = printedDeclarations(recorder.stdout.join(""));

		expect(declarations.map(({ id }) => id)).toContain(DEFAULT_CASE_ID);
	});

	it("reports an unreadable case directory on stderr and still lists the rest", async () => {
		const stray = join(CONTROL_DIR, CASES_DIRECTORY, "zz-stray-probe");
		await mkdir(stray, { recursive: true });

		try {
			const recorder = recordOutput();

			await runCaseList({ json: false }, recorder.output);

			expect(recorder.stdout.join("")).toContain(DEFAULT_CASE_ID);
			expect(recorder.stderr.join("")).toContain("zz-stray-probe");
		} finally {
			await rm(stray, { force: true, recursive: true });
		}
	});
});

describe(runCaseShow.name, () => {
	it("prints exactly the parsed declaration with --json", async () => {
		const recorder = recordOutput();

		await runCaseShow({ caseId: DEFAULT_CASE_ID, json: true }, recorder.output);

		expect(recorder.stderr).toEqual([]);
		const printed = printedDeclaration(recorder.stdout.join(""));

		expect(printed.id).toBe(DEFAULT_CASE_ID);
	});

	it("prints the declaration file's path without --json", async () => {
		const recorder = recordOutput();

		await runCaseShow(
			{ caseId: DEFAULT_CASE_ID, json: false },
			recorder.output,
		);

		expect(recorder.stdout.join("")).toBe(
			`${join(CONTROL_DIR, CASES_DIRECTORY, DEFAULT_CASE_ID, "case.json")}\n`,
		);
	});

	it("refuses an unknown case as a refused precondition, naming it", async () => {
		const recorder = recordOutput();

		const failure = await failureOf(
			runCaseShow({ caseId: "missing", json: true }, recorder.output),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure.message).toContain("missing");
		expect(recorder.stdout).toEqual([]);
	});

	it("refuses a missing case id as a usage error", async () => {
		const recorder = recordOutput();

		const failure = await failureOf(
			runCaseShow({ caseId: undefined, json: true }, recorder.output),
		);

		expect(failure.message).toContain("rehearsal case show <case-id>");
	});
});
