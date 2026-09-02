import { describe, expect, it } from "bun:test";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { recordCheckpoint } from "./checkpoint";
import { runCommand } from "./command";
import { parseArgs } from "./config";
import type {
	CalibrationResult,
	JudgeGrade,
	StageJudgeInput,
	StageJudgeOutput,
	StageRubric,
	StageScorecard,
} from "./contracts";
import { StageValidationError } from "./contracts";
import type { JudgeAttempt } from "./judge-attempt";
import { JudgeOutputValidationError } from "./judge-attempt";
import type { PipelineDefinition, PlanningStageDefinition } from "./pipeline";
import { loadPipeline } from "./pipeline";
import type {
	RunArtifactBaseInputs,
	RunArtifactInputs,
	StageContext,
	StageDependencies,
} from "./run";
import {
	buildFailedJudgeRunArtifact,
	buildRunArtifact,
	retainedCheckpointRecorder,
	runBenchmark,
	runFinalJudge,
	runGradedStages,
} from "./run";
import {
	PROJECT_ROOT,
	TEST_TARGET,
	TestResources,
	harnessResult,
} from "./test-support";
import type { PendingStage, RunArtifactPersistence } from "./run-abort";
import { createRunAbort, fileRunArtifactPersistence } from "./run-abort";
import {
	assertStageGradePassed,
	deriveStageGrade,
	parseStageRubric,
} from "./stage-grading";

const testResources = TestResources.forEachTest();

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
	);

	return {
		stage: "discuss",
		rubricPath: "rubrics/discuss.json",
		rubric,
		input: {
			stage: "discuss",
			kind: "planning",
			task: "Task",
			productBrief: "Brief",
			instructions: "Instructions",
			baselineContext: [],
			taskState: "State",
			transcript: {
				stage: "discuss",
				sessionId: "session",
				costUsd: 1,
				providerCalls: [],
				exchanges: [],
			},
			priorArtifacts: [],
		},
		prompt: "prompt",
		attempts: [],
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

function loadDefaultPipeline(): Promise<PipelineDefinition> {
	return loadPipeline("pipelines/default.json");
}

class ControlledRunArtifactPersistence implements RunArtifactPersistence {
	public readonly files = new Map<string, string>();
	public readonly writes: string[] = [];
	public activeWrites = 0;
	public maxActiveWrites = 0;
	private nextFailure: Error | undefined;
	private nextWrite:
		| {
				readonly started: PromiseWithResolvers<undefined>;
				readonly released: PromiseWithResolvers<undefined>;
		  }
		| undefined;

	public blockNextWrite(): BlockedRunArtifactWrite {
		const started = Promise.withResolvers<undefined>();
		const released = Promise.withResolvers<undefined>();
		this.nextWrite = { started, released };

		return {
			started: started.promise,
			release: () => {
				released.resolve(undefined);
			},
		};
	}

	public failNextWrite(): Error {
		const failure = new Error("persistence failed");
		this.nextFailure = failure;

		return failure;
	}

	public async write(path: string, contents: string): Promise<void> {
		this.writes.push(contents);
		const blocked = this.nextWrite;
		this.nextWrite = undefined;
		const failure = this.nextFailure;
		this.nextFailure = undefined;
		this.activeWrites += 1;
		this.maxActiveWrites = Math.max(this.maxActiveWrites, this.activeWrites);

		try {
			if (blocked !== undefined) {
				blocked.started.resolve(undefined);
				await blocked.released.promise;
			}
			if (failure !== undefined) {
				throw failure;
			}

			this.files.set(path, contents);
		} finally {
			this.activeWrites -= 1;
		}
	}

	public reset(): void {
		this.files.clear();
		this.writes.length = 0;
		this.activeWrites = 0;
		this.maxActiveWrites = 0;
		this.nextFailure = undefined;
		this.nextWrite = undefined;
	}
}

function artifactBaseInputs(
	pipeline: PipelineDefinition,
	pipelinePath: string,
): RunArtifactBaseInputs {
	return {
		timestamp: "2026-08-30T00:00:00.000Z",
		controlSha: "control-sha",
		source: { root: "/tmp/target", origin: undefined, sha: "source-sha" },
		taskSha: "task-sha",
		config: {
			sourceDir: "/tmp/target",
			model: "sonnet",
			judgeModel: "sonnet",
			sessionBudgetUsd: 5,
			pipelinePath,
		},
		pipeline,
		claudeVersion: "claude 1.0.0",
		task: "Task",
		productBrief: "Brief",
		instructions: "Instructions",
		rubric: "Rubric",
		rubricIds: ["scope"],
		baselineContext: [],
		taskId: "TASK-1",
		productOwner: { sessionId: "po", spentUsd: 0, providerCalls: [] },
		workflow: [],
		stageScorecards: [],
		checkpoints: [],
		evidence: {
			resultSha: "result-sha",
			diff: "the-diff",
			changedPaths: ["src/example.ts"],
			taskState: "state",
			checkIntegrity: harnessResult("PASS", "checks match"),
			localChecks: harnessResult("PASS", "all green"),
		},
	};
}

const RUBRIC_IDS = [
	"tests",
	"worker",
	"check-integrity",
	"local-checks",
] as const;

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

function withFirstRequirement(
	grade: JudgeGrade,
	first: JudgeGrade["requirements"][number],
): JudgeGrade {
	return { ...grade, requirements: [first, ...grade.requirements.slice(1)] };
}

function completeGrade(verdict: "PASS" | "FAIL"): JudgeGrade {
	return {
		requirements: RUBRIC_IDS.map((id) => requirement(id, verdict)),
		verdict,
		summary: "complete",
	};
}

function artifactInputs(
	pipeline: PipelineDefinition,
	pipelinePath: string,
): RunArtifactInputs {
	return {
		...artifactBaseInputs(pipeline, pipelinePath),
		judge: {
			prompt: "judge prompt",
			attempts: [],
			costUsd: 0,
			grade: {
				requirements: [],
				verdict: "PASS" as const,
				summary: "ok",
			},
		},
		reviewFile: "/tmp/review.json",
	};
}

function stageEvidence(
	source: StageJudgeOutput["requirements"][number]["evidence"][number]["source"],
	path: string,
): StageJudgeOutput["requirements"][number]["evidence"][number] {
	return { source, path, claim: "evidence" };
}

interface BlockedRunArtifactWrite {
	readonly started: Promise<undefined>;
	readonly release: () => void;
}

describe(assertStageGradePassed.name, () => {
	it("stops the workflow on a failed stage grade", () => {
		expect(() => {
			assertStageGradePassed(stageScorecard("FAIL"));
		}).toThrow("minimum grade is B");
	});

	it("continues past a passing stage grade", () => {
		expect(() => {
			assertStageGradePassed(stageScorecard("PASS"));
		}).not.toThrow();
	});
});

describe(runGradedStages.name, () => {
	interface StageHarness {
		readonly scorecardFor: (
			input: StageJudgeInput,
			verdict: "CONTINUE" | "STOP",
		) => StageScorecard;
		readonly dependencies: StageDependencies;
		readonly judged: StageJudgeInput[];
		readonly executed: string[];
		readonly rubricsUsed: string[];
	}

	function fakeStageDependencies(): StageHarness {
		const judged: StageJudgeInput[] = [];
		const executed: string[] = [];
		const rubricsUsed: string[] = [];
		const scorecardFor = (
			input: StageJudgeInput,
			verdict: "CONTINUE" | "STOP",
		): StageScorecard => ({
			stage: input.stage,
			rubricPath: `${input.stage}.json`,
			rubric: parseStageRubric(
				JSON.stringify({
					stage: input.stage,
					hardBlockers: [
						{ id: "invalid-stage-delivery", description: "Valid delivery" },
						{ id: "false-test-safety", description: "Checks intact" },
						{ id: "unfinished-delivery", description: "Checks pass" },
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
				input.kind,
			),
			input,
			prompt: "prompt",
			attempts: [],
			costUsd: 0,
			grade: {
				...stageJudgeOutput("PASS", "PASS", verdict === "CONTINUE" ? "B" : "F"),
				grade: verdict === "CONTINUE" ? "B" : "F",
				verdict,
			},
		});

		return {
			scorecardFor,
			judged,
			executed,
			rubricsUsed,
			dependencies: {
				runWorkflowStage: ({ stage, skill }) => {
					executed.push(skill);

					return Promise.resolve({
						stage,
						sessionId: "session",
						costUsd: 0,
						providerCalls: [],
						exchanges: [],
					});
				},
				runStageJudge: (
					_model: string,
					_effort: undefined | "low" | "medium" | "high" | "xhigh" | "max",
					_budget: number,
					input: StageJudgeInput,
					source: { readonly rubricPath: string },
				) => {
					judged.push(input);
					rubricsUsed.push(source.rubricPath);

					return Promise.resolve(scorecardFor(input, "CONTINUE"));
				},
				readTaskOutput: () =>
					Promise.resolve(
						JSON.stringify({
							task: { acceptanceCriteria: ["done"], documentation: [] },
						}),
					),
				readTaskCard: () => Promise.resolve("the task card"),
				captureBuildCandidate: () =>
					Promise.resolve({
						resultSha: "candidate-sha",
						diff: "candidate-diff",
						changedPaths: ["src/example.ts"],
					}),
				assertPlanningStageCompleted: (
					_targetDir: string,
					baselineSha: string,
					stage: { readonly name: string },
				) =>
					Promise.resolve({
						taskState: `${stage.name}-state`,
						artifact: {
							path: `backlog/docs/${stage.name}.md`,
							content: `${stage.name} artifact`,
						},
						resultSha: baselineSha,
						diff: "",
						changedPaths: [],
					}),
				assertBuildCommitted: () =>
					Promise.resolve({
						resultSha: "result-sha",
						diff: "the-diff",
						commitSubjects: ["build commit"],
					}),
				changedPathsBetween: () => Promise.resolve(["src/example.ts"]),
				captureCheckIntegrity: () =>
					Promise.resolve(harnessResult("PASS", "checks match")),
				captureTreatmentChecks: () =>
					Promise.resolve(harnessResult("PASS", "all green")),
				resolveSkillDirectory: (skill: string) =>
					Promise.resolve(`/skills/${skill}`),
				captureStageCorpus: (skill: string) =>
					Promise.resolve([
						{
							path: `skills/${skill}/SKILL.md`,
							sha256: createHash("sha256").update(skill).digest("hex"),
						},
					]),
				recordCheckpoint,
			},
		};
	}

	async function stageContext(): Promise<StageContext> {
		const stageDirectory = await mkdtemp(join(tmpdir(), "rehearsal-stages-"));
		testResources.track(stageDirectory);
		const transitions = createRunAbort(
			{
				killActiveCommands: () => Promise.resolve(),
				registerSignal: () => undefined,
				releaseSignal: () => undefined,
				exit: () => undefined,
				reportError: () => undefined,
				persistence: fileRunArtifactPersistence,
			},
			{
				artifactFile: join(stageDirectory, "run.json"),
				teardown: () => Promise.resolve(),
			},
		);

		return {
			targetDir: stageDirectory,
			initialLineage: "initial-lineage",
			model: "sonnet",
			judgeModel: "sonnet",
			sessionBudgetUsd: 5,
			productOwner: {
				ask: () => Promise.reject(new Error("no product owner in this test")),
				snapshot: () => ({
					sessionId: "po",
					spentUsd: 0,
					providerCalls: [],
				}),
			},
			task: "Task",
			productBrief: "Brief",
			instructions: "Instructions",
			baselineContext: [],
			baselineHashes: new Map<string, string>(),
			taskId: "TASK-1",
			taskSha: "task-sha",
			pipeline: await loadDefaultPipeline(),
			stageFile: (stage: string) => join(stageDirectory, `${stage}.json`),
			checkpointDirectory: (stage: string) =>
				join(stageDirectory, "checkpoints", stage),
			log: () => undefined,
			writePendingStage: transitions.writePendingStage,
			updatePendingStage: transitions.updatePendingStage,
			writeStageProgress: transitions.writeStageProgress,
			completeStage: transitions.completeStage,
			calibrateStageFailure: (): Promise<CalibrationResult> =>
				Promise.reject(new Error("calibration not expected")),
		};
	}

	it("runs the stages in order and carries evidence forward", async () => {
		const { dependencies, judged, executed } = fakeStageDependencies();
		const context = await stageContext();

		const outcome = await runGradedStages(dependencies, context);

		expect(executed).toEqual(["shape", "build"]);
		expect(judged[1]?.priorArtifacts.map(({ path }) => path)).toEqual([
			"backlog/docs/shape.md",
		]);
		expect(judged[1]?.diff).toBe("the-diff");
		expect(judged[0]).not.toHaveProperty("commitSubjects");
		expect(judged[1]?.commitSubjects).toEqual(["build commit"]);
		expect(outcome.buildEvidence?.resultSha).toBe("result-sha");
		expect(outcome.workflow).toHaveLength(2);
	});

	it("records the stage session inputs beside a continued scorecard", async () => {
		const { dependencies } = fakeStageDependencies();
		const context = {
			...(await stageContext()),
			model: "opus",
			effort: "high" as const,
		};

		await runGradedStages(dependencies, context);

		const stageRecord = z
			.object({
				corpusFiles: z.array(
					z.object({ path: z.string(), sha256: z.string() }),
				),
				model: z.string(),
				effort: z.string(),
			})
			.parse(JSON.parse(await Bun.file(context.stageFile("shape")).text()));
		expect(stageRecord).toEqual({
			corpusFiles: [
				{
					path: "skills/shape/SKILL.md",
					sha256: createHash("sha256").update("shape").digest("hex"),
				},
			],
			model: "opus",
			effort: "high",
		});
	});

	it("persists stage records through the run transition boundary", async () => {
		const { dependencies } = fakeStageDependencies();
		const persistence = new ControlledRunArtifactPersistence();
		const abort = createRunAbort(
			{
				killActiveCommands: () => Promise.resolve(),
				registerSignal: () => undefined,
				releaseSignal: () => undefined,
				exit: () => undefined,
				reportError: () => undefined,
				persistence,
			},
			{
				artifactFile: "/runs/run.json",
				teardown: () => Promise.resolve(),
			},
		);
		const context = {
			...(await stageContext()),
			writePendingStage: abort.writePendingStage,
			completeStage: abort.completeStage,
		};

		await runGradedStages(dependencies, context);

		expect(
			JSON.parse(persistence.files.get(context.stageFile("shape")) ?? ""),
		).toMatchObject({
			model: "sonnet",
			grade: { verdict: "CONTINUE" },
		});
	});

	it("retains commit subjects in awaiting and completed stage records", async () => {
		const { dependencies, scorecardFor } = fakeStageDependencies();
		const context = await stageContext();
		let awaitingSubjects: readonly string[] | undefined;
		const recording = {
			...dependencies,
			runStageJudge: async (
				_model: string,
				_effort: undefined | "low" | "medium" | "high" | "xhigh" | "max",
				_budget: number,
				input: StageJudgeInput,
			) => {
				if (input.stage === "build") {
					const pendingRecord: unknown = JSON.parse(
						await Bun.file(context.stageFile(input.stage)).text(),
					);
					const pending = z
						.object({
							input: z.object({ commitSubjects: z.array(z.string()) }),
						})
						.parse(pendingRecord);
					awaitingSubjects = pending.input.commitSubjects;
				}

				return scorecardFor(input, "CONTINUE");
			},
		};

		await runGradedStages(recording, context);

		const completedRecord: unknown = JSON.parse(
			await Bun.file(context.stageFile("build")).text(),
		);
		const completed = z
			.object({ input: z.object({ commitSubjects: z.array(z.string()) }) })
			.parse(completedRecord);
		expect(awaitingSubjects).toEqual(["build commit"]);
		expect(completed.input.commitSubjects).toEqual(["build commit"]);
	});

	it("records Judge attempts beside a continued scorecard", async () => {
		const { dependencies, scorecardFor } = fakeStageDependencies();
		const attempts: readonly JudgeAttempt[] = [
			{
				payload: { summary: "accepted" },
				costUsd: 0.4,
				outcome: "ACCEPTED",
			},
		];
		const context = await stageContext();
		const recording = {
			...dependencies,
			runStageJudge: (
				_model: string,
				_effort: undefined | "low" | "medium" | "high" | "xhigh" | "max",
				_budget: number,
				input: StageJudgeInput,
			) =>
				Promise.resolve({
					...scorecardFor(input, "CONTINUE"),
					attempts,
					costUsd: 0.4,
				}),
		};

		await runGradedStages(recording, context);

		const record: unknown = JSON.parse(
			await Bun.file(context.stageFile("shape")).text(),
		);
		expect(record).toMatchObject({ attempts, costUsd: 0.4 });
	});

	it("retains exhausted validation evidence on the pending stage", async () => {
		const { dependencies } = fakeStageDependencies();
		const attempts: readonly JudgeAttempt[] = [
			{
				payload: { summary: "invalid" },
				costUsd: 0.1,
				outcome: "REJECTED",
				error: "invalid evidence",
			},
		];
		const failure = new JudgeOutputValidationError({
			message: "invalid evidence",
			prompt: "original prompt",
			attempts,
			costUsd: 0.1,
		});
		const pendingStages: (PendingStage | undefined)[] = [];
		const context = {
			...(await stageContext()),
			updatePendingStage: (pending: PendingStage) => {
				pendingStages.push(pending);
			},
		};
		const failing = {
			...dependencies,
			runStageJudge: () => Promise.reject(failure),
		};

		expect(runGradedStages(failing, context)).rejects.toBe(failure);

		expect(pendingStages.at(-1)?.failure).toEqual({
			prompt: "original prompt",
			attempts,
			costUsd: 0.1,
		});
	});

	function planningStage(
		name: string,
		artifact: string,
		rubric: string,
	): PlanningStageDefinition {
		return {
			name,
			kind: "planning" as const,
			skill: name,
			artifact,
			rubric,
			requiresAcceptanceCriteria: false,
		};
	}

	const deliveryStage = {
		name: "build",
		kind: "delivery" as const,
		skill: "build",
		rubric: "rubrics/build.json",
	};

	it("runs the pipeline target checks after delivery validation", async () => {
		const { dependencies } = fakeStageDependencies();
		const events: string[] = [];
		const observedCommands: string[][] = [];
		const target = {
			checks: [{ command: ["bun", "run", "custom-check"] }],
			integrityFiles: ["custom-check.json"],
		};
		const context = {
			...(await stageContext()),
			pipeline: {
				statuses: ["To Do", "Done"],
				target,
				stages: [deliveryStage],
			},
		};
		const observing = {
			...dependencies,
			assertBuildCommitted: () => {
				events.push("delivery validated");

				return Promise.resolve({
					resultSha: "result-sha",
					diff: "the-diff",
					commitSubjects: ["build commit"],
				});
			},
			captureTreatmentChecks: (
				_targetDir: string,
				checks: readonly { readonly command: readonly string[] }[] = [],
			) => {
				events.push("checks run");
				observedCommands.push(...checks.map(({ command }) => [...command]));

				return Promise.resolve(harnessResult("PASS", "all green"));
			},
		};

		await runGradedStages(observing, context);

		expect(events).toEqual(["delivery validated", "checks run"]);
		expect(observedCommands).toEqual([["bun", "run", "custom-check"]]);
	});

	it("carries every earlier artifact through a multi-stage pipeline", async () => {
		const { dependencies, judged, executed } = fakeStageDependencies();
		const context = {
			...(await stageContext()),
			pipeline: {
				statuses: ["To Do", "Done"],
				target: TEST_TARGET,
				stages: [
					planningStage("discuss", "spec", "rubrics/shape.json"),
					planningStage("grill", "grilled", "rubrics/shape.json"),
					deliveryStage,
				],
			},
		};

		await runGradedStages(dependencies, context);

		expect(executed).toEqual(["discuss", "grill", "build"]);
		expect(judged[2]?.priorArtifacts.map(({ path }) => path)).toEqual([
			"backlog/docs/discuss.md",
			"backlog/docs/grill.md",
		]);
	});

	it("executes stages in their declared order, not a known one", async () => {
		const { dependencies, executed } = fakeStageDependencies();
		const context = {
			...(await stageContext()),
			pipeline: {
				statuses: ["To Do", "Done"],
				target: TEST_TARGET,
				stages: [
					planningStage("discuss", "spec", "rubrics/shape.json"),
					planningStage("plan", "plan", "rubrics/shape.json"),
					planningStage("grill", "grilled", "rubrics/shape.json"),
					deliveryStage,
				],
			},
		};

		await runGradedStages(dependencies, context);

		expect(executed).toEqual(["discuss", "plan", "grill", "build"]);
	});

	it("labels a transcript with the stage name, not the skill it ran", async () => {
		const { dependencies, executed } = fakeStageDependencies();
		const context = {
			...(await stageContext()),
			pipeline: {
				statuses: ["To Do", "Done"],
				target: TEST_TARGET,
				stages: [
					{
						name: "research",
						kind: "planning" as const,
						skill: "discuss",
						artifact: "findings",
						rubric: "rubrics/shape.json",
						requiresAcceptanceCriteria: false,
					},
					deliveryStage,
				],
			},
		};

		const outcome = await runGradedStages(dependencies, context);

		expect(executed).toEqual(["discuss", "build"]);
		expect(outcome.workflow.map(({ stage }) => stage)).toEqual([
			"research",
			"build",
		]);
		expect(outcome.stageScorecards.map(({ stage }) => stage)).toEqual([
			"research",
			"build",
		]);
	});

	it("executes a fifth stage under a name the harness never knew", async () => {
		const { dependencies, judged, executed, rubricsUsed } =
			fakeStageDependencies();
		const context = {
			...(await stageContext()),
			pipeline: {
				statuses: ["To Do", "Done"],
				target: TEST_TARGET,
				stages: [
					planningStage("discuss", "spec", "rubrics/shape.json"),
					planningStage("research", "findings", "rubrics/shape.json"),
					planningStage("plan", "plan", "rubrics/shape.json"),
					deliveryStage,
				],
			},
		};

		await runGradedStages(dependencies, context);

		expect(executed).toEqual(["discuss", "research", "plan", "build"]);
		expect(judged[1]?.stage).toBe("research");
		expect(rubricsUsed[1]?.endsWith("rubrics/shape.json")).toBe(true);
	});

	it("carries a planning stage's commits into evidence and the baseline", async () => {
		const { dependencies, judged } = fakeStageDependencies();
		const buildBaselines: string[] = [];
		const committing = {
			...dependencies,
			assertPlanningStageCompleted: (
				_targetDir: string,
				_baselineSha: string,
				stage: { readonly name: string },
			) =>
				Promise.resolve({
					taskState: `${stage.name}-state`,
					artifact: {
						path: `backlog/docs/${stage.name}.md`,
						content: `${stage.name} artifact`,
					},
					resultSha: `${stage.name}-sha`,
					diff: "glossary-diff",
					changedPaths: ["GLOSSARY.md"],
					commitSubjects: [`${stage.name} commit`],
				}),
			assertBuildCommitted: (_targetDir: string, baselineSha: string) => {
				buildBaselines.push(baselineSha);

				return Promise.resolve({
					resultSha: "result-sha",
					diff: "the-diff",
					commitSubjects: ["build commit"],
				});
			},
		};

		const outcome = await runGradedStages(committing, await stageContext());

		expect(judged[0]?.taskState).toBe("the task card");
		expect(judged[0]?.diff).toBe("glossary-diff");
		expect(judged[0]?.changedPaths).toEqual(["GLOSSARY.md"]);
		expect(judged.map(({ commitSubjects }) => commitSubjects)).toEqual([
			["shape commit"],
			["build commit"],
		]);
		expect(buildBaselines).toEqual(["shape-sha"]);
		expect(outcome.checkpoints.map(({ targetSha }) => targetSha)).toEqual([
			"shape-sha",
			"result-sha",
		]);
	});

	it("withholds commit subjects when delivery validation fails", async () => {
		const { dependencies, judged } = fakeStageDependencies();
		const invalid = {
			...dependencies,
			assertBuildCommitted: () =>
				Promise.reject(
					new StageValidationError(
						"Build phase rewrote or discarded task history",
					),
				),
		};

		await runGradedStages(invalid, await stageContext());

		const [, buildInput] = judged;
		expect(buildInput?.harnessFailure).toBe(
			"Build phase rewrote or discarded task history",
		);
		expect(buildInput).not.toHaveProperty("commitSubjects");
	});

	it("writes a checkpoint for every accepted stage and chains lineage", async () => {
		const { dependencies } = fakeStageDependencies();
		const context = await stageContext();
		await mkdir(join(context.targetDir, "backlog"), { recursive: true });
		await Bun.write(
			join(context.targetDir, "backlog", "config.yml"),
			"statuses: []\n",
		);

		const outcome = await runGradedStages(dependencies, context);

		expect(outcome.checkpoints.map(({ stage }) => stage)).toEqual([
			"shape",
			"build",
		]);
		expect(outcome.checkpoints[0]?.upstream).toBe(context.initialLineage);
		expect(outcome.checkpoints[1]?.upstream).toBe(
			outcome.checkpoints[0]?.lineage,
		);
		expect(outcome.checkpoints[0]?.targetSha).toBe("task-sha");
		expect(outcome.checkpoints[1]?.targetSha).toBe("result-sha");
		expect(outcome.checkpoints[0]?.artifacts.map(({ path }) => path)).toEqual([
			"backlog/docs/shape.md",
		]);
		for (const record of outcome.checkpoints) {
			const written: unknown = JSON.parse(
				await Bun.file(
					join(context.checkpointDirectory(record.stage), "checkpoint.json"),
				).text(),
			);
			expect(written).toEqual(record);
		}
	});

	it("keeps accepted checkpoints when a later stage is rejected", async () => {
		const { dependencies, scorecardFor } = fakeStageDependencies();
		const context = {
			...(await stageContext()),
			calibrateStageFailure: (): Promise<CalibrationResult> =>
				Promise.resolve({
					humanReview: { verdict: "REJECT", summary: "failed", findings: [] },
					instructionsChanged: false,
					rubricChanged: false,
					stageRubricsChanged: [],
				}),
		};
		const failing = {
			...dependencies,
			runStageJudge: (
				_model: string,
				_effort: undefined | "low" | "medium" | "high" | "xhigh" | "max",
				_budget: number,
				input: StageJudgeInput,
				_source: {
					readonly rubricPath: string;
					readonly content: string;
					readonly rubric: StageRubric;
				},
			) =>
				Promise.resolve(
					scorecardFor(input, input.stage === "build" ? "STOP" : "CONTINUE"),
				),
		};

		expect(runGradedStages(failing, context)).rejects.toThrow(
			"minimum grade is B",
		);

		expect(
			await Bun.file(
				join(context.checkpointDirectory("shape"), "checkpoint.json"),
			).exists(),
		).toBe(true);
		expect(
			await Bun.file(
				join(context.checkpointDirectory("build"), "checkpoint.json"),
			).exists(),
		).toBe(false);
	});

	it("fails before any stage runs when a skill's corpus is missing", async () => {
		const { dependencies, executed } = fakeStageDependencies();
		const missing = {
			...dependencies,
			resolveSkillDirectory: (skill: string) => {
				if (skill === "build") {
					return Promise.reject(
						new Error(`The ${skill} skill is not installed`),
					);
				}

				return Promise.resolve(`/skills/${skill}`);
			},
		};

		expect(runGradedStages(missing, await stageContext())).rejects.toThrow(
			"build skill is not installed",
		);
		expect(executed).toEqual([]);
	});

	it("fails before any stage runs when a global skill is missing", async () => {
		const { dependencies, executed } = fakeStageDependencies();
		const missing = {
			...dependencies,
			resolveSkillDirectory: (skill: string) => {
				if (skill === "doctrine") {
					return Promise.reject(
						new Error(`The ${skill} skill is not installed`),
					);
				}

				return Promise.resolve(`/skills/${skill}`);
			},
		};

		expect(runGradedStages(missing, await stageContext())).rejects.toThrow(
			"doctrine skill is not installed",
		);
		expect(executed).toEqual([]);
	});

	it("hashes a stage's corpus when the stage starts, not at run start", async () => {
		const { dependencies } = fakeStageDependencies();
		const log: string[] = [];
		const timed = {
			...dependencies,
			resolveSkillDirectory: (skill: string) => {
				log.push(`resolve:${skill}`);

				return Promise.resolve(`/skills/${skill}`);
			},
			captureStageCorpus: (
				...args: Readonly<Parameters<StageDependencies["captureStageCorpus"]>>
			) => {
				log.push(`corpus:${args[0]}`);

				return dependencies.captureStageCorpus(...args);
			},
			runWorkflowStage: (
				...args: Readonly<Parameters<(typeof dependencies)["runWorkflowStage"]>>
			) => {
				log.push(`run:${args[0].stage}`);

				return dependencies.runWorkflowStage(...args);
			},
		};

		await runGradedStages(timed, await stageContext());

		expect(log).toEqual([
			"resolve:doctrine",
			"resolve:shape",
			"resolve:build",
			"corpus:shape",
			"run:shape",
			"corpus:build",
			"run:build",
		]);
	});

	it("stops after a failing grade and calibrates the failed stage", async () => {
		const { dependencies, scorecardFor, judged, executed } =
			fakeStageDependencies();
		const context = await stageContext();
		let calibrations = 0;
		const failing = {
			...dependencies,
			runStageJudge: (
				_model: string,
				_effort: undefined | "low" | "medium" | "high" | "xhigh" | "max",
				_budget: number,
				input: StageJudgeInput,
				_source: {
					readonly rubricPath: string;
					readonly content: string;
					readonly rubric: StageRubric;
				},
			) => {
				judged.push(input);

				return Promise.resolve(
					scorecardFor(input, input.stage === "shape" ? "STOP" : "CONTINUE"),
				);
			},
		};
		const calibrating = {
			...context,
			calibrateStageFailure: (): Promise<CalibrationResult> => {
				calibrations += 1;

				return Promise.resolve({
					humanReview: {
						verdict: "REJECT",
						summary: "The shape stage failed.",
						findings: [],
					},
					instructionsChanged: false,
					rubricChanged: false,
					stageRubricsChanged: [],
				});
			},
		};

		const outcome = runGradedStages(failing, calibrating);

		expect(outcome).rejects.toThrow("minimum grade is B");
		expect(executed).toEqual(["shape"]);
		expect(calibrations).toBe(1);
		const stageRecord = z
			.looseObject({
				calibration: z.looseObject({
					humanReview: z.looseObject({ verdict: z.string() }),
				}),
			})
			.parse(JSON.parse(await Bun.file(calibrating.stageFile("shape")).text()));
		expect(stageRecord.calibration.humanReview.verdict).toBe("REJECT");
	});

	it("preserves the stage session inputs when adding a stopped scorecard's calibration", async () => {
		const { dependencies, scorecardFor } = fakeStageDependencies();
		const context = {
			...(await stageContext()),
			model: "opus",
			effort: "high" as const,
			calibrateStageFailure: (): Promise<CalibrationResult> =>
				Promise.resolve({
					humanReview: { verdict: "REJECT", summary: "failed", findings: [] },
					instructionsChanged: false,
					rubricChanged: false,
					stageRubricsChanged: [],
				}),
		};
		const failing = {
			...dependencies,
			runStageJudge: (
				_model: string,
				_effort: undefined | "low" | "medium" | "high" | "xhigh" | "max",
				_budget: number,
				input: StageJudgeInput,
			) => Promise.resolve(scorecardFor(input, "STOP")),
		};

		const outcome = runGradedStages(failing, context);

		expect(outcome).rejects.toThrow("minimum grade is B");
		await outcome.catch(() => undefined);

		const stageRecord = z
			.object({
				calibration: z.object({
					humanReview: z.object({ verdict: z.literal("REJECT") }),
				}),
				corpusFiles: z.array(
					z.object({ path: z.string(), sha256: z.string() }),
				),
				model: z.string(),
				effort: z.string(),
			})
			.parse(JSON.parse(await Bun.file(context.stageFile("shape")).text()));
		expect(stageRecord).toEqual({
			calibration: { humanReview: { verdict: "REJECT" } },
			corpusFiles: [
				{
					path: "skills/shape/SKILL.md",
					sha256: createHash("sha256").update("shape").digest("hex"),
				},
			],
			model: "opus",
			effort: "high",
		});
	});

	it("retains commit subjects when calibrating a stopped delivery", async () => {
		const { dependencies, scorecardFor } = fakeStageDependencies();
		const context = {
			...(await stageContext()),
			pipeline: {
				statuses: ["To Do", "Done"],
				target: TEST_TARGET,
				stages: [deliveryStage],
			},
			calibrateStageFailure: (): Promise<CalibrationResult> =>
				Promise.resolve({
					humanReview: { verdict: "REJECT", summary: "failed", findings: [] },
					instructionsChanged: false,
					rubricChanged: false,
					stageRubricsChanged: [],
				}),
		};
		const failing = {
			...dependencies,
			runStageJudge: (
				_model: string,
				_effort: undefined | "low" | "medium" | "high" | "xhigh" | "max",
				_budget: number,
				input: StageJudgeInput,
			) => Promise.resolve(scorecardFor(input, "STOP")),
		};

		const outcome = runGradedStages(failing, context);
		expect(outcome).rejects.toThrow("minimum grade is B");
		await outcome.catch(() => undefined);

		const calibratedRecord: unknown = JSON.parse(
			await Bun.file(context.stageFile("build")).text(),
		);
		const calibrated = z
			.object({
				input: z.object({ commitSubjects: z.array(z.string()) }),
				calibration: z.object({
					humanReview: z.object({ verdict: z.literal("REJECT") }),
				}),
			})
			.parse(calibratedRecord);
		expect(calibrated.input.commitSubjects).toEqual(["build commit"]);
		expect(calibrated.calibration.humanReview.verdict).toBe("REJECT");
	});
});

describe(runBenchmark.name, () => {
	it("rejects a malformed pipeline before claiming the target", async () => {
		const source = await testResources.createRepository();
		const badPipeline = join("pipelines", `invalid-${randomUUID()}.json`);
		const absolutePipeline = join(PROJECT_ROOT, badPipeline);
		await Bun.write(
			absolutePipeline,
			JSON.stringify({
				statuses: ["To Do", "Done"],
				target: TEST_TARGET,
				stages: [{ name: "discuss", kind: "planning" }],
			}),
		);

		try {
			expect(
				runBenchmark(
					{
						sourceDir: source.directory,
						model: "sonnet",
						judgeModel: "sonnet",
						sessionBudgetUsd: 5,
						pipelinePath: badPipeline,
					},
					{ question: () => Promise.resolve("") },
				),
			).rejects.toThrow(/discuss/u);

			const marker = join(source.directory, ".git", "benchmark-run.json");
			expect(await Bun.file(marker).exists()).toBe(false);
			expect(
				await runCommand(["git", "status", "--porcelain"], source.directory),
			).toBe("");
		} finally {
			await rm(absolutePipeline, { force: true });
		}
	});
});

describe(buildRunArtifact.name, () => {
	describe(runFinalJudge.name, () => {
		it("writes the failed main artifact after two rejected payloads", async () => {
			const directory = await mkdtemp(join(tmpdir(), "rehearsal-final-judge-"));
			testResources.track(directory);
			const artifactFile = join(directory, "run.json");
			const persistence = new ControlledRunArtifactPersistence();
			const abort = createRunAbort(
				{
					killActiveCommands: () => Promise.resolve(),
					registerSignal: () => undefined,
					releaseSignal: () => undefined,
					exit: () => undefined,
					reportError: () => undefined,
					persistence,
				},
				{
					artifactFile,
					teardown: () => Promise.resolve(),
				},
			);
			const pipeline = await loadDefaultPipeline();
			const baseInputs = artifactBaseInputs(pipeline, "pipelines/default.json");
			const rubric = RUBRIC_IDS.map(
				(id, index) => `${index + 1}. \`${id}\`: ${id} requirement.`,
			).join("\n");
			const invalidGrade = withFirstRequirement(completeGrade("PASS"), {
				...requirement(RUBRIC_IDS[0], "PASS"),
				evidence: [
					{
						source: "diff",
						path: "src/missing.ts",
						claim: "unavailable evidence",
					},
				],
			});
			let calls = 0;
			const result = runFinalJudge({
				artifactInputs: {
					...baseInputs,
					rubric,
					rubricIds: RUBRIC_IDS,
					evidence: {
						...baseInputs.evidence,
						changedPaths: ["src/audit/example.ts"],
					},
				},
				writeFailedArtifact: abort.writeFailedArtifact,
				invoke: () => {
					calls += 1;

					return Promise.resolve(
						JSON.stringify({
							session_id: "judge-session",
							total_cost_usd: 0.1,
							structured_output: invalidGrade,
						}),
					);
				},
			});

			expect(result).rejects.toBeInstanceOf(JudgeOutputValidationError);
			await result.catch(() => undefined);

			const artifact: unknown = JSON.parse(
				persistence.files.get(artifactFile) ?? "",
			);
			expect(calls).toBe(2);
			expect(artifact).toMatchObject({
				status: "FAILED",
				workflow: [],
				stageScorecards: [],
				judgeAttempts: [
					{ outcome: "REJECTED", costUsd: 0.1 },
					{ outcome: "REJECTED", costUsd: 0.1 },
				],
				judgeCostUsd: 0.2,
				failure:
					"Judge cited unavailable evidence for tests: diff:src/missing.ts",
			});
			expect(artifact).not.toHaveProperty("grade");
		});
	});

	it("builds a failed artifact from rejected final Judge attempts", async () => {
		const pipeline = await loadDefaultPipeline();
		const attempts: readonly JudgeAttempt[] = [
			{
				payload: { summary: "first invalid payload" },
				costUsd: 0.1,
				outcome: "REJECTED",
				error: "first validation error",
			},
			{
				payload: { summary: "second invalid payload" },
				costUsd: 0.2,
				outcome: "REJECTED",
				error: "second validation error",
			},
		];
		const failure = new JudgeOutputValidationError({
			message: "second validation error",
			prompt: "original prompt",
			attempts,
			costUsd: 0.3,
		});

		const artifact = buildFailedJudgeRunArtifact(
			artifactBaseInputs(pipeline, "pipelines/default.json"),
			failure,
		);

		expect(artifact).toMatchObject({
			status: "FAILED",
			workflow: [],
			stageScorecards: [],
			baselineContext: [],
			diff: "the-diff",
			changedPaths: ["src/example.ts"],
			checkIntegrity: harnessResult("PASS", "checks match"),
			localChecks: harnessResult("PASS", "all green"),
			judgePrompt: "original prompt",
			judgeAttempts: attempts,
			judgeCostUsd: 0.3,
			failure: "second validation error",
		});
		expect("grade" in artifact).toBe(false);
	});

	it("records successful final Judge attempts and aggregate cost", async () => {
		const pipeline = await loadDefaultPipeline();
		const attempts: readonly JudgeAttempt[] = [
			{
				payload: { summary: "invalid" },
				costUsd: 0.1,
				outcome: "REJECTED",
				error: "invalid evidence",
			},
			{
				payload: { summary: "accepted" },
				costUsd: 0.2,
				outcome: "ACCEPTED",
			},
		];
		const inputs = artifactInputs(pipeline, "pipelines/default.json");

		const artifact = buildRunArtifact({
			...inputs,
			judge: { ...inputs.judge, attempts, costUsd: 0.3 },
		});

		expect(artifact.judgeAttempts).toBe(attempts);
		expect(artifact.judgeCostUsd).toBeCloseTo(0.3);
	});

	it("records the pipeline it ran and the path it came from", async () => {
		const pipelinePath = join("pipelines", `custom-${randomUUID()}.json`);
		const absolute = join(PROJECT_ROOT, pipelinePath);
		await Bun.write(
			absolute,
			JSON.stringify({
				statuses: ["To Do", "Done"],
				target: TEST_TARGET,
				stages: [
					{
						name: "sketch",
						kind: "planning",
						skill: "discuss",
						artifact: "backlog/docs/sketch.md",
						rubric: "rubrics/shape.json",
					},
					{
						name: "build",
						kind: "delivery",
						skill: "build",
						rubric: "rubrics/build.json",
					},
				],
			}),
		);

		try {
			const pipeline = await loadPipeline(pipelinePath);

			const artifact = buildRunArtifact(artifactInputs(pipeline, pipelinePath));

			expect(artifact.pipelinePath).toBe(pipelinePath);
			expect(artifact.pipeline.stages.map(({ name }) => name)).toEqual([
				"sketch",
				"build",
			]);
		} finally {
			await rm(absolute, { force: true });
		}
	});

	it("records the default pipeline when the run used it", async () => {
		const pipeline = await loadDefaultPipeline();

		const artifact = buildRunArtifact(
			artifactInputs(pipeline, "pipelines/default.json"),
		);

		expect(artifact.pipelinePath).toBe("pipelines/default.json");
		expect(artifact.pipeline.stages.map(({ name }) => name)).toEqual([
			"shape",
			"build",
		]);
	});

	it("records the same path whichever way the run named the pipeline", async () => {
		const asConfigured = (pipelineArgument: string): string =>
			parseArgs(
				[
					"--target",
					"/tmp/target",
					"--model",
					"sonnet",
					"--session-budget-usd",
					"5",
					"--pipeline",
					pipelineArgument,
				],
				{},
			).pipelinePath;

		const pipeline = await loadDefaultPipeline();
		const recorded = [
			"pipelines/default.json",
			join(PROJECT_ROOT, "pipelines/default.json"),
			"rubrics/../pipelines/default.json",
		].map(
			(argument) =>
				buildRunArtifact(artifactInputs(pipeline, asConfigured(argument)))
					.pipelinePath,
		);

		expect(recorded).toEqual([
			"pipelines/default.json",
			"pipelines/default.json",
			"pipelines/default.json",
		]);
	});
});

describe(retainedCheckpointRecorder.name, () => {
	it("records the checkpoint and pins its commit under refs/rehearsal", async () => {
		const source = await testResources.createRepository();
		const checkpointDir = join(source.directory, ".checkpoints", "initial");

		const record = await retainedCheckpointRecorder("run-1")(
			source.directory,
			checkpointDir,
			{
				stage: "initial",
				targetSha: source.sha,
				upstream: "root-key",
				model: "sonnet",
				corpusFiles: [],
				artifacts: [],
			},
		);

		expect(record.stage).toBe("initial");
		expect(
			await Bun.file(join(checkpointDir, "checkpoint.json")).exists(),
		).toBe(true);
		const retainedSha = await runCommand(
			["git", "rev-parse", "refs/rehearsal/run-1"],
			source.directory,
		);
		expect(retainedSha.trim()).toBe(source.sha);
	});
});
