import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import {
	parseConfirmationGroupRecord,
	parseConfirmationRepRecord,
} from "./confirmation-record";
import { installInstructions } from "./backlog";
import {
	captureStageCorpus,
	materializeCheckpoint,
	recordCheckpoint,
} from "./checkpoint";
import { captureBaselineContext, captureFileHashes } from "./checks";
import { runCommand } from "./command";
import type {
	ClaudeCallMetrics,
	JudgeGrade,
	LocalCheckResult,
	StageJudgeInput,
	StageRubric,
	StageScorecard,
} from "./contracts";
import { JudgeOutputValidationError } from "./judge-attempt";
import type { PipelineDefinition } from "./pipeline";
import { runPipelineConfirmation } from "./pipeline-confirmation";
import {
	addWorktree,
	assertBuildCommitted,
	captureBuildCandidate,
	changedPathsBetween,
	removeWorktree,
} from "./target";
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

const RUBRIC_IDS = [
	"tests",
	"worker",
	"check-integrity",
	"local-checks",
] as const;

function completeGrade(verdict: "PASS" | "FAIL"): JudgeGrade {
	return {
		requirements: RUBRIC_IDS.map((id) => requirement(id, verdict)),
		verdict,
		summary: "complete",
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

describe(runPipelineConfirmation.name, () => {
	it("runs three frozen full-pipeline reps concurrently without changing the primary checkout", async () => {
		const source = await testResources.createRepository();
		await Bun.write(
			join(source.directory, ".gitignore"),
			"backlog/\n.boris/\n.claude/\nnode_modules/\n",
		);
		await commitAll(source.directory, "chore: ignore workflow state");
		const sourceHead = await runCommand(
			["git", "rev-parse", "HEAD"],
			source.directory,
		);
		const sourceSha = sourceHead.trim();
		const parent = await mkdtemp(
			join(tmpdir(), "rehearsal-pipeline-confirmation-"),
		);
		testResources.track(parent);
		const corpusRoot = join(parent, "corpus");
		for (const skill of ["discuss", "build", "doctrine"]) {
			await mkdir(join(corpusRoot, skill), { recursive: true });
			await Bun.write(join(corpusRoot, skill, "SKILL.md"), `${skill} corpus\n`);
		}
		const pipeline: PipelineDefinition = {
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
			],
		};
		const stageRubric = {
			hardBlockers: [],
			requirements: [{ id: "scope", description: "Scope is explicit" }],
			dimensions: [
				{ id: "clarity", description: "Clear", good: "g", excellent: "e" },
			],
		};
		const metric: ClaudeCallMetrics = {
			costUsd: 0.25,
			inputTokens: 100,
			outputTokens: 20,
			cacheReadTokens: 30,
			cacheWriteTokens: 40,
			turns: 2,
		};
		const passingStageScorecard = (input: StageJudgeInput): StageScorecard => ({
			stage: input.stage,
			rubricPath: "rubrics/stage.json",
			rubric: stageRubric,
			input,
			prompt: "prompt",
			attempts: [
				{
					payload: { summary: "accepted" },
					costUsd: metric.costUsd,
					metrics: metric,
					outcome: "ACCEPTED",
				},
			],
			costUsd: metric.costUsd,
			grade: {
				hardBlockers: [],
				requirements: [],
				dimensions: [],
				summary: "graded",
				grade: "A",
				verdict: "CONTINUE",
			},
		});
		const allStarted = Promise.withResolvers<boolean>();
		const release = Promise.withResolvers<boolean>();
		const events = new Map<number, string[]>();
		const retained = new Map<string, string>();
		const primaryBefore = {
			head: await runCommand(["git", "rev-parse", "HEAD"], source.directory),
			branch: await runCommand(
				["git", "branch", "--show-current"],
				source.directory,
			),
			status: await runCommand(
				["git", "status", "--porcelain"],
				source.directory,
			),
			base: await Bun.file(join(source.directory, "base.txt")).bytes(),
		};

		const execution = runPipelineConfirmation(
			{
				stageSession: {
					runWorkflowStage: async (workflowRequest) => {
						const match = /-rep-(?<ordinal>\d+)$/u.exec(
							workflowRequest.targetDir,
						);
						const ordinal = Number(match?.groups?.["ordinal"]);
						const repEvents = events.get(ordinal) ?? [];
						repEvents.push(workflowRequest.stage);
						events.set(ordinal, repEvents);
						if (workflowRequest.stage === "discuss") {
							if (events.size === 3) {
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
						} else {
							await Bun.write(
								join(workflowRequest.targetDir, "change.txt"),
								`rep ${ordinal}\n`,
							);
							await runCommand(
								["git", "add", "change.txt"],
								workflowRequest.targetDir,
							);
							await runCommand(
								["git", "commit", "-m", "feat: implement change"],
								workflowRequest.targetDir,
							);
						}

						return {
							stage: workflowRequest.stage,
							sessionId: `${ordinal}-${workflowRequest.stage}`,
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
					captureBuildCandidate,
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
					assertBuildCommitted,
					changedPathsBetween,
					captureCheckIntegrity: () =>
						Promise.resolve(harnessResult("PASS", "checks match")),
					captureTreatmentChecks: () =>
						Promise.resolve(harnessResult("PASS", "all green")),
					captureStageCorpus: async (skill, instructions, roots) => {
						await Bun.sleep(500);

						return captureStageCorpus(skill, instructions, roots);
					},
				},
				runStageJudge: (_model, _effort, _budget, input, rubricSource) =>
					Promise.resolve({
						...passingStageScorecard(input),
						rubricPath: rubricSource.rubricPath,
						rubric: rubricSource.rubric,
						attempts: [
							{
								payload: { summary: "accepted" },
								costUsd: metric.costUsd,
								metrics: metric,
								outcome: "ACCEPTED",
							},
						],
					}),
				runFinalJudge: (request) => {
					const { ordinal } = request;
					const repEvents = events.get(ordinal) ?? [];
					repEvents.push("final");
					events.set(ordinal, repEvents);

					if (ordinal === 3) {
						return Promise.reject(
							new JudgeOutputValidationError({
								message: "Final Judge rejected both attempts",
								prompt: "final prompt",
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
							}),
						);
					}

					const acceptedAttempt = {
						payload: { summary: "pass" },
						costUsd: metric.costUsd,
						metrics: metric,
						outcome: "ACCEPTED" as const,
					};

					return Promise.resolve({
						grade: completeGrade("PASS"),
						prompt: "final prompt",
						attempts:
							ordinal === 2
								? [
										{
											payload: { invalid: true },
											costUsd: 0,
											outcome: "REJECTED" as const,
											error: "metrics unavailable",
										},
										acceptedAttempt,
									]
								: [acceptedAttempt],
						costUsd: metric.costUsd,
					});
				},
				createTaskCommit: async (targetDir, _task, instructions) => ({
					taskId: "TASK-1",
					taskSha: await installInstructions(targetDir, instructions),
				}),
				runChecks: () => Promise.resolve(),
				captureBaselineContext,
				captureFileHashes,
				addWorktree,
				removeWorktree,
				materializeCheckpoint,
				recordCheckpoint,
				recordRetentionRef: (_targetDir, runName, targetSha) => {
					retained.set(runName, targetSha);

					return Promise.resolve();
				},
				captureBuildCandidate,
				log: () => undefined,
			},
			{
				runsDirectory: parent,
				groupId: "pipeline-confirmation-1",
				reps: 3,
				projectedCost: {
					reps: 3,
					perRepMaximumUsd: 45,
					totalMaximumUsd: 135,
				},
				approvalMethod: "yes",
				source: { root: source.directory, sha: sourceSha },
				controlSha: "a".repeat(40),
				pipelinePath: "pipelines/test.json",
				pipeline,
				task: "# Task\n\nImplement it.",
				productBrief: "Product brief",
				instructions: "Frozen instructions\n",
				finalRubric: "1. `final`: pass the candidate\n",
				stageRubrics: {
					discuss: {
						rubricPath: "rubrics/discuss.json",
						content: "{}\n",
						rubric: stageRubric,
					},
					build: {
						rubricPath: "rubrics/build.json",
						content: "{}\n",
						rubric: stageRubric,
					},
				},
				corpusRoots: [corpusRoot],
				model: "sonnet",
				effort: "high",
				judgeModel: "opus",
				judgeEffort: "high",
				sessionBudgetUsd: 5,
			},
		);

		await allStarted.promise;
		expect(events.size).toBe(3);
		release.resolve(true);
		const outcome = await execution;
		const records = await Promise.all(
			outcome.repRecordFiles.map(async (path) =>
				parseConfirmationRepRecord(await Bun.file(path).text()),
			),
		);
		expect(records.map(({ outcome: result }) => result)).toEqual([
			"SUCCESSFUL",
			"UNSUCCESSFUL",
			"UNSUCCESSFUL",
		]);
		expect(records[1]?.metrics.status).toBe("MISSING");
		expect(records.every(({ stages }) => stages.length === 2)).toBe(true);
		expect(
			records.every(({ stages }) => {
				const [discuss] = stages;

				return discuss?.status === "JUDGED" && discuss.elapsedMs < 400;
			}),
		).toBe(true);
		expect(records.map(({ finalOutcome }) => finalOutcome.status)).toEqual([
			"JUDGED",
			"JUDGED",
			"EXECUTION_FAILED",
		]);
		expect(records[2]?.finalOutcome).toMatchObject({
			status: "EXECUTION_FAILED",
			evidence: { recordFile: "final.json" },
		});
		expect(
			retained.get("pipeline-confirmation-1/pipeline-confirmation-1-rep-3"),
		).toBe(
			records[2]?.finalOutcome.status === "EXECUTION_FAILED"
				? records[2].finalOutcome.evidence?.resultSha
				: undefined,
		);
		const successfulFinal = records[0]?.finalOutcome;
		if (successfulFinal?.status !== "JUDGED") {
			throw new Error("Expected a judged final outcome");
		}
		const [firstRecordFile] = outcome.repRecordFiles;
		if (firstRecordFile === undefined) {
			throw new Error("Expected the first rep record");
		}
		const finalEvidence = z
			.object({ grade: z.object({ verdict: z.literal("PASS") }) })
			.parse(
				JSON.parse(
					await Bun.file(
						join(dirname(firstRecordFile), successfulFinal.evidence.recordFile),
					).text(),
				),
			);
		expect(finalEvidence.grade.verdict).toBe("PASS");
		expect([...events.values()]).toEqual([
			["discuss", "build", "final"],
			["discuss", "build", "final"],
			["discuss", "build", "final"],
		]);
		const group = parseConfirmationGroupRecord(
			await Bun.file(outcome.groupRecordFile).text(),
		);
		expect(group.mode).toBe("pipeline");
		expect(group.declaredStages).toEqual(["discuss", "build"]);
		const primaryAfter = {
			head: await runCommand(["git", "rev-parse", "HEAD"], source.directory),
			branch: await runCommand(
				["git", "branch", "--show-current"],
				source.directory,
			),
			status: await runCommand(
				["git", "status", "--porcelain"],
				source.directory,
			),
			base: await Bun.file(join(source.directory, "base.txt")).bytes(),
		};
		expect(primaryAfter).toEqual(primaryBefore);
		const worktrees = await runCommand(
			["git", "worktree", "list", "--porcelain"],
			source.directory,
		);
		expect(
			worktrees.split("\n").filter((line) => line.startsWith("worktree ")),
		).toHaveLength(1);
		const [firstRecord] = records;
		if (firstRecord === undefined) {
			throw new Error("Expected the first confirmation record");
		}
		const temporaryRootExists = await stat(
			dirname(firstRecord.worktreePath),
		).then(
			() => true,
			() => false,
		);
		expect(temporaryRootExists).toBe(false);
	});

	it("retains earlier pipeline worker metrics when a later stage omits them", async () => {
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-pipeline-metrics-"));
		testResources.track(parent);
		const sourceRoot = join(parent, "source");
		await mkdir(sourceRoot);
		const corpusRoot = join(parent, "corpus");
		for (const skill of ["discuss", "build", "doctrine"]) {
			await mkdir(join(corpusRoot, skill), { recursive: true });
			await Bun.write(join(corpusRoot, skill, "SKILL.md"), `${skill}\n`);
		}
		const pipeline: PipelineDefinition = {
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
			],
		};
		const rubric: StageRubric = {
			hardBlockers: [],
			requirements: [],
			dimensions: [],
		};
		const metric: ClaudeCallMetrics = {
			costUsd: 0.25,
			inputTokens: 100,
			outputTokens: 20,
			cacheReadTokens: 30,
			cacheWriteTokens: 40,
			turns: 2,
		};
		const taskSha = "b".repeat(40);
		const resultSha = "c".repeat(40);

		const outcome = await runPipelineConfirmation(
			{
				stageSession: {
					runWorkflowStage: (request) => {
						const transcript = {
							stage: request.stage,
							sessionId: `${request.targetDir}-${request.stage}`,
							costUsd: metric.costUsd,
							exchanges: [],
						};
						if (request.stage === "discuss") {
							return Promise.resolve({ ...transcript, callMetrics: [metric] });
						}

						return Promise.resolve(transcript);
					},
					readTaskOutput: () =>
						Promise.resolve(
							JSON.stringify({
								task: { acceptanceCriteria: ["done"], documentation: [] },
							}),
						),
					readTaskCard: () => Promise.resolve("task card"),
					captureBuildCandidate: () =>
						Promise.resolve({
							resultSha,
							diff: "diff",
							changedPaths: ["change.txt"],
						}),
					assertPlanningStageCompleted: (_targetDir, baselineSha, stage) =>
						Promise.resolve({
							taskState: `${stage.name}-state`,
							artifact: { path: "backlog/docs/spec.md", content: "spec\n" },
							resultSha: baselineSha,
							diff: "",
							changedPaths: [],
						}),
					assertBuildCommitted: () =>
						Promise.resolve({
							resultSha,
							diff: "diff",
							commitSubjects: ["feat: build"],
						}),
					changedPathsBetween: () => Promise.resolve(["change.txt"]),
					captureCheckIntegrity: () =>
						Promise.resolve(harnessResult("PASS", "checks match")),
					captureTreatmentChecks: () =>
						Promise.resolve(harnessResult("PASS", "checks pass")),
					captureStageCorpus: () => Promise.resolve([]),
				},
				runStageJudge: (_model, _effort, _budget, input, source) =>
					Promise.resolve({
						stage: input.stage,
						rubricPath: source.rubricPath,
						rubric: source.rubric,
						input,
						prompt: "prompt",
						attempts: [
							{
								payload: { summary: "accepted" },
								costUsd: metric.costUsd,
								metrics: metric,
								outcome: "ACCEPTED",
							},
						],
						costUsd: metric.costUsd,
						grade: {
							hardBlockers: [],
							requirements: [],
							dimensions: [],
							summary: "accepted",
							grade: "A",
							verdict: "CONTINUE",
						},
					}),
				runFinalJudge: () =>
					Promise.resolve({
						grade: completeGrade("PASS"),
						prompt: "final prompt",
						attempts: [
							{
								payload: { summary: "pass" },
								costUsd: metric.costUsd,
								metrics: metric,
								outcome: "ACCEPTED",
							},
						],
						costUsd: metric.costUsd,
					}),
				createTaskCommit: () => Promise.resolve({ taskId: "TASK-1", taskSha }),
				runChecks: () => Promise.resolve(),
				captureBaselineContext: () => Promise.resolve([]),
				captureFileHashes: () => Promise.resolve(new Map<string, string>()),
				addWorktree: async (_targetDir, _sha, worktreeDir) => {
					await mkdir(worktreeDir, { recursive: true });
				},
				removeWorktree: async (_targetDir, worktreeDir) => {
					await rm(worktreeDir, { force: true, recursive: true });
				},
				materializeCheckpoint,
				recordCheckpoint,
				recordRetentionRef: () => Promise.resolve(),
				captureBuildCandidate: () =>
					Promise.resolve({
						resultSha,
						diff: "diff",
						changedPaths: ["change.txt"],
					}),
				log: () => undefined,
			},
			{
				runsDirectory: parent,
				groupId: "pipeline-metrics",
				reps: 2,
				projectedCost: {
					reps: 2,
					perRepMaximumUsd: 45,
					totalMaximumUsd: 90,
				},
				approvalMethod: "yes",
				source: { root: sourceRoot, sha: "a".repeat(40) },
				controlSha: "d".repeat(40),
				pipelinePath: "pipelines/test.json",
				pipeline,
				task: "# Task\n\nImplement it.",
				productBrief: "Brief",
				instructions: "Instructions\n",
				finalRubric: "1. `final`: pass\n",
				stageRubrics: {
					discuss: {
						rubricPath: "rubrics/discuss.json",
						content: "{}\n",
						rubric,
					},
					build: {
						rubricPath: "rubrics/build.json",
						content: "{}\n",
						rubric,
					},
				},
				corpusRoots: [corpusRoot],
				model: "sonnet",
				judgeModel: "opus",
				sessionBudgetUsd: 5,
			},
		);
		const [recordFile] = outcome.repRecordFiles;
		const record = parseConfirmationRepRecord(
			await Bun.file(recordFile ?? "missing").text(),
		);

		expect(record.metrics).toEqual({
			status: "MISSING",
			calls: [
				{ role: "worker", metrics: metric },
				{ role: "stage-judge", metrics: metric },
				{ role: "stage-judge", metrics: metric },
				{ role: "final-judge", metrics: metric },
			],
			missing: ["worker call metrics"],
		});
		expect(record.workerTrajectorySteps).toBe(metric.turns);
	});

	it("lets pipeline peers finish and preserves only a pre-evidence failure", async () => {
		const source = await testResources.createRepository();
		await Bun.write(
			join(source.directory, ".gitignore"),
			"backlog/\n.boris/\n.claude/\nnode_modules/\n",
		);
		await commitAll(source.directory, "chore: ignore workflow state");
		const sourceHead = await runCommand(
			["git", "rev-parse", "HEAD"],
			source.directory,
		);
		const sourceSha = sourceHead.trim();
		const parent = await mkdtemp(
			join(tmpdir(), "rehearsal-pipeline-failures-"),
		);
		testResources.track(parent);
		const corpusRoot = join(parent, "corpus");
		for (const skill of ["discuss", "build", "doctrine"]) {
			await mkdir(join(corpusRoot, skill), { recursive: true });
			await Bun.write(join(corpusRoot, skill, "SKILL.md"), `${skill}\n`);
		}
		const pipeline: PipelineDefinition = {
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
			],
		};
		const rubric = {
			hardBlockers: [],
			requirements: [],
			dimensions: [],
		};
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
		const logs: string[] = [];
		const retained: string[] = [];
		const outcome = await runPipelineConfirmation(
			{
				stageSession: {
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
						if (workflowRequest.stage === "discuss") {
							finished.push(ordinal);
						} else {
							await Bun.write(
								join(workflowRequest.targetDir, "change.txt"),
								`rep ${ordinal}\n`,
							);
							await runCommand(
								["git", "add", "change.txt"],
								workflowRequest.targetDir,
							);
							await runCommand(
								["git", "commit", "-m", "feat: implement change"],
								workflowRequest.targetDir,
							);
						}

						return {
							stage: workflowRequest.stage,
							sessionId: `${ordinal}-${workflowRequest.stage}`,
							costUsd: metric.costUsd,
							callMetrics: [metric],
							exchanges: [],
						};
					},
					readTaskOutput: () =>
						Promise.resolve(
							JSON.stringify({
								task: { acceptanceCriteria: ["done"], documentation: [] },
							}),
						),
					readTaskCard: () => Promise.resolve("task card"),
					captureBuildCandidate,
					assertPlanningStageCompleted: (_target, baselineSha, stage) =>
						Promise.resolve({
							taskState: `${stage.name}-state`,
							artifact: {
								path: "backlog/docs/spec.md",
								content: "spec\n",
							},
							resultSha: baselineSha,
							diff: "",
							changedPaths: [],
						}),
					assertBuildCommitted,
					changedPathsBetween,
					captureCheckIntegrity: () =>
						Promise.resolve(harnessResult("PASS", "checks match")),
					captureTreatmentChecks: () =>
						Promise.resolve(harnessResult("PASS", "checks pass")),
					captureStageCorpus,
				},
				runStageJudge: (_model, _effort, _budget, input, rubricSource) => {
					if (
						input.stage === "build" &&
						input.transcript.sessionId.startsWith("3-")
					) {
						return Promise.reject(
							new JudgeOutputValidationError({
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
							}),
						);
					}

					return Promise.resolve({
						stage: input.stage,
						rubricPath: rubricSource.rubricPath,
						rubric: rubricSource.rubric,
						input,
						prompt: "prompt",
						attempts: [
							{
								payload: { summary: "stop" },
								costUsd: metric.costUsd,
								metrics: metric,
								outcome: "ACCEPTED",
							},
						],
						costUsd: metric.costUsd,
						grade: {
							hardBlockers: [],
							requirements: [],
							dimensions: [],
							summary: input.transcript.sessionId.startsWith("3-")
								? "continue"
								: "stop",
							grade: input.transcript.sessionId.startsWith("3-") ? "A" : "F",
							verdict: input.transcript.sessionId.startsWith("3-")
								? "CONTINUE"
								: "STOP",
						},
					});
				},
				runFinalJudge: () =>
					Promise.reject(new Error("final Judge is not reached")),
				createTaskCommit: async (targetDir, _task, instructions) => ({
					taskId: "TASK-1",
					taskSha: await installInstructions(targetDir, instructions),
				}),
				runChecks: () => Promise.resolve(),
				captureBaselineContext,
				captureFileHashes,
				addWorktree,
				removeWorktree: async (targetDir, worktreeDir) => {
					removed.push(worktreeDir);
					await removeWorktree(targetDir, worktreeDir);
				},
				materializeCheckpoint,
				recordCheckpoint,
				recordRetentionRef: (_targetDir, runName) => {
					retained.push(runName);

					return Promise.resolve();
				},
				captureBuildCandidate,
				log: (message) => {
					logs.push(message);
				},
			},
			{
				runsDirectory: parent,
				groupId: "pipeline-failures",
				reps: 3,
				projectedCost: {
					reps: 3,
					perRepMaximumUsd: 45,
					totalMaximumUsd: 135,
				},
				approvalMethod: "yes",
				source: { root: source.directory, sha: sourceSha },
				controlSha: "a".repeat(40),
				pipelinePath: "pipelines/test.json",
				pipeline,
				task: "# Task\n\nImplement it.",
				productBrief: "Brief",
				instructions: "Instructions\n",
				finalRubric: "1. `final`: pass\n",
				stageRubrics: {
					discuss: {
						rubricPath: "rubrics/discuss.json",
						content: "{}\n",
						rubric,
					},
					build: {
						rubricPath: "rubrics/build.json",
						content: "{}\n",
						rubric,
					},
				},
				corpusRoots: [corpusRoot],
				model: "sonnet",
				judgeModel: "opus",
				sessionBudgetUsd: 5,
			},
		);
		const records = await Promise.all(
			outcome.repRecordFiles.map(async (path) =>
				parseConfirmationRepRecord(await Bun.file(path).text()),
			),
		);
		expect(finished.toSorted((left, right) => left - right)).toEqual([1, 3]);
		expect(
			records.map(({ stages }) => stages.map(({ status }) => status)),
		).toEqual([
			["JUDGED", "NOT_REACHED"],
			["EXECUTION_FAILED", "NOT_REACHED"],
			["JUDGED", "EXECUTION_FAILED"],
		]);
		expect(
			records.every(({ outcome: result }) => result === "UNSUCCESSFUL"),
		).toBe(true);
		const preservedPath = records[1]?.worktreePath ?? "missing";
		expect(logs).toContain(
			`Pipeline rep pipeline-failures-rep-2 failed; evidence preserved at ${preservedPath}`,
		);
		const preserved = await stat(preservedPath);
		expect(preserved.isDirectory()).toBe(true);
		expect(removed).not.toContain(preservedPath);
		expect(removed).toContain(records[2]?.worktreePath ?? "missing");
		expect(records[0]?.metrics.status).toBe("COMPLETE");
		expect(retained).toContain("pipeline-failures/pipeline-failures-rep-1");
		expect(retained).toContain("pipeline-failures/pipeline-failures-rep-3");
		const report = z
			.object({
				reliability: z.array(
					z.object({ name: z.string(), successful: z.number() }),
				),
			})
			.parse(JSON.parse(await Bun.file(outcome.reportFile).text()));
		expect(report.reliability[0]).toMatchObject({
			name: "discuss",
			successful: 1,
		});
		await removeWorktree(source.directory, preservedPath);
	});
});
