import { describe, expect, it } from "bun:test";
import {
	CASES_DIRECTORY,
	caseRelative,
	listCases,
	loadCase,
	parseCaseDeclaration,
	requirePipelineCase,
	requireSessionCase,
	transcriptPrefixPath,
} from "#benchmark/case";
import { CONTROL_DIR, DEFAULT_CASE_ID } from "#benchmark/config";
import type { Immutable } from "#benchmark/contracts";
import type { JsonObject } from "#benchmark/json-value";
import { mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runCommand } from "#benchmark/command";
import { pipelineDefinitionSchema } from "#benchmark/pipeline";
import { benchmarkRunsDirectory } from "#benchmark/run-layout";
import { PROJECT_ROOT, TestResources } from "#benchmark/test-support";

/**
 * The commit before the case files moved out of the control root. Reading the
 * bytes from Git rather than from the working tree is what makes this a
 * characterization: the move cannot quietly rewrite both sides at once.
 */
const COMMIT_BEFORE_THE_MOVE = "ccfdeb017667a0a1db9027a5e014b7e5650b7935";

function bytesBeforeTheMove(path: string): Promise<string> {
	return runCommand(
		["git", "show", `${COMMIT_BEFORE_THE_MOVE}:${path}`],
		PROJECT_ROOT,
	);
}

describe(parseCaseDeclaration.name, () => {
	function declaration(id = "audit-log"): string {
		return JSON.stringify({
			id,
			kind: "pipeline",
			title: "Audit log",
			task: "backlog-seed.md",
			productBrief: "product-brief.md",
			finalRubric: "rubric.md",
			pipeline: "pipelines/default.json",
			rubrics: "rubrics",
			target: { path: "../../../nest/template" },
		});
	}

	it("refuses a declaration whose id is not its directory name, naming both", () => {
		expect(() =>
			parseCaseDeclaration("audit-log", declaration("other")),
		).toThrow(
			"Case declaration id other does not match its directory name audit-log",
		);
	});

	it("accepts a declaration whose id is its directory name", () => {
		expect(parseCaseDeclaration("audit-log", declaration()).id).toBe(
			"audit-log",
		);
	});
});

describe(caseRelative.name, () => {
	const declaration = {
		id: "audit-log",
		kind: "pipeline",
		title: "Audit log",
		task: "backlog-seed.md",
		productBrief: "product-brief.md",
		finalRubric: "rubric.md",
		pipeline: "pipelines/default.json",
		rubrics: "rubrics",
		target: { path: "/target" },
	} as const;

	it.each(["/etc/passwd", "../../CLAUDE.md", "rubrics/../../CLAUDE.md"])(
		"refuses %s, which leaves the case directory",
		(path) => {
			expect(() => caseRelative(declaration, path)).toThrow(
				`Case audit-log names a path outside its case directory: ${path}`,
			);
		},
	);

	it("resolves a path inside the case directory against it", () => {
		expect(caseRelative(declaration, "rubrics/shape.json")).toBe(
			join(CONTROL_DIR, "cases/audit-log/rubrics/shape.json"),
		);
	});
});

describe(listCases.name, () => {
	const resources = TestResources.forEachTest();

	it("lists the readable cases past a directory that holds no declaration", async () => {
		const stray = join(CONTROL_DIR, CASES_DIRECTORY, "zz-stray-probe");
		resources.track(stray);
		await mkdir(stray, { recursive: true });

		const listing = await listCases();

		expect(listing.declarations.map(({ id }) => id)).toContain("audit-log");
		expect(listing.unreadable).toEqual([
			{
				id: "zz-stray-probe",
				reason:
					"Unknown case zz-stray-probe: no declaration at cases/zz-stray-probe/case.json",
			},
		]);
	});
});

describe("loadCase", () => {
	it("resolves the same case whether the id is default or named", async () => {
		const [byDefault, byName] = await Promise.all([
			loadCase(DEFAULT_CASE_ID),
			loadCase("audit-log"),
		]);

		expect(byDefault).toEqual(byName);
	});

	it("refuses a case with no declaration on disk, naming it", () => {
		expect(loadCase("missing")).rejects.toThrow("Unknown case missing");
	});

	it("resolves the declared target to a directory that exists", async () => {
		const benchmarkCase = requirePipelineCase(await loadCase("audit-log"));

		const target = await stat(benchmarkCase.targetPath);
		expect(target.isDirectory()).toBe(true);
	});

	it("resolves a relative declared target against the case directory", async () => {
		const benchmarkCase = requirePipelineCase(await loadCase("audit-log"));

		expect(benchmarkCase.targetPath).toBe(
			resolve(
				CONTROL_DIR,
				"cases/audit-log",
				benchmarkCase.declaration.target.path,
			),
		);
	});

	it("returns the audit-log task, brief, and final rubric byte for byte", async () => {
		const benchmarkCase = requirePipelineCase(await loadCase("audit-log"));

		expect(benchmarkCase.task).toBe(
			await bytesBeforeTheMove("backlog-seed.md"),
		);
		expect(benchmarkCase.productBrief).toBe(
			await bytesBeforeTheMove("product-brief.md"),
		);
		expect(benchmarkCase.finalRubric).toBe(
			await bytesBeforeTheMove("rubric.md"),
		);
	});

	it("returns the audit-log stage rubrics byte for byte", async () => {
		const benchmarkCase = requirePipelineCase(await loadCase("audit-log"));

		expect(benchmarkCase.stageRubrics["shape"]?.content).toBe(
			await bytesBeforeTheMove("rubrics/shape.json"),
		);
		expect(benchmarkCase.stageRubrics["build"]?.content).toBe(
			await bytesBeforeTheMove("rubrics/build.json"),
		);
	});

	it("returns the audit-log pipeline definition as it was before the move, with its rubrics rehomed", async () => {
		const benchmarkCase = requirePipelineCase(await loadCase("audit-log"));

		const before = await bytesBeforeTheMove("pipelines/default.json");
		const rehomed: unknown = JSON.parse(
			before.replaceAll('"rubrics/', '"cases/audit-log/rubrics/'),
		);
		expect(benchmarkCase.pipeline).toEqual(
			pipelineDefinitionSchema.parse(rehomed),
		);
	});
});

describe("loadCase for a session case", () => {
	function sessionDeclaration(overrides: Immutable<JsonObject> = {}): string {
		return JSON.stringify({
			id: "smoke",
			kind: "session",
			title: "Smoke",
			prompt: "Reply with the single word OK.",
			tools: [],
			corpusFiles: [],
			checks: [{ kind: "word-band", max: 1 }],
			...overrides,
		});
	}

	it("returns the smoke case carrying its prompt, tools, and checks", async () => {
		const loaded = requireSessionCase(await loadCase("smoke"));

		expect(loaded).toMatchObject({
			prompt: "Reply with the single word OK.",
			tools: [],
			checks: [
				{ kind: "word-band", max: 1 },
				{ kind: "tool-calls", max: 0 },
			],
		});
	});

	it.each(["/etc", "../../CLAUDE.md"])(
		"refuses a fixture at %s, which leaves the case directory",
		(fixture) => {
			const declaration = parseCaseDeclaration(
				"smoke",
				sessionDeclaration({ fixture }),
			);

			expect(() => caseRelative(declaration, fixture)).toThrow(
				`Case smoke names a path outside its case directory: ${fixture}`,
			);
		},
	);

	it("refuses a session declaration carrying a pipeline field, naming the key", () => {
		expect(() =>
			parseCaseDeclaration(
				"smoke",
				sessionDeclaration({ pipeline: "pipelines/default.json" }),
			),
		).toThrow(
			'Case smoke declaration has an invalid declaration: Unrecognized key: "pipeline"',
		);
	});
});

describe("loadCase for the brief-reply cases", () => {
	const TURNS = [
		{
			caseId: "brief-reply-e3dea673",
			sourceSession: "e3dea673-663a-4a3e-b89f-4ffb568e7109",
			cut: 873,
			acceptedWords: 145,
		},
		{
			caseId: "brief-reply-02f0f204",
			sourceSession: "02f0f204-613d-49d2-8999-67ba79fedbb1",
			cut: 1270,
			acceptedWords: 136,
		},
		{
			caseId: "brief-reply-40878d26",
			sourceSession: "40878d26-3572-4a08-a668-4e4c275e462e",
			cut: 491,
			acceptedWords: 108,
		},
		{
			caseId: "brief-reply-92b2e8b0",
			sourceSession: "92b2e8b0-1cac-4855-87be-ba84d5cee5b9",
			cut: 1268,
			acceptedWords: 76,
		},
	];

	it.each(TURNS)(
		"cuts $caseId at its own turn and states the accepted length in its title",
		async ({ caseId, sourceSession, cut, acceptedWords }) => {
			const loaded = requireSessionCase(await loadCase(caseId));

			expect(loaded.declaration.title).toContain(
				`${String(acceptedWords)} words`,
			);
			expect(loaded.declaration).toMatchObject({
				transcript: { sourceSession, cut },
			});
		},
	);

	it.each(TURNS)(
		"judges $caseId by a band with a ceiling and no floor, the em dash alone, and no tool calls",
		async ({ caseId }) => {
			const loaded = requireSessionCase(await loadCase(caseId));

			expect(loaded.checks).toEqual([
				{ kind: "word-band", max: 154 },
				{ kind: "forbidden-text", strings: ["\u2014"] },
				{ kind: "tool-calls", max: 0 },
			]);
		},
	);

	/**
	 * The four cases differ only in which turn they resume: what they run is
	 * one measurement of one corpus file under one style, so every case that
	 * lost the overlay, the corpus file, or the prompt would be measuring
	 * something else while still passing every per-turn assertion above.
	 */
	it.each(TURNS)(
		"runs $caseId against the brief style overlay with the same prompt, no tools, and the one corpus file it reads",
		async ({ caseId }) => {
			const loaded = requireSessionCase(await loadCase(caseId));

			expect(loaded).toMatchObject({
				prompt:
					"Tools are unavailable now. Write your reply to João for this turn.",
				tools: [],
				settings: { outputStyle: "brief" },
				corpusFiles: ["output-styles/brief.md"],
			});
		},
	);
});

describe(transcriptPrefixPath.name, () => {
	it("resolves a declared file under the case's own prefix directory", () => {
		expect(transcriptPrefixPath("smoke", "prefix.jsonl")).toBe(
			join(
				benchmarkRunsDirectory(CONTROL_DIR),
				CASES_DIRECTORY,
				"smoke",
				"prefix.jsonl",
			),
		);
	});

	it.each([
		"../../../../../../etc/passwd",
		"/etc/passwd",
		"../audit-log/x.jsonl",
	])(
		"refuses a transcript at %s, which leaves the case's prefix directory",
		(file) => {
			expect(() => transcriptPrefixPath("smoke", file)).toThrow(
				`Case smoke names a transcript outside its prefix directory: ${file}`,
			);
		},
	);
});
