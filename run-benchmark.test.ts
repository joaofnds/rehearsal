import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assertStageArtifactState,
	parseTaskState,
} from "./src/benchmark/backlog";
import {
	collectCalibration,
	parseHumanReview,
	validateCalibration,
} from "./src/benchmark/calibration";
import {
	captureBaselineContext,
	captureCheckIntegrity,
	captureFileHashes,
} from "./src/benchmark/checks";
import {
	claudeArgs,
	readClaudeEnvelope,
	readStructuredOutput,
} from "./src/benchmark/claude";
import {
	CommandError,
	killActiveCommands,
	runCommand,
} from "./src/benchmark/command";
import { parseArgs, WORKFLOW_STAGES } from "./src/benchmark/config";
import type {
	HumanReview,
	JudgeGrade,
	StageJudgeOutput,
	StageScorecard,
} from "./src/benchmark/contracts";
import {
	claudeJsonSchema,
	judgeGradeSchema,
	productAnswerSchema,
	StageValidationError,
	stageTurnSchema,
} from "./src/benchmark/contracts";
import {
	applyHarnessResults,
	parseRubricIds,
	validateJudgeEvidence,
	validateJudgeGrade,
} from "./src/benchmark/judge";
import {
	applyAuthoritativeStageResults,
	assertStageGradePassed,
	captureStageJudgeInput,
	deriveStageGrade,
	parseStageRubric,
	validateStageJudgeEvidence,
} from "./src/benchmark/stage-grading";
import {
	assertBuildCommitted,
	assertConventionalCommitSubjects,
	assertSourceReady,
	captureBuildCandidate,
	captureWorkflowBackup,
	claimTarget,
	restoreTarget,
	teardownTarget,
} from "./src/benchmark/target";

const RUBRIC_IDS = ["tests", "worker", "check-integrity", "local-checks"];

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
		const config = parseArgs(
			[
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
			],
			{},
		);

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
		const config = parseArgs(
			[
				"--target",
				"./target",
				"--model",
				"sonnet",
				"--effort",
				"xhigh",
				"--session-budget-usd",
				"5",
			],
			{},
		);

		expect(config.judgeModel).toBe("sonnet");
		expect(config.judgeEffort).toBe("xhigh");
	});

	it("resolves configuration from environment variables", () => {
		const config = parseArgs([], {
			BENCHMARK_TARGET_DIR: "./target",
			BENCHMARK_MODEL: "sonnet",
			BENCHMARK_SESSION_BUDGET_USD: "5",
		});

		expect(config.sourceDir).toBe(join(process.cwd(), "target"));
		expect(config.model).toBe("sonnet");
		expect(config.sessionBudgetUsd).toBe(5);
	});

	it("rejects unsupported effort levels", () => {
		expect(() =>
			parseArgs(
				[
					"--target",
					"./target",
					"--model",
					"sonnet",
					"--effort",
					"extreme",
					"--session-budget-usd",
					"5",
				],
				{},
			),
		).toThrow("Unsupported effort");
	});

	it("rejects missing spend limits", () => {
		expect(() =>
			parseArgs(["--target", "./target", "--model", "claude-opus-4-8"], {}),
		).toThrow("Provide --session-budget-usd");
	});
});

describe(validateJudgeGrade, () => {
	it("accepts a complete consistent grade", () => {
		const grade = completeGrade("PASS");

		expect(validateJudgeGrade(grade, RUBRIC_IDS)).toEqual(grade);
	});

	it("rejects a verdict that contradicts requirement results", () => {
		const grade = completeGrade("PASS");
		grade.requirements[0] = requirement(RUBRIC_IDS[0], "FAIL");

		expect(() => validateJudgeGrade(grade, RUBRIC_IDS)).toThrow(
			"contradicts requirement results",
		);
	});

	it("rejects an incomplete grade", () => {
		const grade = completeGrade("PASS");
		grade.requirements.pop();

		expect(() => validateJudgeGrade(grade, RUBRIC_IDS)).toThrow(
			"every rubric requirement exactly once",
		);
	});

	it("accepts requirements added to the rubric without a code change", () => {
		const grade = completeGrade("PASS");
		grade.requirements.push(requirement("human-review", "PASS"));

		const validated = validateJudgeGrade(grade, [
			...RUBRIC_IDS,
			"human-review",
		]);

		expect(validated).toEqual(grade);
	});
});

describe(readClaudeEnvelope, () => {
	it("returns the parsed session envelope", () => {
		const envelope = readClaudeEnvelope(
			JSON.stringify({ session_id: "session-1", total_cost_usd: 0.5 }),
		);

		expect(envelope.session_id).toBe("session-1");
		expect(envelope.total_cost_usd).toBe(0.5);
	});

	it("throws the session's own error message on an error envelope", () => {
		expect(() =>
			readClaudeEnvelope(
				JSON.stringify({
					session_id: "session-1",
					is_error: true,
					result: "session exhausted its budget",
				}),
			),
		).toThrow("session exhausted its budget");
	});
});

describe(readStructuredOutput, () => {
	it("reads the structured output field", () => {
		const envelope = readClaudeEnvelope(
			JSON.stringify({
				session_id: "session-1",
				structured_output: { answer: "ship it" },
			}),
		);

		const output = readStructuredOutput(envelope, productAnswerSchema);

		expect(output.answer).toBe("ship it");
	});

	it("parses the result text when structured output is absent", () => {
		const envelope = readClaudeEnvelope(
			JSON.stringify({
				session_id: "session-1",
				result: JSON.stringify({ answer: "ship it" }),
			}),
		);

		const output = readStructuredOutput(envelope, productAnswerSchema);

		expect(output.answer).toBe("ship it");
	});

	it("rejects an envelope with no output", () => {
		const envelope = readClaudeEnvelope(
			JSON.stringify({ session_id: "session-1" }),
		);

		expect(() => readStructuredOutput(envelope, productAnswerSchema)).toThrow(
			"did not contain structured output",
		);
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

describe(collectCalibration, () => {
	it("records a rubric.md edit during stage-failure calibration without a final rejudge", async () => {
		const reviewDirectory = await mkdtemp(join(tmpdir(), "template-review-"));
		temporaryDirectories.push(reviewDirectory);
		const reviewFile = join(reviewDirectory, "review.json");
		const rubricPath = join(reviewDirectory, "discuss.json");
		const rubricContent = JSON.stringify({
			stage: "discuss",
			hardBlockers: [
				{ id: "invalid-stage-delivery", description: "Valid delivery" },
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
		});
		await Bun.write(rubricPath, rubricContent);
		const rubric = parseStageRubric(rubricContent, "discuss");
		const scorecard: StageScorecard = {
			stage: "discuss",
			rubricPath,
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
			grade: {
				...stageJudgeOutput("PASS", "FAIL", "F"),
				grade: "F",
				verdict: "STOP",
			},
		};
		const questions: string[] = [];
		const rl = {
			async question(prompt: string) {
				if (questions.length > 0) {
					throw new CommandError(["calibration"], 1, "", "re-prompted");
				}
				questions.push(prompt);
				await Bun.write(
					reviewFile,
					`${JSON.stringify({
						verdict: "REJECT",
						summary: "The discuss stage missed scope.",
						findings: [],
					})}\n`,
				);
				return "";
			},
		};

		const result = await collectCalibration({
			rl,
			reviewFile,
			targetDir: reviewDirectory,
			originalInstructions: await Bun.file(
				join(import.meta.dir, "CLAUDE.md"),
			).text(),
			originalRubric: "1. `old`: Old requirement.\n",
			stageScorecards: [scorecard],
			judgeModel: "sonnet",
			sessionBudgetUsd: 5,
		});

		expect(questions).toHaveLength(1);
		expect(questions[0]).not.toContain("rubric.md");
		expect(result.rubricChanged).toBe(true);
		expect(result.updatedRubric).toBeDefined();
		expect(result.revisedGrade).toBeUndefined();
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

describe(claudeArgs, () => {
	it("grants a workflow session native customizations without permission prompts", () => {
		const command = claudeArgs({
			settings: { model: "sonnet", effort: "high", budgetUsd: 5 },
			schema: stageTurnSchema,
			access: "unrestricted",
			session: { id: "session-1", resume: false },
		});

		expect(command).toEqual([
			"claude",
			"-p",
			"--model",
			"sonnet",
			"--effort",
			"high",
			"--max-budget-usd",
			"5",
			"--output-format",
			"json",
			"--json-schema",
			claudeJsonSchema(stageTurnSchema),
			"--dangerously-skip-permissions",
			"--session-id",
			"session-1",
		]);
	});

	it("seals a judge session away from tools, skills, and persistence", () => {
		const command = claudeArgs({
			settings: { model: "sonnet", budgetUsd: 5 },
			schema: judgeGradeSchema,
			access: "sealed",
			systemPrompt: "You are a judge.",
		});

		expect(command).toEqual([
			"claude",
			"-p",
			"--safe-mode",
			"--disable-slash-commands",
			"--strict-mcp-config",
			"--model",
			"sonnet",
			"--max-budget-usd",
			"5",
			"--output-format",
			"json",
			"--json-schema",
			claudeJsonSchema(judgeGradeSchema),
			"--tools",
			"",
			"--system-prompt",
			"You are a judge.",
			"--no-session-persistence",
		]);
	});

	it("resumes an existing session", () => {
		const command = claudeArgs({
			settings: { model: "sonnet", budgetUsd: 5 },
			schema: stageTurnSchema,
			access: "unrestricted",
			session: { id: "session-1", resume: true },
		});

		expect(command).toContain("--resume");
		expect(command).not.toContain("--session-id");
	});
});

describe(claudeJsonSchema, () => {
	it("omits the $schema key Claude rejects", () => {
		expect(claudeJsonSchema(stageTurnSchema)).not.toContain('"$schema"');
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

	it("accepts citations carrying a location fragment", () => {
		const grade = completeGrade("PASS");
		grade.requirements[0] = {
			...grade.requirements[0],
			evidence: [
				{
					source: "diff",
					path: "src/audit/example.ts#L10",
					claim: "the worker persists metadata",
				},
			],
		};

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
	it("accepts a fragment within a frozen JSON source", () => {
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
			evidence: [
				stageEvidence("transcript", "discuss.transcript.json#exchanges"),
			],
		};

		expect(() =>
			validateStageJudgeEvidence(output, stageJudgeInput("discuss")),
		).not.toThrow();
	});

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

describe(killActiveCommands, () => {
	it("kills a running command's whole process group", async () => {
		const running = runCommand(
			["sh", "-c", "sleep 987654 & wait"],
			process.cwd(),
		).catch(() => "killed");
		await Bun.sleep(200);

		await killActiveCommands();

		await running;
		const survivors = await runCommand(
			["pgrep", "-f", "sleep 987654"],
			process.cwd(),
		).catch(() => "");
		expect(survivors).toBe("");
	});
});

describe(assertStageGradePassed, () => {
	it("stops the workflow on a failed stage grade", () => {
		expect(() => assertStageGradePassed(stageScorecard("FAIL"))).toThrow(
			"minimum grade is B",
		);
	});

	it("continues past a passing stage grade", () => {
		expect(() => assertStageGradePassed(stageScorecard("PASS"))).not.toThrow();
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

	it("returns the target to main from a stage branch", async () => {
		const source = await createRepository();
		const baseline = await assertSourceReady(source.directory);
		await runCommand(["git", "switch", "-c", "agent-work"], source.directory);
		await Bun.write(join(source.directory, "stray.ts"), "export {};\n");
		await commitAll(source.directory, "feat: stray branch work");

		await restoreTarget(baseline);

		expect(
			(
				await runCommand(["git", "branch", "--show-current"], source.directory)
			).trim(),
		).toBe("main");
		expect(
			(await runCommand(["git", "rev-parse", "HEAD"], source.directory)).trim(),
		).toBe(source.sha);
	});

	it("preserves every workflow path that existed before the run", async () => {
		const source = await createRepository();
		const backlogDirectory = join(source.directory, "backlog");
		const borisDirectory = join(source.directory, ".boris");
		await mkdir(backlogDirectory);
		await mkdir(borisDirectory);
		await Bun.write(join(backlogDirectory, "original.md"), "original\n");
		await Bun.write(join(borisDirectory, "CONTEXT.md"), "context\n");
		const baseline = await assertSourceReady(source.directory);
		const backup = await captureWorkflowBackup(source.directory);
		temporaryDirectories.push(backup.directory);
		await Bun.write(join(backlogDirectory, "original.md"), "changed\n");
		await Bun.write(join(backlogDirectory, "generated.md"), "generated\n");
		await Bun.write(join(borisDirectory, "CONTEXT.md"), "rewritten\n");

		await restoreTarget(baseline, backup);

		expect(await Bun.file(join(backlogDirectory, "original.md")).text()).toBe(
			"original\n",
		);
		expect(
			await Bun.file(join(backlogDirectory, "generated.md")).exists(),
		).toBe(false);
		expect(await Bun.file(join(borisDirectory, "CONTEXT.md")).text()).toBe(
			"context\n",
		);
	});
});

describe(claimTarget, () => {
	it("refuses a target an unrestored run left claimed", async () => {
		const source = await createRepository();
		const baseline = await assertSourceReady(source.directory);
		await claimTarget(baseline);

		await expect(claimTarget(baseline)).rejects.toThrow(
			"previous benchmark run left this target unrestored",
		);
	});

	it("releases the claim after a verified restore", async () => {
		const source = await createRepository();
		const baseline = await assertSourceReady(source.directory);
		await claimTarget(baseline);

		await restoreTarget(baseline);

		await expect(claimTarget(baseline)).resolves.toBeUndefined();
	});

	it("claims a linked-worktree target whose .git is a file", async () => {
		const source = await createRepository();
		await runCommand(["git", "switch", "-c", "primary"], source.directory);
		const worktreeParent = await mkdtemp(join(tmpdir(), "template-worktree-"));
		temporaryDirectories.push(worktreeParent);
		const worktree = join(worktreeParent, "main");
		await runCommand(
			["git", "worktree", "add", worktree, "main"],
			source.directory,
		);
		const baseline = await assertSourceReady(worktree);

		await claimTarget(baseline);

		await expect(claimTarget(baseline)).rejects.toThrow(
			"previous benchmark run left this target unrestored",
		);
		await restoreTarget(baseline);
		await expect(claimTarget(baseline)).resolves.toBeUndefined();
	});
});

describe(teardownTarget, () => {
	it("discards the workflow backup after a verified restore", async () => {
		const source = await createRepository();
		const baseline = await assertSourceReady(source.directory);
		const backup = await captureWorkflowBackup(source.directory);
		temporaryDirectories.push(backup.directory);
		await Bun.write(join(source.directory, "candidate.ts"), "export {};\n");
		await commitAll(source.directory, "feat: candidate");

		await teardownTarget(baseline, backup);

		expect(
			(await runCommand(["git", "rev-parse", "HEAD"], source.directory)).trim(),
		).toBe(source.sha);
		await expect(stat(backup.directory)).rejects.toThrow();
	});

	it("keeps the workflow backup when the restore fails", async () => {
		const source = await createRepository();
		const backup = await captureWorkflowBackup(source.directory);
		temporaryDirectories.push(backup.directory);
		const broken = {
			root: source.directory,
			sha: "0000000000000000000000000000000000000000",
		};

		await expect(teardownTarget(broken, backup)).rejects.toThrow();
		await expect(stat(backup.directory)).resolves.toBeDefined();
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

		const tracked = await runCommand(["git", "ls-files"], source.directory);
		const context = await captureBaselineContext(source.directory);

		expect(tracked).toContain("bun.lock");
		expect(context.map(({ path }) => path).sort()).toEqual([
			"base.txt",
			"package.json",
		]);
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
	await Bun.write(join(directory, "bun.lock"), "{}\n");
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
