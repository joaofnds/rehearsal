import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assertStageArtifactState,
	parseTaskState,
} from "./src/benchmark/backlog";
import {
	parseHumanReview,
	validateCalibration,
} from "./src/benchmark/calibration";
import {
	captureBaselineContext,
	captureCheckIntegrity,
	captureFileHashes,
} from "./src/benchmark/checks";
import { runCommand } from "./src/benchmark/command";
import { parseArgs, RUBRIC_IDS, WORKFLOW_STAGES } from "./src/benchmark/config";
import type {
	HumanReview,
	JudgeGrade,
	StageJudgeOutput,
	StageScorecard,
} from "./src/benchmark/contracts";
import { StageValidationError } from "./src/benchmark/contracts";
import {
	applyHarnessResults,
	parseJudgeOutput,
	parseRubricIds,
	validateJudgeEvidence,
} from "./src/benchmark/judge";
import {
	applyAuthoritativeStageResults,
	captureStageJudgeInput,
	deriveStageGrade,
	parseStageRubric,
	runStageGates,
	validateStageJudgeEvidence,
} from "./src/benchmark/stage-grading";
import {
	assertBuildCommitted,
	assertConventionalCommitSubjects,
	assertSourceReady,
	captureBuildCandidate,
	captureWorkflowBackup,
	restoreTarget,
} from "./src/benchmark/target";
import { createWorkflowCommand } from "./src/benchmark/workflow";

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
			"sonnet",
			"--effort",
			"high",
			"--judge-model",
			"sonnet",
			"--judge-effort",
			"high",
			"--session-budget-usd",
			"5",
		]);

		expect(config).toEqual({
			sourceDir: join(process.cwd(), "target"),
			model: "sonnet",
			effort: "high",
			judgeModel: "sonnet",
			judgeEffort: "high",
			sessionBudgetUsd: 5,
		});
	});

	it("defaults Judge effort to workflow effort", () => {
		const config = parseArgs([
			"--target",
			"./target",
			"--model",
			"sonnet",
			"--effort",
			"xhigh",
			"--session-budget-usd",
			"5",
		]);

		expect(config.judgeModel).toBe("sonnet");
		expect(config.judgeEffort).toBe("xhigh");
	});

	it("rejects unsupported effort levels", () => {
		expect(() =>
			parseArgs([
				"--target",
				"./target",
				"--model",
				"sonnet",
				"--effort",
				"extreme",
				"--session-budget-usd",
				"5",
			]),
		).toThrow("Unsupported effort");
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

	it("accepts requirements added to the rubric without a code change", () => {
		const grade = completeGrade("PASS");
		grade.requirements.push(requirement("human-review", "PASS"));

		const parsed = parseJudgeOutput(JSON.stringify(grade), [
			...RUBRIC_IDS,
			"human-review",
		]);

		expect(parsed).toEqual(grade);
	});
});

describe(parseRubricIds, () => {
	it("derives requirement IDs from the rubric", () => {
		const ids = parseRubricIds(
			"1. `first`: First requirement.\n2. `new-check`: New requirement.\n",
		);

		expect(ids).toEqual(["first", "new-check"]);
	});

	it("rejects duplicate requirement IDs", () => {
		expect(() =>
			parseRubricIds("1. `same`: First.\n2. `same`: Duplicate.\n"),
		).toThrow("unique requirement IDs");
	});
});

describe(parseHumanReview, () => {
	it("parses a structured human review", () => {
		const review = parseHumanReview(
			JSON.stringify({
				verdict: "REJECT",
				summary: "The worker loses metadata.",
				findings: [
					{
						description: "The worker drops request metadata.",
						paths: ["src/audit/worker.ts"],
						judgeAssessment: "MISSED",
						rubricId: "worker-metadata",
					},
				],
			}),
		);

		expect(review.verdict).toBe("REJECT");
		expect(review.findings[0]?.rubricId).toBe("worker-metadata");
	});

	it("requires a rubric ID for Judge-related findings", () => {
		expect(() =>
			parseHumanReview(
				JSON.stringify({
					verdict: "REJECT",
					summary: "The Judge missed a defect.",
					findings: [
						{
							description: "Missing worker behavior.",
							paths: [],
							judgeAssessment: "MISSED",
							rubricId: null,
						},
					],
				}),
			),
		).toThrow();
	});
});

describe(validateCalibration, () => {
	it("accepts a missed defect caught by the revised rubric", () => {
		const original = completeGrade("PASS");
		const revised = completeGrade("PASS");
		revised.requirements.push(requirement("worker-metadata", "FAIL"));
		revised.verdict = "FAIL";
		const review = humanReview("REJECT", "MISSED", "worker-metadata");

		expect(() => validateCalibration(review, original, revised)).not.toThrow();
	});

	it("rejects a missed defect that the revised rubric still passes", () => {
		const original = completeGrade("PASS");
		const revised = completeGrade("PASS");
		revised.requirements.push(requirement("worker-metadata", "PASS"));
		const review = humanReview("REJECT", "MISSED", "worker-metadata");

		expect(() => validateCalibration(review, original, revised)).toThrow(
			"does not catch",
		);
	});

	it("rejects a missed classification for a defect already caught", () => {
		const original = completeGrade("PASS");
		original.requirements[0] = requirement(RUBRIC_IDS[0], "FAIL");
		original.verdict = "FAIL";
		const revised = completeGrade("FAIL");
		const review = humanReview("REJECT", "MISSED", RUBRIC_IDS[0]);

		expect(() => validateCalibration(review, original, revised)).toThrow(
			"already caught",
		);
	});

	it("accepts a corrected false positive", () => {
		const original = completeGrade("PASS");
		original.requirements[0] = requirement(RUBRIC_IDS[0], "FAIL");
		original.verdict = "FAIL";
		const revised = completeGrade("PASS");
		const review = humanReview("ACCEPT", "FALSE_POSITIVE", RUBRIC_IDS[0]);

		expect(() => validateCalibration(review, original, revised)).not.toThrow();
	});

	it("rejects acceptance when a real defect was found", () => {
		const review = humanReview("ACCEPT", "CAUGHT", RUBRIC_IDS[0]);

		expect(() => validateCalibration(review, completeGrade("FAIL"))).toThrow(
			"cannot accept",
		);
	});

	it("validates a missed stage requirement against the revised stage rubric", () => {
		const review = humanReview("REJECT", "MISSED", "scope");
		const finding = review.findings[0];
		if (!finding) throw new Error("Expected a finding");
		finding.stage = "discuss";

		expect(() =>
			validateCalibration(
				review,
				undefined,
				undefined,
				[stageScorecard("PASS")],
				[stageScorecard("FAIL")],
			),
		).not.toThrow();
	});

	it("accepts a missed stage defect added as a new rubric requirement", () => {
		const review = humanReview("REJECT", "MISSED", "worker-metadata");
		const finding = review.findings[0];
		if (!finding) throw new Error("Expected a finding");
		finding.stage = "discuss";

		expect(() =>
			validateCalibration(
				review,
				undefined,
				undefined,
				[stageScorecard("PASS")],
				[stageScorecard("FAIL", "worker-metadata")],
			),
		).not.toThrow();
	});
});

describe("workflow stages", () => {
	it("hardens the design before planning and building", () => {
		expect(WORKFLOW_STAGES).toEqual(["discuss", "grill", "plan", "build"]);
	});
});

describe(createWorkflowCommand, () => {
	it("loads native project and user customizations", () => {
		const command = createWorkflowCommand(
			"sonnet",
			5,
			"/discuss TASK-1",
			"high",
		);

		expect(command).not.toContain("--safe-mode");
		expect(command).not.toContain("--disable-slash-commands");
		expect(command).not.toContain("--strict-mcp-config");
		expect(command).toContain("--dangerously-skip-permissions");
		expect(command).toContain("--effort");
		expect(command).toContain("high");
		expect(command).toContain("/discuss TASK-1");
		expect(command[command.indexOf("--json-schema") + 1]).not.toContain(
			'"$schema"',
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

	it("accepts glob citations that resolve to supplied paths", () => {
		const grade = completeGrade("PASS");
		grade.requirements[0] = {
			...grade.requirements[0],
			evidence: [
				{
					source: "diff",
					path: "src/audit-log/*",
					claim: "audit-log implementation files changed",
				},
			],
		};

		expect(() =>
			validateJudgeEvidence(
				grade,
				["src/audit/example.ts", "src/audit-log/audit-log.module.ts"],
				["src/app.module.ts"],
			),
		).not.toThrow();
	});

	it("rejects glob citations that do not resolve to supplied paths", () => {
		const grade = completeGrade("PASS");
		grade.requirements[0] = {
			...grade.requirements[0],
			evidence: [
				{
					source: "diff",
					path: "src/missing/*",
					claim: "unsupported",
				},
			],
		};

		expect(() =>
			validateJudgeEvidence(
				grade,
				["src/audit/example.ts", "src/audit-log/audit-log.module.ts"],
				["src/app.module.ts"],
			),
		).toThrow("cited unavailable evidence");
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

describe(assertStageArtifactState, () => {
	const view = {
		task: {
			acceptanceCriteria: [{}],
			documentation: ["doc-1", "doc-2", "doc-3"],
		},
	};

	it("resolves attached document IDs to titled artifact files", () => {
		expect(() =>
			assertStageArtifactState("plan", view, [
				"doc-1 - Asynchronous-audit-log-module-spec.md",
				"doc-2 - Asynchronous-audit-log-module-grilled.md",
				"doc-3 - Asynchronous-audit-log-module-plan.md",
			]),
		).not.toThrow();
	});

	it("rejects an unattached document with the expected suffix", () => {
		expect(() =>
			assertStageArtifactState("plan", view, ["doc-4 - Unattached-plan.md"]),
		).toThrow("without its durable plan document");
	});

	it("accepts Backlog documentation paths as attachment references", () => {
		expect(() =>
			assertStageArtifactState(
				"discuss",
				{
					task: {
						acceptanceCriteria: [{}],
						documentation: ["backlog/docs/doc-1 - audit-log-module-spec.md"],
					},
				},
				["doc-1 - audit-log-module-spec.md"],
			),
		).not.toThrow();
	});
});

describe(parseTaskState, () => {
	it("classifies malformed Backlog output as candidate validation failure", () => {
		expect(() => parseTaskState("not json")).toThrow(StageValidationError);
	});
});

describe(deriveStageGrade, () => {
	const rubric = parseStageRubric(
		JSON.stringify({
			stage: "discuss",
			hardBlockers: [
				{
					id: "invalid-stage-delivery",
					description: "Valid delivery",
				},
				{ id: "contradiction", description: "No conflict" },
			],
			requirements: [{ id: "scope", description: "Scope is explicit" }],
			dimensions: [
				{
					id: "clarity",
					description: "Clear output",
					good: "Concrete",
					excellent: "Precise",
				},
			],
		}),
		"discuss",
	);

	it("continues when every requirement passes and quality is B", () => {
		const grade = deriveStageGrade(
			stageJudgeOutput("PASS", "PASS", "B"),
			rubric,
		);

		expect(grade.grade).toBe("B");
		expect(grade.verdict).toBe("CONTINUE");
	});

	it("stops with F when a hard blocker is triggered", () => {
		const grade = deriveStageGrade(
			stageJudgeOutput("FAIL", "PASS", "A"),
			rubric,
		);

		expect(grade.grade).toBe("F");
		expect(grade.verdict).toBe("STOP");
	});

	it("caps a missing requirement below B", () => {
		const grade = deriveStageGrade(
			stageJudgeOutput("PASS", "FAIL", "A"),
			rubric,
		);

		expect(grade.grade).toBe("C");
		expect(grade.verdict).toBe("STOP");
	});

	it("uses the worst quality dimension without averaging", () => {
		const grade = deriveStageGrade(
			stageJudgeOutput("PASS", "PASS", "C"),
			rubric,
		);

		expect(grade.grade).toBe("C");
		expect(grade.verdict).toBe("STOP");
	});

	it("loads a complete rubric for every workflow stage", async () => {
		for (const stage of WORKFLOW_STAGES) {
			const content = await Bun.file(
				join(import.meta.dir, "rubrics", `${stage}.json`),
			).text();
			expect(() => parseStageRubric(content, stage)).not.toThrow();
		}
	});

	it("rejects IDs reused across rubric sections", () => {
		expect(() =>
			parseStageRubric(
				JSON.stringify({
					stage: "discuss",
					hardBlockers: [
						{
							id: "invalid-stage-delivery",
							description: "Valid delivery",
						},
						{ id: "same", description: "Blocker" },
					],
					requirements: [{ id: "same", description: "Requirement" }],
					dimensions: [
						{
							id: "quality",
							description: "Quality",
							good: "Good",
							excellent: "Excellent",
						},
					],
				}),
				"discuss",
			),
		).toThrow("IDs must be unique");
	});

	it("rejects removal of a harness-owned blocker", () => {
		expect(() =>
			parseStageRubric(
				JSON.stringify({
					stage: "discuss",
					hardBlockers: [],
					requirements: [{ id: "scope", description: "Scope" }],
					dimensions: [
						{
							id: "clarity",
							description: "Clarity",
							good: "Good",
							excellent: "Excellent",
						},
					],
				}),
				"discuss",
			),
		).toThrow("must retain harness blockers");
	});
});

describe(applyAuthoritativeStageResults, () => {
	it("forces Build to F when local checks fail", async () => {
		const rubric = parseStageRubric(
			await Bun.file(join(import.meta.dir, "rubrics", "build.json")).text(),
			"build",
		);
		const output = passingStageOutput(rubric);
		const input = stageJudgeInput("build", {
			localChecks: harnessResult("FAIL", "unit tests exited 1"),
			checkIntegrity: harnessResult("PASS", "check definitions match"),
		});

		const grade = deriveStageGrade(
			applyAuthoritativeStageResults(output, input),
			rubric,
		);

		expect(grade.grade).toBe("F");
		expect(
			grade.hardBlockers.find(({ id }) => id === "unfinished-delivery")?.status,
		).toBe("FAIL");
	});

	it("forces Build to F when check definitions change", async () => {
		const rubric = parseStageRubric(
			await Bun.file(join(import.meta.dir, "rubrics", "build.json")).text(),
			"build",
		);
		const output = passingStageOutput(rubric);
		const input = stageJudgeInput("build", {
			localChecks: harnessResult("PASS", "unit tests passed"),
			checkIntegrity: harnessResult("FAIL", "package.json changed"),
		});

		const grade = deriveStageGrade(
			applyAuthoritativeStageResults(output, input),
			rubric,
		);

		expect(grade.grade).toBe("F");
		expect(
			grade.hardBlockers.find(({ id }) => id === "false-test-safety")?.status,
		).toBe("FAIL");
	});

	it("forces a malformed stage delivery to F", async () => {
		const rubric = parseStageRubric(
			await Bun.file(join(import.meta.dir, "rubrics", "discuss.json")).text(),
			"discuss",
		);
		const output = passingStageOutput(rubric);
		const input = stageJudgeInput("discuss", {
			harnessFailure: "Discuss completed without its durable spec document",
		});

		const grade = deriveStageGrade(
			applyAuthoritativeStageResults(output, input),
			rubric,
		);

		expect(grade.grade).toBe("F");
		expect(
			grade.hardBlockers.find(({ id }) => id === "invalid-stage-delivery")
				?.status,
		).toBe("FAIL");
	});
});

describe(captureStageJudgeInput, () => {
	it("turns invalid stage delivery into Judge evidence", async () => {
		const fallback = stageJudgeInput("discuss");

		const input = await captureStageJudgeInput(fallback, async () => {
			throw new StageValidationError(
				"Discuss completed without its durable spec document",
			);
		});

		expect(input.harnessFailure).toBe(
			"Discuss completed without its durable spec document",
		);
		expect(input).toEqual({
			...fallback,
			harnessFailure: "Discuss completed without its durable spec document",
		});
	});

	it("propagates infrastructure failures", async () => {
		const result = captureStageJudgeInput(
			stageJudgeInput("discuss"),
			async () => {
				throw new Error("git executable unavailable");
			},
		);

		await expect(result).rejects.toThrow("git executable unavailable");
	});
});

describe(validateStageJudgeEvidence, () => {
	it("rejects citations outside the frozen stage input", () => {
		const rubric = parseStageRubric(
			JSON.stringify({
				stage: "discuss",
				hardBlockers: [
					{
						id: "invalid-stage-delivery",
						description: "Valid delivery",
					},
				],
				requirements: [{ id: "scope", description: "Scope" }],
				dimensions: [
					{
						id: "clarity",
						description: "Clarity",
						good: "Good",
						excellent: "Excellent",
					},
				],
			}),
			"discuss",
		);
		const output = passingStageOutput(rubric);
		output.requirements[0] = {
			id: "scope",
			status: "PASS",
			evidence: [stageEvidence("artifact", "backlog/docs/missing-spec.md")],
		};

		expect(() =>
			validateStageJudgeEvidence(output, stageJudgeInput("discuss")),
		).toThrow("cited unavailable evidence");
	});
});

describe(runStageGates, () => {
	it("does not run a stage after a failed grade", async () => {
		const executedStages: string[] = [];

		const result = runStageGates(async (stage) => {
			executedStages.push(stage);
			return stageScorecard(stage === "grill" ? "FAIL" : "PASS");
		});

		await expect(result).rejects.toThrow("minimum grade is B");
		expect(executedStages).toEqual(["discuss", "grill"]);
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

describe(assertBuildCommitted, () => {
	it("classifies rewritten task history as candidate validation failure", async () => {
		const source = await createRepository();
		await runCommand(
			["git", "switch", "--orphan", "rewritten"],
			source.directory,
		);
		await Bun.write(join(source.directory, "rewritten.txt"), "rewritten\n");
		await commitAll(source.directory, "feat: rewrite history");
		await runCommand(["git", "branch", "-M", "main"], source.directory);

		await expect(
			assertBuildCommitted(source.directory, source.sha),
		).rejects.toBeInstanceOf(StageValidationError);
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

describe(restoreTarget, () => {
	it("restores main after generated commits and files", async () => {
		const source = await createRepository();
		const baseline = await assertSourceReady(source.directory);
		await Bun.write(
			join(source.directory, "generated.ts"),
			"export const value = 1;\n",
		);
		await commitAll(source.directory, "feat: generate change");
		await Bun.write(join(source.directory, "unfinished.ts"), "unfinished\n");

		await restoreTarget(baseline);

		expect(
			await runCommand(["git", "rev-parse", "HEAD"], source.directory),
		).toBe(`${source.sha}\n`);
		expect(
			await runCommand(["git", "status", "--porcelain"], source.directory),
		).toBe("");
		expect(
			await Bun.file(join(source.directory, "generated.ts")).exists(),
		).toBe(false);
		expect(
			await Bun.file(join(source.directory, "unfinished.ts")).exists(),
		).toBe(false);
	});

	it("preserves workflow artifacts that existed before the run", async () => {
		const source = await createRepository();
		const backlogDirectory = join(source.directory, "backlog");
		await mkdir(backlogDirectory);
		await Bun.write(join(backlogDirectory, "original.md"), "original\n");
		const baseline = await assertSourceReady(source.directory);
		const backup = await captureWorkflowBackup(source.directory);
		temporaryDirectories.push(backup.directory);
		await Bun.write(join(backlogDirectory, "original.md"), "changed\n");
		await Bun.write(join(backlogDirectory, "generated.md"), "generated\n");

		await restoreTarget(baseline, backup);

		expect(await Bun.file(join(backlogDirectory, "original.md")).text()).toBe(
			"original\n",
		);
		expect(
			await Bun.file(join(backlogDirectory, "generated.md")).exists(),
		).toBe(false);
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

describe(captureBuildCandidate, () => {
	it("freezes untracked Build files", async () => {
		const source = await createRepository();
		await Bun.write(
			join(source.directory, "uncommitted.ts"),
			"export const uncommitted = true;\n",
		);

		const candidate = await captureBuildCandidate(source.directory, source.sha);

		expect(candidate.changedPaths).toContain("uncommitted.ts");
		expect(candidate.diff).toContain("export const uncommitted = true;");
	});
});

describe(captureBaselineContext, () => {
	it("captures every tracked file except the lockfile", async () => {
		const source = await createRepository();

		const context = await captureBaselineContext(source.directory);

		expect(context.map(({ path }) => path)).toContain("base.txt");
		expect(context.map(({ path }) => path)).not.toContain("bun.lock");
	});
});

function completeGrade(verdict: "PASS" | "FAIL"): JudgeGrade {
	return {
		requirements: RUBRIC_IDS.map((id) => requirement(id, verdict)),
		verdict,
		summary: "complete",
	};
}

function stageJudgeOutput(
	blocker: "PASS" | "FAIL",
	requirementStatus: "PASS" | "FAIL",
	dimensionGrade: "A" | "B" | "C" | "D" | "F",
): StageJudgeOutput {
	return {
		hardBlockers: [
			{
				id: "invalid-stage-delivery",
				status: "PASS",
				evidence: [stageEvidence("task", "backlog-seed.md")],
			},
			{
				id: "contradiction",
				status: blocker,
				evidence: [stageEvidence("artifact", "backlog/docs/spec.md")],
			},
		],
		requirements: [
			{
				id: "scope",
				status: requirementStatus,
				evidence: [stageEvidence("artifact", "backlog/docs/spec.md")],
			},
		],
		dimensions: [
			{
				id: "clarity",
				grade: dimensionGrade,
				evidence: [stageEvidence("artifact", "backlog/docs/spec.md")],
			},
		],
		summary: "stage grade",
	};
}

function stageScorecard(
	requirementStatus: "PASS" | "FAIL",
	requirementId = "scope",
): StageScorecard {
	const rubric = parseStageRubric(
		JSON.stringify({
			stage: "discuss",
			hardBlockers: [
				{
					id: "invalid-stage-delivery",
					description: "Valid delivery",
				},
				{ id: "contradiction", description: "No conflict" },
			],
			requirements: [{ id: requirementId, description: "Scope is explicit" }],
			dimensions: [
				{
					id: "clarity",
					description: "Clear output",
					good: "Concrete",
					excellent: "Precise",
				},
			],
		}),
		"discuss",
	);

	return {
		stage: "discuss",
		rubricPath: "rubrics/discuss.json",
		rubric,
		input: {
			stage: "discuss",
			task: "Task",
			productBrief: "Brief",
			instructions: "Instructions",
			baselineContext: [],
			taskState: "State",
			transcript: {
				stage: "discuss",
				sessionId: "session",
				costUsd: 1,
				exchanges: [],
			},
			priorArtifacts: [],
		},
		prompt: "prompt",
		costUsd: 1,
		grade: deriveStageGrade(
			{
				...stageJudgeOutput("PASS", requirementStatus, "B"),
				requirements: [
					{
						id: requirementId,
						status: requirementStatus,
						evidence: [stageEvidence("artifact", "backlog/docs/spec.md")],
					},
				],
			},
			rubric,
		),
	};
}

function stageEvidence(
	source: StageJudgeOutput["requirements"][number]["evidence"][number]["source"],
	path: string,
) {
	return { source, path, claim: "evidence" };
}

function passingStageOutput(
	rubric: ReturnType<typeof parseStageRubric>,
): StageJudgeOutput {
	return {
		hardBlockers: rubric.hardBlockers.map(({ id }) => ({
			id,
			status: "PASS" as const,
			evidence: [stageEvidence("task", "backlog-seed.md")],
		})),
		requirements: rubric.requirements.map(({ id }) => ({
			id,
			status: "PASS" as const,
			evidence: [stageEvidence("task", "backlog-seed.md")],
		})),
		dimensions: rubric.dimensions.map(({ id }) => ({
			id,
			grade: "A" as const,
			evidence: [stageEvidence("task", "backlog-seed.md")],
		})),
		summary: "pass",
	};
}

function stageJudgeInput(
	stage: "discuss" | "grill" | "plan" | "build",
	overrides: Partial<StageScorecard["input"]> = {},
): StageScorecard["input"] {
	return {
		stage,
		task: "Task",
		productBrief: "Brief",
		instructions: "Instructions",
		baselineContext: [],
		taskState: "State",
		transcript: {
			stage,
			sessionId: "session",
			costUsd: 1,
			exchanges: [],
		},
		priorArtifacts: [],
		...overrides,
	};
}

function requirement(
	id: string,
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

function humanReview(
	verdict: HumanReview["verdict"],
	judgeAssessment: HumanReview["findings"][number]["judgeAssessment"],
	rubricId: string,
): HumanReview {
	return {
		verdict,
		summary: "Human review",
		findings: [
			{
				description: "Finding",
				paths: ["src/audit/example.ts"],
				stage: "final",
				judgeAssessment,
				rubricId,
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
