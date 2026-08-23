import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	applyHarnessResults,
	assertConventionalCommitSubjects,
	assertSourceReady,
	captureCheckIntegrity,
	captureFileHashes,
	createWorkspace,
	type JudgeGrade,
	parseArgs,
	parseJudgeOutput,
	RUBRIC_IDS,
	runCommand,
	validateJudgeEvidence,
} from "./run_benchmark";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((path) => rm(path, { force: true, recursive: true })),
	);
});

describe(parseArgs, () => {
	it("resolves explicit configuration", () => {
		const config = parseArgs([
			"--target",
			"./target",
			"--model",
			"claude-opus-4-8",
			"--judge-model",
			"claude-sonnet-4-6",
			"--session-budget-usd",
			"5",
		]);

		expect(config).toEqual({
			sourceDir: join(process.cwd(), "target"),
			model: "claude-opus-4-8",
			judgeModel: "claude-sonnet-4-6",
			sessionBudgetUsd: 5,
		});
	});

	it("rejects moving model aliases", () => {
		expect(() =>
			parseArgs([
				"--target",
				"./target",
				"--model",
				"opus",
				"--session-budget-usd",
				"5",
			]),
		).toThrow("Use a full Claude model ID");
	});

	it("rejects missing spend limits", () => {
		expect(() =>
			parseArgs(["--target", "./target", "--model", "claude-opus-4-8"]),
		).toThrow("Provide --session-budget-usd");
	});
});

describe(parseJudgeOutput, () => {
	it("accepts a complete consistent grade", () => {
		const grade = completeGrade("PASS");

		const parsed = parseJudgeOutput(
			JSON.stringify({ structured_output: grade }),
		);

		expect(parsed).toEqual(grade);
	});

	it("rejects a verdict that contradicts requirement results", () => {
		const grade = completeGrade("PASS");
		grade.requirements[0] = requirement(RUBRIC_IDS[0], "FAIL");

		expect(() => parseJudgeOutput(JSON.stringify(grade))).toThrow(
			"contradicts requirement results",
		);
	});

	it("rejects an incomplete grade", () => {
		const grade = completeGrade("PASS");
		grade.requirements.pop();

		expect(() => parseJudgeOutput(JSON.stringify(grade))).toThrow(
			"every rubric requirement exactly once",
		);
	});
});

describe(applyHarnessResults, () => {
	it("forces a failed verdict when local checks fail", () => {
		const result = applyHarnessResults(
			completeGrade("PASS"),
			harnessResult("PASS", "check definitions match"),
			harnessResult("FAIL", "unit tests exited 1"),
		);

		expect(result.verdict).toBe("FAIL");
		expect(
			result.requirements.find(({ id }) => id === "local-checks")?.status,
		).toBe("FAIL");
	});
});

describe(validateJudgeEvidence, () => {
	it("accepts citations to supplied diff and context paths", () => {
		const grade = completeGrade("PASS");

		expect(() =>
			validateJudgeEvidence(
				grade,
				["src/audit/example.ts"],
				["src/app.module.ts"],
			),
		).not.toThrow();
	});

	it("rejects citations to unavailable paths", () => {
		const grade = completeGrade("PASS");
		grade.requirements[0] = {
			...grade.requirements[0],
			evidence: [
				{
					source: "baseline-context",
					path: "missing.ts",
					claim: "unsupported",
				},
			],
		};

		expect(() =>
			validateJudgeEvidence(
				grade,
				["src/audit/example.ts"],
				["src/app.module.ts"],
			),
		).toThrow("cited unavailable evidence");
	});
});

describe(assertConventionalCommitSubjects, () => {
	it("accepts conventional commit subjects", () => {
		expect(() =>
			assertConventionalCommitSubjects([
				"feat(audit): add worker",
				"fix: wire persistence",
			]),
		).not.toThrow();
	});

	it("rejects free-form commit subjects", () => {
		expect(() => assertConventionalCommitSubjects(["Implement audit"])).toThrow(
			"non-conventional commit subjects",
		);
	});
});

describe(assertSourceReady, () => {
	it("rejects a clean repository off main", async () => {
		const source = await createRepository();
		await runCommand(["git", "switch", "-c", "feature"], source.directory);

		await expect(assertSourceReady(source.directory)).rejects.toThrow(
			"Target must be on main",
		);
	});

	it("rejects a repository subdirectory", async () => {
		const source = await createRepository();
		const subdirectory = join(source.directory, "nested");
		await mkdir(subdirectory);

		await expect(assertSourceReady(subdirectory)).rejects.toThrow(
			"Target must be the repository root",
		);
	});
});

describe(createWorkspace, () => {
	it("isolates generated commits from the source repository", async () => {
		const source = await createRepository();
		const baseline = await assertSourceReady(source.directory);
		const workspace = await createWorkspace(baseline);
		temporaryDirectories.push(workspace);
		await Bun.write(
			join(workspace, "generated.ts"),
			"export const value = 1;\n",
		);
		await commitAll(workspace, "feat: generate change");

		expect(
			await runCommand(["git", "rev-parse", "HEAD"], source.directory),
		).toBe(`${source.sha}\n`);
		expect(
			await runCommand(["git", "status", "--porcelain"], source.directory),
		).toBe("");
		expect(await runCommand(["git", "remote"], workspace)).toBe("");
	});
});

describe(captureCheckIntegrity, () => {
	it("fails when a candidate weakens a check definition", async () => {
		const source = await createRepository();
		const baselineHashes = await captureFileHashes(source.directory);
		await Bun.write(
			join(source.directory, "package.json"),
			'{"scripts":{"typecheck":"true","check":"true","test:unit":"true"}}\n',
		);

		const result = await captureCheckIntegrity(
			source.directory,
			baselineHashes,
		);

		expect(result.status).toBe("FAIL");
		expect(result.evidence[0]?.claim).toContain("package.json");
	});
});

function completeGrade(verdict: "PASS" | "FAIL"): JudgeGrade {
	return {
		requirements: RUBRIC_IDS.map((id) => requirement(id, verdict)),
		verdict,
		summary: "complete",
	};
}

function requirement(
	id: (typeof RUBRIC_IDS)[number],
	status: "PASS" | "FAIL",
): JudgeGrade["requirements"][number] {
	return {
		id,
		status,
		evidence: [
			{
				source: "diff",
				path: "src/audit/example.ts",
				claim: `${id} evidence`,
			},
		],
	};
}

function harnessResult(status: "PASS" | "FAIL", claim: string) {
	return {
		status,
		evidence: [
			{
				source: "local-checks" as const,
				path: "harness",
				claim,
			},
		],
	};
}

async function createRepository() {
	const directory = await mkdtemp(join(tmpdir(), "template-source-"));
	temporaryDirectories.push(directory);
	await runCommand(["git", "init", "-b", "main"], directory);
	await runCommand(["git", "config", "user.name", "Benchmark Test"], directory);
	await runCommand(
		["git", "config", "user.email", "benchmark@example.com"],
		directory,
	);
	await Bun.write(join(directory, "base.txt"), "base\n");
	await Bun.write(
		join(directory, "package.json"),
		'{"scripts":{"typecheck":"tsc --noEmit","check":"biome check","test:unit":"bun test src"}}\n',
	);
	await runCommand(["bun", "install"], directory);
	await commitAll(directory, "chore: base");
	const sha = (
		await runCommand(["git", "rev-parse", "HEAD"], directory)
	).trim();

	return { directory, sha };
}

async function commitAll(directory: string, message: string) {
	await runCommand(["git", "add", "."], directory);
	await runCommand(["git", "commit", "-m", message], directory);
}
