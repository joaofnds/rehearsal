import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import {
	parseConfirmationGroupRecord,
	parseConfirmationRepRecord,
} from "./confirmation-record";
import { loadAttempts, presentAttempts } from "./attempts";
import { assertPlanningStageCompleted, installInstructions } from "./backlog";
import type { CheckpointRecord, HashedFile } from "./checkpoint";
import {
	captureStageCorpus,
	hashWorkflowState,
	initialCheckpointInputs,
	lineageKey,
	materializeCheckpoint,
	recordCheckpoint,
	skillSearchRoots,
} from "./checkpoint";
import { captureBaselineContext, captureFileHashes } from "./checks";
import { runCommand } from "./command";
import type {
	ClaudeCallMetrics,
	LocalCheckResult,
	StageJudgeInput,
	StageScorecard,
} from "./contracts";
import type { JudgeAttempt } from "./judge-attempt";
import { JudgeOutputValidationError } from "./judge-attempt";
import type { RunManifest } from "./manifest";
import { writeRunManifest } from "./manifest";
import type { ReplayDependencies, ReplayRequest } from "./replay";
import {
	loadRunCheckpoints,
	readReplayRecord,
	resolveReplay,
	runReplay,
} from "./replay";
import { runReplayConfirmation } from "./replay-confirmation";
import { benchmarkRunPaths } from "./run-layout";
import { loadStageRubric } from "./stage-grading";
import { addWorktree, removeWorktree } from "./target";
import { TestResources, commitAll } from "./test-support";

const testResources = TestResources.forEachTest();

function harnessResult(
	status: "PASS" | "FAIL",
	claim: string,
): LocalCheckResult {
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

describe(loadRunCheckpoints.name, () => {
	it("loads every recorded checkpoint by its stage name", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-run-"));
		testResources.track(directory);
		const targetDir = join(directory, "target");
		await mkdir(join(targetDir, "backlog"), { recursive: true });
		await Bun.write(join(targetDir, "backlog", "config.yml"), "statuses: []\n");
		const runDirectory = join(directory, "checkpoints");
		const base = {
			targetSha: "task-sha",
			upstream: "root-key",
			model: "sonnet",
			corpusFiles: [],
			artifacts: [],
		};
		await recordCheckpoint(targetDir, join(runDirectory, "initial"), {
			...base,
			stage: "initial",
		});
		await recordCheckpoint(targetDir, join(runDirectory, "discuss"), {
			...base,
			stage: "discuss",
		});
		await Bun.write(join(runDirectory, "manifest.json"), "{}\n");

		const checkpoints = await loadRunCheckpoints(runDirectory);

		expect([...checkpoints.keys()].toSorted()).toEqual(["discuss", "initial"]);
		expect(checkpoints.get("discuss")?.stage).toBe("discuss");
	});
});

describe(resolveReplay.name, () => {
	function manifest(): RunManifest {
		return {
			timestamp: "2026-08-30T00:00:00.000Z",
			controlSha: "control-sha",
			sourceRoot: "/tmp/target",
			sourceSha: "source-sha",
			taskId: "TASK-1",
			taskSha: "task-sha",
			task: "Task text",
			productBrief: "Brief text",
			model: "sonnet",
			judgeModel: "sonnet",
			sessionBudgetUsd: 5,
			pipelinePath: "pipelines/default.json",
			pipeline: {
				statuses: ["To Do", "Done"],
				stages: [
					{
						name: "discuss",
						kind: "planning",
						skill: "discuss",
						artifact: "spec",
						rubric: "rubrics/discuss.json",
						requiresAcceptanceCriteria: false,
					},
					{
						name: "plan",
						kind: "planning",
						skill: "plan",
						artifact: "plan",
						rubric: "rubrics/plan.json",
						requiresAcceptanceCriteria: true,
					},
					{
						name: "build",
						kind: "delivery",
						skill: "build",
						rubric: "rubrics/build.json",
					},
				],
			},
		};
	}

	function record(
		stage: string,
		lineage: string,
		upstream: string,
		artifacts: readonly {
			readonly path: string;
			readonly sha256: string;
		}[] = [],
	): CheckpointRecord {
		return {
			stage,
			targetSha: "task-sha",
			lineage,
			upstream,
			model: "sonnet",
			corpusFiles: [],
			artifacts,
			workflowState: [],
		};
	}

	const artifactHash = { path: "backlog/docs/DOC-1 - spec.md", sha256: "aa" };

	function checkpoints(): Map<string, CheckpointRecord> {
		return new Map([
			["initial", record("initial", "lin-0", "root-key")],
			["discuss", record("discuss", "lin-1", "lin-0", [artifactHash])],
			[
				"plan",
				record("plan", "lin-2", "lin-1", [
					{ path: "backlog/docs/DOC-2 - plan.md", sha256: "bb" },
				]),
			],
		]);
	}

	it("consumes the preceding stage's checkpoint and carries earlier artifacts", () => {
		const plan = resolveReplay(manifest(), checkpoints(), "build");

		expect(plan.definition.name).toBe("build");
		expect(plan.consumed.stage).toBe("plan");
		expect(plan.consumed.lineage).toBe("lin-2");
		expect(plan.priorArtifacts.map(({ path }) => path)).toEqual([
			"backlog/docs/DOC-1 - spec.md",
			"backlog/docs/DOC-2 - plan.md",
		]);
	});

	it("replays the first stage from the initial checkpoint", () => {
		const plan = resolveReplay(manifest(), checkpoints(), "discuss");

		expect(plan.consumed.stage).toBe("initial");
		expect(plan.priorArtifacts).toEqual([]);
	});

	it("names the missing initial checkpoint on a run that predates it", () => {
		const stale = checkpoints();
		stale.delete("initial");

		expect(() => resolveReplay(manifest(), stale, "discuss")).toThrow(
			/no initial checkpoint/u,
		);
	});

	it("refuses a stage the run's pipeline never declared", () => {
		expect(() => resolveReplay(manifest(), checkpoints(), "grill")).toThrow(
			/discuss, plan, build/u,
		);
	});

	it("refuses to replay past the point the run reached", () => {
		const partial = checkpoints();
		partial.delete("plan");

		expect(() => resolveReplay(manifest(), partial, "build")).toThrow(
			/no checkpoint for the plan stage/u,
		);
	});

	it("refuses a checkpoint chain that does not link back to the root", () => {
		const forged = checkpoints();
		forged.set("plan", record("plan", "lin-2", "lin-forged"));

		expect(() => resolveReplay(manifest(), forged, "build")).toThrow(
			/chain is broken at the plan stage/u,
		);
	});

	it("carries the whole consumed chain, in order, for staleness", () => {
		const plan = resolveReplay(manifest(), checkpoints(), "build");

		expect(plan.chain.map(({ stage }) => stage)).toEqual([
			"initial",
			"discuss",
			"plan",
		]);
	});

	it("carries only the initial checkpoint when replaying the first stage", () => {
		const plan = resolveReplay(manifest(), checkpoints(), "discuss");

		expect(plan.chain.map(({ stage }) => stage)).toEqual(["initial"]);
	});
});

describe(runReplay.name, () => {
	const SPEC_CONTENT = "the spec\n";
	const SPEC_PATH = "backlog/docs/DOC-1 - spec.md";

	interface RecordedRun {
		readonly paths: ReturnType<typeof benchmarkRunPaths>;
		readonly manifest: RunManifest;
		readonly initial: CheckpointRecord;
		readonly discuss: CheckpointRecord;
		readonly build: CheckpointRecord;
	}

	async function recordedRun(
		discussCorpus: readonly HashedFile[] = [],
	): Promise<RecordedRun> {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-replayrun-"));
		testResources.track(directory);
		const paths = benchmarkRunPaths(directory, "run");
		const stateDir = join(directory, "state");
		await mkdir(join(stateDir, "backlog", "docs"), { recursive: true });
		await Bun.write(join(stateDir, "backlog", "config.yml"), "statuses: []\n");
		const initial = await recordCheckpoint(
			stateDir,
			paths.checkpointDirectory("initial"),
			{
				stage: "initial",
				targetSha: "task-sha",
				upstream: "root-key",
				model: "sonnet",
				corpusFiles: [],
				artifacts: [],
			},
		);
		await Bun.write(join(stateDir, SPEC_PATH), SPEC_CONTENT);
		const discuss = await recordCheckpoint(
			stateDir,
			paths.checkpointDirectory("discuss"),
			{
				stage: "discuss",
				targetSha: "task-sha",
				upstream: initial.lineage,
				model: "sonnet",
				corpusFiles: discussCorpus,
				artifacts: [
					{
						path: SPEC_PATH,
						sha256: createHash("sha256").update(SPEC_CONTENT).digest("hex"),
					},
				],
			},
		);
		const build = await recordCheckpoint(
			stateDir,
			paths.checkpointDirectory("build"),
			{
				stage: "build",
				targetSha: "candidate-sha",
				upstream: discuss.lineage,
				model: "sonnet",
				corpusFiles: [
					{
						path: "skills/build/SKILL.md",
						sha256: createHash("sha256").update("build").digest("hex"),
					},
				],
				artifacts: [],
			},
		);
		const manifest: RunManifest = {
			timestamp: "2026-08-30T00:00:00.000Z",
			controlSha: "run-control-sha",
			sourceRoot: join(directory, "primary"),
			sourceSha: "source-sha",
			taskId: "TASK-1",
			taskSha: "task-sha",
			task: "Task text",
			productBrief: "Brief text",
			model: "sonnet",
			judgeModel: "sonnet",
			sessionBudgetUsd: 5,
			pipelinePath: "pipelines/default.json",
			pipeline: {
				statuses: ["To Do", "Done"],
				stages: [
					{
						name: "discuss",
						kind: "planning",
						skill: "discuss",
						artifact: "spec",
						rubric: "rubrics/discuss.json",
						requiresAcceptanceCriteria: false,
					},
					{
						name: "build",
						kind: "delivery",
						skill: "build",
						rubric: "rubrics/build.json",
					},
					{
						name: "review",
						kind: "delivery",
						skill: "review",
						rubric: "rubrics/review.json",
					},
				],
			},
		};
		await writeRunManifest(paths.manifestFile, manifest);

		return {
			paths,
			manifest,
			initial,
			discuss,
			build,
		};
	}

	function scorecardFor(
		input: StageJudgeInput,
		verdict: "CONTINUE" | "STOP" = "CONTINUE",
	): StageScorecard {
		return {
			stage: input.stage,
			rubricPath: "rubrics/stage.json",
			rubric: {
				hardBlockers: [],
				requirements: [{ id: "scope", description: "Scope is explicit" }],
				dimensions: [
					{ id: "clarity", description: "Clear", good: "g", excellent: "e" },
				],
			},
			input,
			prompt: "prompt",
			attempts: [],
			costUsd: 0.5,
			grade: {
				hardBlockers: [],
				requirements: [],
				dimensions: [],
				summary: "graded",
				grade: verdict === "CONTINUE" ? "B" : "F",
				verdict,
			},
		};
	}

	interface ReplayHarness {
		readonly dependencies: ReplayDependencies;
		readonly stageDirs: string[];
		readonly branchExpectations: (string | null | undefined)[];
		readonly worktrees: { root: string; sha: string; path: string }[];
		readonly removed: string[];
		readonly installed: string[];
		readonly judged: StageJudgeInput[];
		readonly log: string[];
		readonly corpusCaptures: {
			skill: string;
			instructions: string;
			roots: readonly string[];
		}[];
	}

	function fakeReplayDependencies(
		overrides: Partial<ReplayDependencies> = {},
	): ReplayHarness {
		const stageDirs: string[] = [];
		const branchExpectations: (string | null | undefined)[] = [];
		const worktrees: { root: string; sha: string; path: string }[] = [];
		const removed: string[] = [];
		const installed: string[] = [];
		const judged: StageJudgeInput[] = [];
		const log: string[] = [];
		const corpusCaptures: {
			skill: string;
			instructions: string;
			roots: readonly string[];
		}[] = [];

		const dependencies: ReplayDependencies = {
			stageSession: {
				runWorkflowStage: ({ targetDir, stage }) => {
					stageDirs.push(targetDir);

					return Promise.resolve({
						stage,
						sessionId: "session",
						costUsd: 1.25,
						exchanges: [],
					});
				},
				readTaskOutput: (targetDir) => {
					stageDirs.push(targetDir);

					return Promise.resolve(
						JSON.stringify({
							task: { acceptanceCriteria: ["done"], documentation: [] },
						}),
					);
				},
				readTaskCard: () => Promise.resolve("the task card"),
				captureBuildCandidate: (targetDir) => {
					stageDirs.push(targetDir);

					return Promise.resolve({
						resultSha: "candidate-sha",
						diff: "diff",
						changedPaths: [],
					});
				},
				assertPlanningStageCompleted: (
					targetDir,
					baselineSha,
					stage,
					_taskState,
					expectedBranch,
				) => {
					stageDirs.push(targetDir);
					branchExpectations.push(expectedBranch);

					return Promise.resolve({
						taskState: `${stage.name}-state`,
						artifact: {
							path: `backlog/docs/${stage.name}.md`,
							content: `${stage.name} artifact`,
						},
						resultSha: baselineSha,
						diff: "",
						changedPaths: [],
					});
				},
				assertBuildCommitted: (targetDir, _taskSha, expectedBranch) => {
					stageDirs.push(targetDir);
					branchExpectations.push(expectedBranch);

					return Promise.resolve({
						resultSha: "result-sha",
						diff: "the-diff",
						commitSubjects: ["replayed commit"],
					});
				},
				changedPathsBetween: (targetDir) => {
					stageDirs.push(targetDir);

					return Promise.resolve(["src/example.ts"]);
				},
				captureCheckIntegrity: (targetDir) => {
					stageDirs.push(targetDir);

					return Promise.resolve(harnessResult("PASS", "checks match"));
				},
				captureTreatmentChecks: (targetDir) => {
					stageDirs.push(targetDir);

					return Promise.resolve(harnessResult("PASS", "all green"));
				},
				captureStageCorpus: (skill, instructions, roots) => {
					corpusCaptures.push({ skill, instructions, roots });

					return Promise.resolve([
						{
							path: `skills/${skill}/SKILL.md`,
							sha256: createHash("sha256").update(skill).digest("hex"),
						},
					]);
				},
			},
			runStageJudge: (_model, _effort, _budget, input) => {
				judged.push(input);

				return Promise.resolve(scorecardFor(input));
			},
			loadStageRubric: () =>
				Promise.resolve({
					rubricPath: "rubrics/stage.json",
					content: "{}",
					rubric: {
						hardBlockers: [],
						requirements: [{ id: "scope", description: "Scope is explicit" }],
						dimensions: [
							{
								id: "clarity",
								description: "Clear",
								good: "g",
								excellent: "e",
							},
						],
					},
				}),
			addWorktree: (root, sha, path) => {
				worktrees.push({ root, sha, path });

				return Promise.resolve();
			},
			removeWorktree: (_root, path) => {
				removed.push(path);

				return Promise.resolve();
			},
			materializeCheckpoint,
			captureFileHashes: (targetDir) => {
				stageDirs.push(targetDir);

				return Promise.resolve(new Map<string, string>());
			},
			captureBaselineContext: (targetDir) => {
				stageDirs.push(targetDir);

				return Promise.resolve([]);
			},
			installInstructions: (targetDir) => {
				stageDirs.push(targetDir);

				return Promise.resolve("base-sha");
			},
			installDependencies: (targetDir) => {
				installed.push(targetDir);

				return Promise.resolve();
			},
			log: (message) => {
				log.push(message);
			},
			...overrides,
		};

		return {
			dependencies,
			stageDirs,
			branchExpectations,
			worktrees,
			removed,
			installed,
			judged,
			log,
			corpusCaptures,
		};
	}

	function request(
		run: Awaited<ReturnType<typeof recordedRun>>,
		stage: string,
	): ReplayRequest {
		return {
			paths: run.paths,
			stage,
			instructions: "Current instructions",
			controlSha: "control-sha",
			model: "sonnet",
			judgeModel: "opus",
			sessionBudgetUsd: 5,
		};
	}

	it("replays a delivery stage in the worktree and never touches the primary", async () => {
		const run = await recordedRun();
		const fake = fakeReplayDependencies();

		const outcome = await runReplay(fake.dependencies, request(run, "build"));

		const [worktree] = fake.worktrees;
		expect(worktree?.root).toBe(run.manifest.sourceRoot);
		expect(worktree?.sha).toBe(run.discuss.targetSha);
		expect(fake.stageDirs.length).toBeGreaterThan(0);
		expect(fake.stageDirs.every((dir) => dir === worktree?.path)).toBe(true);
		expect(fake.branchExpectations).toEqual([null]);
		expect(fake.installed).toEqual([worktree?.path ?? ""]);
		expect(fake.removed).toEqual([worktree?.path ?? ""]);
		expect(fake.judged[0]?.priorArtifacts).toEqual([
			{ path: SPEC_PATH, content: SPEC_CONTENT },
		]);
		expect(fake.judged[0]?.commitSubjects).toEqual(["replayed commit"]);
		expect(outcome.record.consumed).toEqual({
			stage: "discuss",
			lineage: run.discuss.lineage,
			targetSha: "task-sha",
		});
		expect(outcome.record.lineage).toBe(
			lineageKey({
				upstream: run.discuss.lineage,
				corpusFiles: [
					{
						path: "skills/build/SKILL.md",
						sha256: createHash("sha256").update("build").digest("hex"),
					},
				],
				model: "sonnet",
			}),
		);
		expect(outcome.record.stageCostUsd).toBe(1.25);
		expect(outcome.record.judgeCostUsd).toBe(0.5);
		expect(outcome.record.resultSha).toBe("result-sha");
		expect(outcome.record.scorecard.input.commitSubjects).toEqual([
			"replayed commit",
		]);
		expect(outcome.recordPath.startsWith(run.paths.replaysDirectory)).toBe(
			true,
		);
		expect(outcome.recordPath).toContain(run.discuss.lineage);
	});

	it("writes a record that validates against the replay schema", async () => {
		const run = await recordedRun();
		const fake = fakeReplayDependencies();

		const outcome = await runReplay(fake.dependencies, request(run, "build"));

		const record = await readReplayRecord(outcome.recordPath);
		expect(record.replay).toBe(true);
		expect(record.consumed.lineage).toBe(run.discuss.lineage);
		expect(record.corpusFiles.length).toBeGreaterThan(0);
		expect(record.scorecard.grade.verdict).toBe("CONTINUE");
	});

	it("retains the stage scorecard's Judge attempts", async () => {
		const run = await recordedRun();
		const fake = fakeReplayDependencies();
		const attempts: readonly JudgeAttempt[] = [
			{
				payload: { summary: "accepted replay" },
				costUsd: 0.5,
				outcome: "ACCEPTED",
			},
		];
		const recording = {
			...fake.dependencies,
			runStageJudge: (
				_model: string | undefined,
				_effort: undefined | "low" | "medium" | "high" | "xhigh" | "max",
				_budget: number,
				input: StageJudgeInput,
			) => Promise.resolve({ ...scorecardFor(input), attempts }),
		};

		const outcome = await runReplay(recording, request(run, "build"));
		const record = await readReplayRecord(outcome.recordPath);

		expect(record.scorecard["attempts"]).toEqual(attempts);
	});

	it("replays the first stage from the initial checkpoint without installing dependencies", async () => {
		const run = await recordedRun();
		const fake = fakeReplayDependencies();

		const outcome = await runReplay(fake.dependencies, request(run, "discuss"));

		expect(outcome.record.consumed.stage).toBe("initial");
		expect(fake.installed).toEqual([]);
		expect(fake.branchExpectations).toEqual([null]);
		expect(fake.judged[0]?.priorArtifacts).toEqual([]);
	});

	it("records a STOP verdict as a result and still removes the worktree", async () => {
		const run = await recordedRun();
		const fake = fakeReplayDependencies();
		const stopping = {
			...fake.dependencies,
			runStageJudge: (
				_model: string | undefined,
				_effort: undefined | "low" | "medium" | "high" | "xhigh" | "max",
				_budget: number,
				input: StageJudgeInput,
			) => Promise.resolve(scorecardFor(input, "STOP")),
		};

		const outcome = await runReplay(stopping, request(run, "build"));

		expect(outcome.record.scorecard.grade.verdict).toBe("STOP");
		expect(fake.removed).toHaveLength(1);
	});

	it("keeps the worktree and prints its path when the replay fails before grading", async () => {
		const run = await recordedRun();
		const fake = fakeReplayDependencies();
		const failing = {
			...fake.dependencies,
			runStageJudge: () => Promise.reject(new Error("judge died")),
		};

		expect(runReplay(failing, request(run, "build"))).rejects.toThrow(
			"judge died",
		);

		expect(fake.removed).toEqual([]);
		const preserved = fake.log.find((line) =>
			line.includes("evidence preserved at"),
		);
		expect(preserved).toContain(fake.worktrees[0]?.path ?? "missing");
	});

	it("fails loudly when the run predates initial checkpoints", async () => {
		const run = await recordedRun();
		await rm(run.paths.checkpointDirectory("initial"), {
			force: true,
			recursive: true,
		});
		const fake = fakeReplayDependencies();

		expect(
			runReplay(fake.dependencies, request(run, "discuss")),
		).rejects.toThrow(/no initial checkpoint/u);
		expect(fake.worktrees).toEqual([]);
	});

	it("records the replay fresh when the corpus still matches the chain", async () => {
		const run = await recordedRun([
			{
				path: "skills/discuss/SKILL.md",
				sha256: createHash("sha256").update("discuss").digest("hex"),
			},
		]);
		const fake = fakeReplayDependencies();

		const outcome = await runReplay(fake.dependencies, request(run, "build"));

		expect(outcome.record.stale).toBe(false);
		expect(outcome.record.staleness).toEqual([]);
	});

	it("prints when the checkpoint chain is fresh", async () => {
		const run = await recordedRun([
			{
				path: "skills/discuss/SKILL.md",
				sha256: createHash("sha256").update("discuss").digest("hex"),
			},
		]);
		const fake = fakeReplayDependencies();

		await runReplay(fake.dependencies, request(run, "build"));

		expect(
			fake.log.filter((line) => line === "Checkpoint chain is fresh"),
		).toEqual(["Checkpoint chain is fresh"]);
	});

	it("derives staleness from the request's instructions and the worktree's skills", async () => {
		const run = await recordedRun([
			{
				path: "skills/discuss/SKILL.md",
				sha256: createHash("sha256").update("discuss").digest("hex"),
			},
		]);
		const fake = fakeReplayDependencies();

		await runReplay(fake.dependencies, request(run, "build"));

		const worktree = fake.worktrees[0]?.path ?? "missing";
		const upstream = fake.corpusCaptures.find(
			({ skill }) => skill === "discuss",
		);
		expect(upstream?.instructions).toBe("Current instructions");
		expect(upstream?.roots).toEqual(skillSearchRoots(worktree));
	});

	it("records the replay stale and names the changed upstream file", async () => {
		const run = await recordedRun([
			{ path: "skills/discuss/SKILL.md", sha256: "aa".repeat(32) },
		]);
		const fake = fakeReplayDependencies();

		const outcome = await runReplay(fake.dependencies, request(run, "build"));

		expect(outcome.record.stale).toBe(true);
		expect(outcome.record.staleness).toEqual([
			{ stage: "discuss", causes: ["skills/discuss/SKILL.md changed"] },
		]);
	});

	it("prints every stale checkpoint when the chain is stale", async () => {
		const run = await recordedRun([
			{ path: "skills/discuss/SKILL.md", sha256: "aa".repeat(32) },
		]);
		const fake = fakeReplayDependencies();

		await runReplay(fake.dependencies, request(run, "review"));

		expect(
			fake.log.filter(
				(line) =>
					line === "Checkpoint chain is fresh" ||
					line.startsWith("Stale checkpoint "),
			),
		).toEqual([
			"Stale checkpoint discuss: skills/discuss/SKILL.md changed",
			"Stale checkpoint build: upstream stage discuss is stale",
		]);
	});

	it("labels the replay stale when the model differs from the recorded run", async () => {
		const run = await recordedRun();
		const fake = fakeReplayDependencies();

		const outcome = await runReplay(fake.dependencies, {
			...request(run, "build"),
			model: "opus",
		});

		expect(outcome.record.stale).toBe(true);
		expect(outcome.record.staleness?.[0]?.causes).toContain(
			"model sonnet is now opus",
		);
	});

	it("leaves the replay fresh when only the replayed stage's own skill changed", async () => {
		const run = await recordedRun([
			{
				path: "skills/discuss/SKILL.md",
				sha256: createHash("sha256").update("discuss").digest("hex"),
			},
		]);
		const fake = fakeReplayDependencies();

		const outcome = await runReplay(fake.dependencies, request(run, "discuss"));

		expect(outcome.record.stale).toBe(false);
	});

	it("writes a stale record that still validates against the replay schema", async () => {
		const run = await recordedRun([
			{ path: "skills/discuss/SKILL.md", sha256: "aa".repeat(32) },
		]);
		const fake = fakeReplayDependencies();

		const outcome = await runReplay(fake.dependencies, request(run, "build"));

		const record = await readReplayRecord(outcome.recordPath);
		expect(record.stale).toBe(true);
		expect(record.staleness?.[0]?.stage).toBe("discuss");
	});

	it("replays end to end against a real repository, leaving the primary untouched", async () => {
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-real-replay-"));
		testResources.track(parent);
		const primary = join(parent, "primary");
		await mkdir(primary);
		await runCommand(["git", "init", "-b", "main"], primary);
		await runCommand(["git", "config", "user.name", "Benchmark Test"], primary);
		await runCommand(
			["git", "config", "user.email", "benchmark@example.com"],
			primary,
		);
		await Bun.write(
			join(primary, ".gitignore"),
			"backlog/\n.boris/\nnode_modules/\n",
		);
		await Bun.write(join(primary, "base.txt"), "base\n");
		await commitAll(primary, "chore: base");
		const taskSha = await installInstructions(
			primary,
			"Original instructions\n",
		);
		await mkdir(join(primary, "backlog", "docs"), { recursive: true });
		await Bun.write(join(primary, "backlog", "config.yml"), "statuses: []\n");
		const paths = benchmarkRunPaths(parent, "run");
		await recordCheckpoint(
			primary,
			paths.checkpointDirectory("initial"),
			initialCheckpointInputs(
				{
					taskSha,
					task: "Task text",
					productBrief: "Brief text",
					workflowFiles: await hashWorkflowState(primary),
				},
				"sonnet",
			),
		);
		const manifest: RunManifest = {
			timestamp: "2026-08-30T00:00:00.000Z",
			controlSha: "run-control-sha",
			sourceRoot: primary,
			sourceSha: taskSha,
			taskId: "TASK-1",
			taskSha,
			task: "Task text",
			productBrief: "Brief text",
			model: "sonnet",
			judgeModel: "sonnet",
			sessionBudgetUsd: 5,
			pipelinePath: "pipelines/default.json",
			pipeline: {
				statuses: ["To Do", "Done"],
				stages: [
					{
						name: "discuss",
						kind: "planning",
						skill: "discuss",
						artifact: "spec",
						rubric: "rubrics/shape.json",
						requiresAcceptanceCriteria: false,
					},
					{
						name: "build",
						kind: "delivery",
						skill: "build",
						rubric: "rubrics/build.json",
					},
				],
			},
		};
		await writeRunManifest(paths.manifestFile, manifest);
		const before = {
			head: await runCommand(["git", "rev-parse", "HEAD"], primary),
			branch: await runCommand(["git", "branch", "--show-current"], primary),
			status: await runCommand(["git", "status", "--porcelain"], primary),
		};

		const judged: StageJudgeInput[] = [];
		const outcome = await runReplay(
			{
				stageSession: {
					runWorkflowStage: async ({ targetDir, stage }) => {
						await Bun.write(
							join(targetDir, "backlog", "docs", "DOC-1 - replay-spec.md"),
							"replayed spec\n",
						);

						return {
							stage,
							sessionId: "session",
							costUsd: 0.9,
							exchanges: [],
						};
					},
					readTaskOutput: () =>
						Promise.resolve(
							JSON.stringify({
								task: {
									acceptanceCriteria: ["done"],
									documentation: ["DOC-1 - replay-spec.md"],
								},
							}),
						),
					readTaskCard: () => Promise.resolve("the replayed task card"),
					captureBuildCandidate: () =>
						Promise.reject(new Error("not a delivery stage")),
					assertPlanningStageCompleted,
					assertBuildCommitted: () =>
						Promise.reject(new Error("not a delivery stage")),
					changedPathsBetween: () => Promise.resolve([]),
					captureCheckIntegrity: () =>
						Promise.resolve(harnessResult("PASS", "checks match")),
					captureTreatmentChecks: () =>
						Promise.resolve(harnessResult("PASS", "all green")),
					captureStageCorpus: (skill) =>
						Promise.resolve([
							{
								path: `skills/${skill}/SKILL.md`,
								sha256: createHash("sha256").update(skill).digest("hex"),
							},
						]),
				},
				runStageJudge: async (_model, _effort, _budget, input) => {
					judged.push(input);

					const loaded = await loadStageRubric(
						manifest.pipeline.stages[0] ?? {
							name: "discuss",
							kind: "planning",
							skill: "discuss",
							artifact: "spec",
							rubric: "rubrics/shape.json",
							requiresAcceptanceCriteria: false,
						},
					);

					return {
						stage: input.stage,
						rubricPath: "rubrics/discuss.json",
						rubric: loaded.rubric,
						input,
						prompt: "prompt",
						attempts: [],
						costUsd: 0.4,
						grade: {
							hardBlockers: [],
							requirements: [],
							dimensions: [],
							summary: "graded",
							grade: "A",
							verdict: "CONTINUE",
						},
					};
				},
				loadStageRubric,
				addWorktree,
				removeWorktree,
				materializeCheckpoint,
				captureBaselineContext,
				captureFileHashes,
				installInstructions,
				installDependencies: () =>
					Promise.reject(new Error("not a delivery stage")),
				log: () => undefined,
			},
			{
				paths,
				stage: "discuss",
				instructions: "Replayed instructions\n",
				controlSha: "control-sha",
				model: "sonnet",
				judgeModel: "opus",
				sessionBudgetUsd: 5,
			},
		);

		const after = {
			head: await runCommand(["git", "rev-parse", "HEAD"], primary),
			branch: await runCommand(["git", "branch", "--show-current"], primary),
			status: await runCommand(["git", "status", "--porcelain"], primary),
		};
		expect(after).toEqual(before);
		const worktrees = await runCommand(
			["git", "worktree", "list", "--porcelain"],
			primary,
		);
		expect(
			worktrees.split("\n").filter((line) => line.startsWith("worktree ")),
		).toHaveLength(1);
		const record = await readReplayRecord(outcome.recordPath);
		expect(record.consumed.stage).toBe("initial");
		expect(record.baseSha).not.toBe(taskSha);
		expect(judged[0]?.artifact?.content).toBe("replayed spec\n");
		expect(
			await presentAttempts(
				record.consumed.lineage,
				await loadAttempts(
					benchmarkRunPaths(parent, "run"),
					"discuss",
					record.consumed.lineage,
				),
			),
		).toContain("replay ");
	});

	it("runs three frozen stage replay reps concurrently without changing the primary checkout", async () => {
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-confirmed-replay-"));
		testResources.track(parent);
		const primary = join(parent, "primary");
		await mkdir(primary);
		await runCommand(["git", "init", "-b", "main"], primary);
		await runCommand(["git", "config", "user.name", "Benchmark Test"], primary);
		await runCommand(
			["git", "config", "user.email", "benchmark@example.com"],
			primary,
		);
		await Bun.write(
			join(primary, ".gitignore"),
			"backlog/\n.boris/\n.claude/\nnode_modules/\n",
		);
		await Bun.write(join(primary, "base.txt"), "base\n");
		await commitAll(primary, "chore: base");
		const taskSha = await installInstructions(
			primary,
			"Original instructions\n",
		);
		await mkdir(join(primary, "backlog"), { recursive: true });
		await Bun.write(join(primary, "backlog", "config.yml"), "statuses: []\n");
		const paths = benchmarkRunPaths(parent, "run");
		const initial = await recordCheckpoint(
			primary,
			paths.checkpointDirectory("initial"),
			initialCheckpointInputs(
				{
					taskSha,
					task: "Task text",
					productBrief: "Brief text",
					workflowFiles: await hashWorkflowState(primary),
				},
				"sonnet",
				"high",
			),
		);
		const manifest: RunManifest = {
			timestamp: "2026-08-31T00:00:00.000Z",
			controlSha: "run-control-sha",
			sourceRoot: primary,
			sourceSha: taskSha,
			taskId: "TASK-1",
			taskSha,
			task: "Task text",
			productBrief: "Brief text",
			model: "sonnet",
			effort: "high",
			judgeModel: "opus",
			judgeEffort: "high",
			sessionBudgetUsd: 5,
			pipelinePath: "pipelines/default.json",
			pipeline: {
				statuses: ["To Do", "Done"],
				stages: [
					{
						name: "discuss",
						kind: "planning",
						skill: "discuss",
						artifact: "spec",
						rubric: "rubrics/discuss.json",
						requiresAcceptanceCriteria: false,
					},
				],
			},
		};
		await writeRunManifest(paths.manifestFile, manifest);
		const corpusRoot = join(parent, "corpus");
		await mkdir(join(corpusRoot, "discuss"), { recursive: true });
		await mkdir(join(corpusRoot, "doctrine"), { recursive: true });
		await Bun.write(
			join(corpusRoot, "discuss", "SKILL.md"),
			"frozen discuss\n",
		);
		await Bun.write(
			join(corpusRoot, "doctrine", "SKILL.md"),
			"frozen doctrine\n",
		);
		const instructions = "Frozen instructions\n";
		const rubric = {
			rubricPath: "rubrics/discuss.json",
			content: '{"frozen":true}\n',
			rubric: {
				hardBlockers: [],
				requirements: [{ id: "scope", description: "Scope is explicit" }],
				dimensions: [
					{ id: "clarity", description: "Clear", good: "g", excellent: "e" },
				],
			},
		} satisfies Awaited<ReturnType<typeof loadStageRubric>>;
		const metric: ClaudeCallMetrics = {
			costUsd: 0.25,
			inputTokens: 100,
			outputTokens: 20,
			cacheReadTokens: 30,
			cacheWriteTokens: 40,
			turns: 2,
		};
		const allStarted = Promise.withResolvers<boolean>();
		const release = Promise.withResolvers<boolean>();
		const consumedInputs: {
			readonly targetDir: string;
			readonly branch: string;
			readonly instructions: string;
			readonly skill: string;
			readonly checkpoint: string;
			rubric: string;
			readonly model: string;
			readonly effort: string | undefined;
			readonly budget: number;
		}[] = [];
		const primaryBefore = {
			head: await runCommand(["git", "rev-parse", "HEAD"], primary),
			branch: await runCommand(["git", "branch", "--show-current"], primary),
			status: await runCommand(["git", "status", "--porcelain"], primary),
			base: await Bun.file(join(primary, "base.txt")).bytes(),
			instructions: await Bun.file(join(primary, "CLAUDE.md")).bytes(),
		};

		const execution = runReplayConfirmation(
			{
				stageSession: {
					runWorkflowStage: async (workflowRequest) => {
						const ordinal = consumedInputs.push({
							targetDir: workflowRequest.targetDir,
							branch: await runCommand(
								["git", "branch", "--show-current"],
								workflowRequest.targetDir,
							),
							instructions: await Bun.file(
								join(workflowRequest.targetDir, "CLAUDE.md"),
							).text(),
							skill: await Bun.file(
								join(
									workflowRequest.targetDir,
									".claude",
									"skills",
									"discuss",
									"SKILL.md",
								),
							).text(),
							checkpoint: await Bun.file(
								join(workflowRequest.targetDir, "backlog", "config.yml"),
							).text(),
							rubric: "",
							model: workflowRequest.model,
							effort: workflowRequest.effort,
							budget: workflowRequest.sessionBudgetUsd,
						});
						if (consumedInputs.length === 3) {
							allStarted.resolve(true);
						}
						await release.promise;
						await mkdir(join(workflowRequest.targetDir, "backlog", "docs"), {
							recursive: true,
						});
						await Bun.write(
							join(
								workflowRequest.targetDir,
								"backlog",
								"docs",
								"DOC-1 - spec.md",
							),
							"confirmed spec\n",
						);

						return {
							stage: workflowRequest.stage,
							sessionId: `session-${ordinal}`,
							costUsd: metric.costUsd,
							callMetrics: [metric],
							exchanges: [],
						};
					},
					readTaskOutput: () =>
						Promise.resolve(
							JSON.stringify({
								task: {
									acceptanceCriteria: ["done"],
									documentation: ["DOC-1 - spec.md"],
								},
							}),
						),
					readTaskCard: () => Promise.resolve("confirmed task card"),
					captureBuildCandidate: () =>
						Promise.reject(new Error("not a delivery stage")),
					assertPlanningStageCompleted: async (
						targetDir,
						baselineSha,
						stage,
					) => ({
						taskState: `${stage.name}-state`,
						artifact: {
							path: "backlog/docs/DOC-1 - spec.md",
							content: await Bun.file(
								join(targetDir, "backlog", "docs", "DOC-1 - spec.md"),
							).text(),
						},
						resultSha: baselineSha,
						diff: "",
						changedPaths: [],
					}),
					assertBuildCommitted: () =>
						Promise.reject(new Error("not a delivery stage")),
					changedPathsBetween: () => Promise.resolve([]),
					captureCheckIntegrity: () =>
						Promise.resolve(harnessResult("PASS", "checks match")),
					captureTreatmentChecks: () =>
						Promise.resolve(harnessResult("PASS", "all green")),
					captureStageCorpus,
				},
				runStageJudge: (_model, _effort, _budget, input, source) => {
					const target =
						consumedInputs[
							Number(input.transcript.sessionId.replace("session-", "")) - 1
						];
					if (target !== undefined) {
						target.rubric = source.content;
					}

					return Promise.resolve({
						...scorecardFor(input),
						rubricPath: source.rubricPath,
						rubric: source.rubric,
						attempts: [
							{
								payload: { summary: "accepted" },
								costUsd: metric.costUsd,
								metrics: metric,
								outcome: "ACCEPTED",
							},
						],
					});
				},
				loadStageRubric: () => Promise.resolve(rubric),
				addWorktree,
				removeWorktree,
				materializeCheckpoint,
				captureBaselineContext,
				captureFileHashes,
				installInstructions,
				installDependencies: () =>
					Promise.reject(new Error("not a delivery stage")),
				log: () => undefined,
			},
			{
				paths,
				stage: "discuss",
				instructions,
				controlSha: "control-sha",
				model: "sonnet",
				effort: "high",
				judgeModel: "opus",
				judgeEffort: "high",
				sessionBudgetUsd: 5,
				groupId: "confirmation-stage-1",
				reps: 3,
				corpusRoots: [corpusRoot],
				projectedCost: {
					reps: 3,
					perRepMaximumUsd: 20,
					totalMaximumUsd: 60,
				},
				approvalMethod: "yes",
			},
		);

		await allStarted.promise;
		expect(consumedInputs).toHaveLength(3);
		expect(new Set(consumedInputs.map(({ targetDir }) => targetDir)).size).toBe(
			3,
		);
		expect(consumedInputs.every(({ branch }) => branch === "")).toBe(true);
		release.resolve(true);
		const outcome = await execution;

		const records = await Promise.all(
			outcome.repRecordFiles.map(async (recordFile) =>
				parseConfirmationRepRecord(await Bun.file(recordFile).text()),
			),
		);
		expect(records.map(({ repId }) => repId)).toEqual([
			"confirmation-stage-1-rep-1",
			"confirmation-stage-1-rep-2",
			"confirmation-stage-1-rep-3",
		]);
		expect(new Set(outcome.repRecordFiles).size).toBe(3);
		expect(
			records.every(({ outcome: result }) => result === "SUCCESSFUL"),
		).toBe(true);
		expect(
			consumedInputs.map(({ targetDir: _targetDir, ...input }) => input),
		).toEqual(
			Array.from({ length: 3 }, () => ({
				branch: "",
				instructions,
				skill: "frozen discuss\n",
				checkpoint: "statuses: []\n",
				rubric: rubric.content,
				model: "sonnet",
				effort: "high",
				budget: 5,
			})),
		);
		const group = parseConfirmationGroupRecord(
			await Bun.file(outcome.groupRecordFile).text(),
		);
		expect(group.inputs.lineage).toEqual({
			kind: "CHECKPOINT",
			lineage: initial.lineage,
			targetSha: taskSha,
		});
		expect(group.inputs.pipelinePath).toBe("pipelines/default.json");
		expect(group.inputs.sessionBudgetUsd).toBe(5);
		expect(new Set(group.inputs.files.map(({ kind }) => kind))).toEqual(
			new Set([
				"checkpoint",
				"corpus",
				"rubric",
				"pipeline",
				"instructions",
				"task",
				"product-brief",
			]),
		);
		const primaryAfter = {
			head: await runCommand(["git", "rev-parse", "HEAD"], primary),
			branch: await runCommand(["git", "branch", "--show-current"], primary),
			status: await runCommand(["git", "status", "--porcelain"], primary),
			base: await Bun.file(join(primary, "base.txt")).bytes(),
			instructions: await Bun.file(join(primary, "CLAUDE.md")).bytes(),
		};
		expect(primaryAfter).toEqual(primaryBefore);
		const worktrees = await runCommand(
			["git", "worktree", "list", "--porcelain"],
			primary,
		);
		expect(
			worktrees.split("\n").filter((line) => line.startsWith("worktree ")),
		).toHaveLength(1);
	});

	it("removes the temporary root after every replay rep completes with durable evidence", async () => {
		const source = await testResources.createRepository();
		await Bun.write(
			join(source.directory, ".gitignore"),
			"backlog/\n.boris/\n.claude/\nnode_modules/\n",
		);
		await commitAll(source.directory, "chore: ignore workflow state");
		const taskSha = await installInstructions(
			source.directory,
			"Original instructions\n",
		);
		await mkdir(join(source.directory, "backlog"), { recursive: true });
		await Bun.write(
			join(source.directory, "backlog", "config.yml"),
			"statuses: []\n",
		);
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-replay-cleanup-"));
		testResources.track(parent);
		const paths = benchmarkRunPaths(parent, "run");
		await recordCheckpoint(
			source.directory,
			paths.checkpointDirectory("initial"),
			initialCheckpointInputs(
				{
					taskSha,
					task: "Task text",
					productBrief: "Brief text",
					workflowFiles: await hashWorkflowState(source.directory),
				},
				"sonnet",
			),
		);
		await writeRunManifest(paths.manifestFile, {
			timestamp: "2026-08-31T00:00:00.000Z",
			controlSha: "run-control-sha",
			sourceRoot: source.directory,
			sourceSha: taskSha,
			taskId: "TASK-1",
			taskSha,
			task: "Task text",
			productBrief: "Brief text",
			model: "sonnet",
			judgeModel: "opus",
			sessionBudgetUsd: 5,
			pipelinePath: "pipelines/default.json",
			pipeline: {
				statuses: ["To Do", "Done"],
				stages: [
					{
						name: "discuss",
						kind: "planning",
						skill: "discuss",
						artifact: "spec",
						rubric: "rubrics/discuss.json",
						requiresAcceptanceCriteria: false,
					},
				],
			},
		});
		const corpusRoot = join(parent, "corpus");
		await mkdir(join(corpusRoot, "discuss"), { recursive: true });
		await mkdir(join(corpusRoot, "doctrine"), { recursive: true });
		await Bun.write(
			join(corpusRoot, "discuss", "SKILL.md"),
			"frozen discuss\n",
		);
		await Bun.write(
			join(corpusRoot, "doctrine", "SKILL.md"),
			"frozen doctrine\n",
		);
		const metric: ClaudeCallMetrics = {
			costUsd: 0.25,
			inputTokens: 100,
			outputTokens: 20,
			cacheReadTokens: 30,
			cacheWriteTokens: 40,
			turns: 2,
		};
		const removed: string[] = [];
		const fake = fakeReplayDependencies();

		const outcome = await runReplayConfirmation(
			{
				...fake.dependencies,
				stageSession: {
					...fake.dependencies.stageSession,
					runWorkflowStage: (workflowRequest) =>
						Promise.resolve({
							stage: workflowRequest.stage,
							sessionId: workflowRequest.targetDir,
							costUsd: metric.costUsd,
							callMetrics: [metric],
							exchanges: [],
						}),
					assertPlanningStageCompleted: (_targetDir, baselineSha, stage) =>
						Promise.resolve({
							taskState: `${stage.name}-state`,
							artifact: {
								path: "backlog/docs/DOC-1 - spec.md",
								content: "confirmed spec\n",
							},
							resultSha: baselineSha,
							diff: "",
							changedPaths: [],
						}),
					captureStageCorpus,
				},
				runStageJudge: (_model, _effort, _budget, input) => {
					const attempt: JudgeAttempt = {
						payload: { summary: "completed" },
						costUsd: metric.costUsd,
						metrics: metric,
						outcome: "ACCEPTED",
					};
					if (input.transcript.sessionId.endsWith("-rep-2")) {
						throw new JudgeOutputValidationError({
							message: "Judge rejected both attempts",
							prompt: "prompt",
							attempts: [
								{ ...attempt, outcome: "REJECTED", error: "invalid output" },
							],
							costUsd: metric.costUsd,
						});
					}

					return Promise.resolve({
						...scorecardFor(input, "STOP"),
						attempts: [attempt],
					});
				},
				loadStageRubric: () =>
					Promise.resolve({
						rubricPath: "rubrics/discuss.json",
						content: "{}\n",
						rubric: {
							hardBlockers: [],
							requirements: [],
							dimensions: [],
						},
					}),
				addWorktree,
				removeWorktree: async (targetDir, worktreeDir) => {
					removed.push(worktreeDir);
					await removeWorktree(targetDir, worktreeDir);
				},
				materializeCheckpoint,
				captureBaselineContext,
				captureFileHashes,
				installInstructions,
			},
			{
				paths,
				stage: "discuss",
				instructions: "Frozen instructions\n",
				controlSha: "control-sha",
				model: "sonnet",
				judgeModel: "opus",
				sessionBudgetUsd: 5,
				groupId: "confirmation-cleanup",
				reps: 2,
				corpusRoots: [corpusRoot],
				projectedCost: {
					reps: 2,
					perRepMaximumUsd: 20,
					totalMaximumUsd: 40,
				},
				approvalMethod: "yes",
			},
		);
		const records = await Promise.all(
			outcome.repRecordFiles.map(async (path) =>
				parseConfirmationRepRecord(await Bun.file(path).text()),
			),
		);
		const temporaryRoot = dirname(records[0]?.worktreePath ?? "missing");

		expect(records.map(({ stages }) => stages[0]?.status)).toEqual([
			"JUDGED",
			"EXECUTION_FAILED",
		]);
		expect(
			removed.toSorted((left, right) => left.localeCompare(right)),
		).toEqual(
			records
				.map(({ worktreePath }) => worktreePath)
				.toSorted((left, right) => left.localeCompare(right)),
		);
		expect(
			await Promise.all(
				records.map((record) => {
					const [stage] = record.stages;
					if (
						stage?.status === "NOT_REACHED" ||
						stage?.evidence === undefined
					) {
						throw new Error("Expected durable stage evidence");
					}

					return runCommand(
						[
							"git",
							"rev-parse",
							`refs/rehearsal/confirmation-cleanup/${record.repId}`,
						],
						source.directory,
					);
				}),
			),
		).toEqual(
			records.map((record) => {
				const [stage] = record.stages;
				if (stage?.status === "NOT_REACHED" || stage?.evidence === undefined) {
					throw new Error("Expected durable stage evidence");
				}

				return `${stage.evidence.resultSha}\n`;
			}),
		);
		const evidenceReferences = records.map(
			({ stages }) =>
				z
					.object({ evidence: z.object({ recordFile: z.string() }) })
					.parse(stages[0]).evidence,
		);
		const judgeEvidence = await Promise.all(
			evidenceReferences.map(async ({ recordFile }, index) =>
				z
					.unknown()
					.parse(
						JSON.parse(
							await Bun.file(
								join(
									dirname(outcome.repRecordFiles[index] ?? "missing"),
									recordFile,
								),
							).text(),
						),
					),
			),
		);

		expect(judgeEvidence).toMatchObject([
			{ grade: { verdict: "STOP" } },
			{ status: "REJECTED", attempts: [{ outcome: "REJECTED" }] },
		]);
		expect(
			await stat(temporaryRoot).then(
				() => true,
				() => false,
			),
		).toBe(false);
	});

	it("cleans completed Judge outcomes while preserving a pre-evidence failure", async () => {
		const source = await testResources.createRepository();
		await Bun.write(
			join(source.directory, ".gitignore"),
			"backlog/\n.boris/\n.claude/\nnode_modules/\n",
		);
		await commitAll(source.directory, "chore: ignore workflow state");
		const taskSha = await installInstructions(
			source.directory,
			"Original instructions\n",
		);
		await mkdir(join(source.directory, "backlog"), { recursive: true });
		await Bun.write(
			join(source.directory, "backlog", "config.yml"),
			"statuses: []\n",
		);
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-replay-failures-"));
		testResources.track(parent);
		const paths = benchmarkRunPaths(parent, "run");
		await recordCheckpoint(
			source.directory,
			paths.checkpointDirectory("initial"),
			initialCheckpointInputs(
				{
					taskSha,
					task: "Task text",
					productBrief: "Brief text",
					workflowFiles: await hashWorkflowState(source.directory),
				},
				"sonnet",
			),
		);
		await writeRunManifest(paths.manifestFile, {
			timestamp: "2026-08-31T00:00:00.000Z",
			controlSha: "run-control-sha",
			sourceRoot: source.directory,
			sourceSha: taskSha,
			taskId: "TASK-1",
			taskSha,
			task: "Task text",
			productBrief: "Brief text",
			model: "sonnet",
			judgeModel: "opus",
			sessionBudgetUsd: 5,
			pipelinePath: "pipelines/default.json",
			pipeline: {
				statuses: ["To Do", "Done"],
				stages: [
					{
						name: "discuss",
						kind: "planning",
						skill: "discuss",
						artifact: "spec",
						rubric: "rubrics/discuss.json",
						requiresAcceptanceCriteria: false,
					},
				],
			},
		});
		const corpusRoot = join(parent, "corpus");
		await mkdir(join(corpusRoot, "discuss"), { recursive: true });
		await mkdir(join(corpusRoot, "doctrine"), { recursive: true });
		await Bun.write(
			join(corpusRoot, "discuss", "SKILL.md"),
			"frozen discuss\n",
		);
		await Bun.write(
			join(corpusRoot, "doctrine", "SKILL.md"),
			"frozen doctrine\n",
		);
		const metric: ClaudeCallMetrics = {
			costUsd: 0.25,
			inputTokens: 100,
			outputTokens: 20,
			cacheReadTokens: 30,
			cacheWriteTokens: 40,
			turns: 2,
		};
		const failed = Promise.withResolvers<boolean>();
		const finished: number[] = [];
		const removed: string[] = [];
		const fake = fakeReplayDependencies();
		const execution = runReplayConfirmation(
			{
				...fake.dependencies,
				stageSession: {
					...fake.dependencies.stageSession,
					runWorkflowStage: async (workflowRequest) => {
						const match = /-rep-(?<ordinal>\d+)$/u.exec(
							workflowRequest.targetDir,
						);
						const ordinal = Number(match?.groups?.["ordinal"]);
						if (ordinal === 2) {
							failed.resolve(true);

							throw new Error("worker failed before evidence");
						}

						await failed.promise;
						finished.push(ordinal);

						return {
							stage: workflowRequest.stage,
							sessionId: workflowRequest.targetDir,
							costUsd: metric.costUsd,
							callMetrics: [metric],
							exchanges: [],
						};
					},
					assertPlanningStageCompleted: (_targetDir, baselineSha, stage) =>
						Promise.resolve({
							taskState: `${stage.name}-state`,
							artifact: {
								path: "backlog/docs/DOC-1 - spec.md",
								content: "confirmed spec\n",
							},
							resultSha: baselineSha,
							diff: "",
							changedPaths: [],
						}),
					captureStageCorpus,
				},
				runStageJudge: (_model, _effort, _budget, input) => {
					if (input.transcript.sessionId.endsWith("-rep-3")) {
						throw new JudgeOutputValidationError({
							message: "Judge rejected both attempts",
							prompt: "prompt",
							attempts: [
								{
									payload: { invalid: true },
									costUsd: metric.costUsd,
									metrics: metric,
									outcome: "REJECTED",
									error: "invalid output",
								},
							],
							costUsd: metric.costUsd,
						});
					}

					return Promise.resolve({
						...scorecardFor(input, "STOP"),
						attempts: [
							{
								payload: { summary: "stop" },
								costUsd: metric.costUsd,
								metrics: metric,
								outcome: "ACCEPTED",
							},
						],
					});
				},
				loadStageRubric: () =>
					Promise.resolve({
						rubricPath: "rubrics/discuss.json",
						content: "{}\n",
						rubric: {
							hardBlockers: [],
							requirements: [],
							dimensions: [],
						},
					}),
				addWorktree,
				removeWorktree: async (targetDir, worktreeDir) => {
					removed.push(worktreeDir);
					await removeWorktree(targetDir, worktreeDir);
				},
				materializeCheckpoint,
				captureBaselineContext,
				captureFileHashes,
				installInstructions,
			},
			{
				paths,
				stage: "discuss",
				instructions: "Frozen instructions\n",
				controlSha: "control-sha",
				model: "sonnet",
				judgeModel: "opus",
				sessionBudgetUsd: 5,
				groupId: "confirmation-failures",
				reps: 3,
				corpusRoots: [corpusRoot],
				projectedCost: {
					reps: 3,
					perRepMaximumUsd: 20,
					totalMaximumUsd: 60,
				},
				approvalMethod: "yes",
			},
		);

		const outcome = await execution;
		const records = await Promise.all(
			outcome.repRecordFiles.map(async (path) =>
				parseConfirmationRepRecord(await Bun.file(path).text()),
			),
		);
		expect(finished.toSorted((left, right) => left - right)).toEqual([1, 3]);
		expect(records.map(({ stages }) => stages[0]?.status)).toEqual([
			"JUDGED",
			"EXECUTION_FAILED",
			"EXECUTION_FAILED",
		]);
		expect(
			removed.toSorted((left, right) => left.localeCompare(right)),
		).toEqual(
			records
				.filter(({ ordinal }) => ordinal !== 2)
				.map(({ worktreePath }) => worktreePath)
				.toSorted((left, right) => left.localeCompare(right)),
		);
		const preservedPath = records[1]?.worktreePath ?? "missing";
		expect(fake.log).toContain(
			`Replay rep confirmation-failures-rep-2 failed; evidence preserved at ${preservedPath}`,
		);
		const preserved = await stat(preservedPath);
		expect(preserved.isDirectory()).toBe(true);
		const worktrees = await runCommand(
			["git", "worktree", "list", "--porcelain"],
			source.directory,
		);
		expect(
			worktrees.split("\n").filter((line) => line.startsWith("worktree ")),
		).toHaveLength(2);
		await removeWorktree(source.directory, preservedPath);
	});
});
