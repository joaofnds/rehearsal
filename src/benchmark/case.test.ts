import { describe, expect, it } from "bun:test";
import {
	CASES_DIRECTORY,
	caseRelative,
	listCases,
	loadCase,
	parseCaseDeclaration,
} from "#benchmark/case";
import { CONTROL_DIR, DEFAULT_CASE_ID } from "#benchmark/config";
import { mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runCommand } from "#benchmark/command";
import { pipelineDefinitionSchema } from "#benchmark/pipeline";
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
		const benchmarkCase = await loadCase("audit-log");

		const target = await stat(benchmarkCase.targetPath);
		expect(target.isDirectory()).toBe(true);
	});

	it("resolves a relative declared target against the case directory", async () => {
		const benchmarkCase = await loadCase("audit-log");

		expect(benchmarkCase.targetPath).toBe(
			resolve(
				CONTROL_DIR,
				"cases/audit-log",
				benchmarkCase.declaration.target.path,
			),
		);
	});

	it("returns the audit-log task, brief, and final rubric byte for byte", async () => {
		const benchmarkCase = await loadCase("audit-log");

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
		const benchmarkCase = await loadCase("audit-log");

		expect(benchmarkCase.stageRubrics["shape"]?.content).toBe(
			await bytesBeforeTheMove("rubrics/shape.json"),
		);
		expect(benchmarkCase.stageRubrics["build"]?.content).toBe(
			await bytesBeforeTheMove("rubrics/build.json"),
		);
	});

	it("returns the audit-log pipeline definition as it was before the move, with its rubrics rehomed", async () => {
		const benchmarkCase = await loadCase("audit-log");

		const before = await bytesBeforeTheMove("pipelines/default.json");
		const rehomed: unknown = JSON.parse(
			before.replaceAll('"rubrics/', '"cases/audit-log/rubrics/'),
		);
		expect(benchmarkCase.pipeline).toEqual(
			pipelineDefinitionSchema.parse(rehomed),
		);
	});
});
