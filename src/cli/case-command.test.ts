import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { CaseDeclaration } from "#benchmark/case";
import {
	caseDeclarationSchema,
	CASES_DIRECTORY,
	transcriptPrefixPath,
} from "#benchmark/case";
import { CONTROL_DIR, DEFAULT_CASE_ID } from "#benchmark/config";
import { benchmarkRunsDirectory } from "#benchmark/run-layout";
import type { OutputRecorder } from "#cli/cli-test-support";
import { failureOf, recordOutput } from "#cli/cli-test-support";
import type { CaseCaptureRequest } from "#cli/case-command";
import { runCaseCapture, runCaseList, runCaseShow } from "#cli/case-command";
import { UsageError } from "#cli/commands";
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

	it("names the case directory as a refused precondition when it is absent", async () => {
		const casesDirectory = join(CONTROL_DIR, CASES_DIRECTORY);
		const aside = `${casesDirectory}-absent-probe`;
		await rename(casesDirectory, aside);

		try {
			const failure = await failureOf(
				runCaseList({ json: false }, recordOutput().output),
			);

			expect(failure).toBeInstanceOf(RefusedPreconditionError);
			expect(failure.message).toContain(CASES_DIRECTORY);
		} finally {
			await rename(aside, casesDirectory);
		}
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

describe(runCaseCapture.name, () => {
	const CAPTURE_CASE_ID = "zz-capture-probe";
	const SESSION_ID = "aaaaaaaa-1111-2222-3333-444444444444";

	async function probeCase(): Promise<string> {
		const directory = join(CONTROL_DIR, CASES_DIRECTORY, CAPTURE_CASE_ID);
		await mkdir(directory, { recursive: true });
		await Bun.write(
			join(directory, "case.json"),
			`${JSON.stringify(
				{
					id: CAPTURE_CASE_ID,
					kind: "session",
					title: "Capture probe",
					prompt: "Say the codeword.",
					tools: [],
					corpusFiles: [],
					checks: [{ kind: "word-band", max: 1 }],
				},
				null,
				2,
			)}\n`,
		);

		return directory;
	}

	async function probeProjects(
		...sessionIds: readonly string[]
	): Promise<string> {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-capture-cli-"));
		const slug = join(directory, "-private-tmp-probe");
		await mkdir(slug, { recursive: true });
		for (const sessionId of sessionIds) {
			await Bun.write(
				join(slug, `${sessionId}.jsonl`),
				`${[0, 1, 2, 3]
					.map((ordinal) => JSON.stringify({ ordinal, sessionId }))
					.join("\n")}\n`,
			);
		}

		return directory;
	}

	async function capture(
		request: Omit<CaseCaptureRequest, "caseId">,
		projectsDirectory: string,
	): Promise<OutputRecorder> {
		const recorder = recordOutput();
		await runCaseCapture(
			{ caseId: CAPTURE_CASE_ID, ...request },
			{ projectsDirectory, output: recorder.output },
		);

		return recorder;
	}

	afterEach(async () => {
		await Promise.all([
			rm(join(CONTROL_DIR, CASES_DIRECTORY, CAPTURE_CASE_ID), {
				force: true,
				recursive: true,
			}),
			rm(
				join(
					benchmarkRunsDirectory(CONTROL_DIR),
					CASES_DIRECTORY,
					CAPTURE_CASE_ID,
				),
				{
					force: true,
					recursive: true,
				},
			),
		]);
	});

	it("writes the source's first cut lines under the run directory and records the digest", async () => {
		await probeCase();
		const projects = await probeProjects(SESSION_ID);

		const recorder = await capture(
			{ session: SESSION_ID, cut: "3", json: true },
			projects,
		);

		const printed = printedDeclaration(recorder.stdout.join(""));
		expect(printed).toMatchObject({
			transcript: { sourceSession: SESSION_ID, cut: 3 },
		});
		const written = await Bun.file(
			transcriptPrefixPath(
				CAPTURE_CASE_ID,
				z.object({ transcript: z.object({ file: z.string() }) }).parse(printed)
					.transcript.file,
			),
		).text();
		expect(written.trimEnd().split("\n")).toHaveLength(3);
	});

	it("records the transcript in the committed declaration on disk", async () => {
		const directory = await probeCase();
		const projects = await probeProjects(SESSION_ID);

		await capture({ session: SESSION_ID, cut: "2", json: false }, projects);

		const declaration = printedDeclaration(
			await Bun.file(join(directory, "case.json")).text(),
		);
		expect(declaration).toMatchObject({ transcript: { cut: 2 } });
	});

	it("resolves a unique session prefix", async () => {
		await probeCase();
		const projects = await probeProjects(SESSION_ID);

		const recorder = await capture(
			{ session: "aaaaaaaa", cut: "1", json: true },
			projects,
		);

		expect(printedDeclaration(recorder.stdout.join(""))).toMatchObject({
			transcript: { sourceSession: SESSION_ID },
		});
	});

	it("refuses a prefix that matches two sessions, naming both", async () => {
		await probeCase();
		const other = "aaaaaaaa-9999-9999-9999-999999999999";
		const projects = await probeProjects(SESSION_ID, other);

		const failure = await failureOf(
			capture({ session: "aaaaaaaa", cut: "1", json: true }, projects).then(
				() => undefined,
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure.message).toBe(
			`Session prefix aaaaaaaa matches 2 session files: ${SESSION_ID}, ${other}`,
		);
	});

	it("refuses a prefix that matches no session, naming the prefix", async () => {
		await probeCase();
		const projects = await probeProjects(SESSION_ID);

		const failure = await failureOf(
			capture({ session: "deadbeef", cut: "1", json: true }, projects).then(
				() => undefined,
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure.message).toBe(
			"Session prefix deadbeef matches no session file",
		);
	});

	it.each(["0", "-1", "5"])(
		"refuses a cut of %s as a usage error, naming the index and the line count",
		async (cut) => {
			await probeCase();
			const projects = await probeProjects(SESSION_ID);

			const failure = await failureOf(
				capture({ session: SESSION_ID, cut, json: true }, projects).then(
					() => undefined,
				),
			);

			expect(failure).toBeInstanceOf(UsageError);
			expect(failure.message).toBe(
				`Cut ${cut} is outside the source's 4 lines`,
			);
		},
	);

	it("refuses a pipeline case as a precondition, naming why", async () => {
		const projects = await probeProjects(SESSION_ID);
		const recorder = recordOutput();

		const failure = await failureOf(
			runCaseCapture(
				{
					caseId: DEFAULT_CASE_ID,
					session: SESSION_ID,
					cut: "1",
					json: true,
				},
				{ projectsDirectory: projects, output: recorder.output },
			),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure.message).toContain("only a session case");
	});
});
