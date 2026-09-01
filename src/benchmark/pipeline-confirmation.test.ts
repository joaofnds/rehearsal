import { describe, expect, it } from "bun:test";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import {
	parseConfirmationGroupRecord,
	parseConfirmationRepRecord,
} from "./confirmation-record";
import { runCommand } from "./command";
import {
	JudgeExecutionError,
	JudgeOutputValidationError,
} from "./judge-attempt";
import { runPipelineConfirmation } from "./pipeline-confirmation";
import {
	CONFIRMATION_METRIC,
	PipelineConfirmationHarness,
	completeFinalGrade,
	pipelineStageScorecard,
} from "./pipeline-confirmation-test-support";
import { removeWorktree } from "./target";
import { TestResources } from "./test-support";
import { WorkflowExecutionError } from "./workflow";

const testResources = TestResources.forEachTest();

describe(runPipelineConfirmation.name, () => {
	it("runs three frozen full-pipeline reps concurrently without changing the primary checkout", async () => {
		const harness = await PipelineConfirmationHarness.setup(testResources);
		const allStarted = Promise.withResolvers<boolean>();
		const release = Promise.withResolvers<boolean>();
		const events = new Map<number, string[]>();
		const primaryBefore = await repositoryState(harness.sourceRoot);

		const execution = harness.run({}, (dependencies) => {
			const { stageSession } = dependencies;
			const { runWorkflowStage, captureStageCorpus } = stageSession;

			return {
				...dependencies,
				stageSession: {
					...stageSession,
					runWorkflowStage: async (request) => {
						const ordinal = repOrdinal(request.targetDir);
						const repEvents = events.get(ordinal) ?? [];
						repEvents.push(request.stage);
						events.set(ordinal, repEvents);
						if (request.stage === "discuss") {
							if (events.size === 3) {
								allStarted.resolve(true);
							}
							await release.promise;
						}

						const result = await runWorkflowStage(request);

						return {
							...result,
							sessionId: `${ordinal}-${request.stage}`,
						};
					},
					captureStageCorpus: async (skill, instructions, roots) => {
						await Bun.sleep(500);

						return captureStageCorpus(skill, instructions, roots);
					},
				},
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
										costUsd: CONFIRMATION_METRIC.costUsd,
										metrics: CONFIRMATION_METRIC,
										outcome: "REJECTED",
										error: "invalid output",
									},
								],
								costUsd: CONFIRMATION_METRIC.costUsd,
							}),
						);
					}

					const acceptedAttempt = {
						payload: { summary: "pass" },
						costUsd: CONFIRMATION_METRIC.costUsd,
						metrics: CONFIRMATION_METRIC,
						outcome: "ACCEPTED" as const,
					};

					return Promise.resolve({
						grade: completeFinalGrade("PASS"),
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
						costUsd: CONFIRMATION_METRIC.costUsd,
					});
				},
			};
		});

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
			harness.retained.get(
				"pipeline-confirmation-1/pipeline-confirmation-1-rep-3",
			),
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
		expect(await repositoryState(harness.sourceRoot)).toEqual(primaryBefore);
		const worktrees = await runCommand(
			["git", "worktree", "list", "--porcelain"],
			harness.sourceRoot,
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
		const harness = await PipelineConfirmationHarness.setup(testResources);

		const outcome = await harness.run(
			{
				groupId: "pipeline-metrics",
				reps: 2,
				projectedCost: {
					reps: 2,
					perRepMaximumUsd: 45,
					totalMaximumUsd: 90,
				},
			},
			(dependencies) => {
				const { stageSession } = dependencies;
				const { runWorkflowStage } = stageSession;

				return {
					...dependencies,
					stageSession: {
						...stageSession,
						runWorkflowStage: async (request) => {
							const result = await runWorkflowStage(request);
							if (request.stage === "discuss") {
								return result;
							}

							return { ...result, providerCalls: [{}] };
						},
					},
				};
			},
		);
		const [recordFile] = outcome.repRecordFiles;
		const record = parseConfirmationRepRecord(
			await Bun.file(recordFile ?? "missing").text(),
		);

		expect(record.metrics).toEqual({
			status: "MISSING",
			calls: [
				{ role: "worker", metrics: CONFIRMATION_METRIC },
				{ role: "stage-judge", metrics: CONFIRMATION_METRIC },
				{ role: "stage-judge", metrics: CONFIRMATION_METRIC },
				{ role: "final-judge", metrics: CONFIRMATION_METRIC },
			],
			missing: ["worker call metrics"],
		});
		expect(record.workerTrajectorySteps).toBe(CONFIRMATION_METRIC.turns);
	});

	it("retains worker calls carried by a failed stage execution", async () => {
		const harness = await PipelineConfirmationHarness.setup(testResources);

		const outcome = await harness.run(
			{
				groupId: "worker-execution-metrics",
				reps: 2,
				projectedCost: {
					reps: 2,
					perRepMaximumUsd: 45,
					totalMaximumUsd: 90,
				},
			},
			(dependencies) => {
				const { stageSession } = dependencies;
				const { runWorkflowStage } = stageSession;

				return {
					...dependencies,
					stageSession: {
						...stageSession,
						runWorkflowStage: (request) => {
							if (
								request.stage === "discuss" &&
								repOrdinal(request.targetDir) === 1
							) {
								return Promise.reject(
									new WorkflowExecutionError({
										cause: new Error("worker invocation failed"),
										providerCalls: [{ metrics: CONFIRMATION_METRIC }, {}],
									}),
								);
							}

							return runWorkflowStage(request);
						},
					},
				};
			},
		);
		const records = await Promise.all(
			outcome.repRecordFiles.map(async (path) =>
				parseConfirmationRepRecord(await Bun.file(path).text()),
			),
		);
		const [failed] = records;
		await removeWorktree(harness.sourceRoot, failed?.worktreePath ?? "missing");

		expect(failed?.metrics).toEqual({
			status: "MISSING",
			calls: [{ role: "worker", metrics: CONFIRMATION_METRIC }],
			missing: ["worker call metrics", "stage-judge call metrics"],
		});
		expect(failed?.workerTrajectorySteps).toBe(CONFIRMATION_METRIC.turns);
	});

	it("carries Product Owner provider calls into pipeline evidence", async () => {
		const harness = await PipelineConfirmationHarness.setup(testResources);

		const outcome = await harness.run({}, (dependencies) => ({
			...dependencies,
			createProductOwner: () => ({
				ask: () => Promise.resolve("Use the small scope"),
				snapshot: () => ({
					sessionId: "po-session",
					spentUsd: CONFIRMATION_METRIC.costUsd,
					providerCalls: [{ metrics: CONFIRMATION_METRIC }, {}],
				}),
			}),
		}));
		const [recordFile] = outcome.repRecordFiles;
		const record = parseConfirmationRepRecord(
			await Bun.file(recordFile ?? "missing").text(),
		);

		expect(record.metrics).toEqual({
			status: "MISSING",
			calls: [
				{ role: "worker", metrics: CONFIRMATION_METRIC },
				{ role: "worker", metrics: CONFIRMATION_METRIC },
				{ role: "product-owner", metrics: CONFIRMATION_METRIC },
				{ role: "stage-judge", metrics: CONFIRMATION_METRIC },
				{ role: "stage-judge", metrics: CONFIRMATION_METRIC },
				{ role: "final-judge", metrics: CONFIRMATION_METRIC },
			],
			missing: ["product-owner call metrics"],
		});
	});

	it("marks a later stage Judge invocation failure as a missing provider call", async () => {
		const harness = await PipelineConfirmationHarness.setup(testResources);

		const outcome = await harness.run(
			{
				groupId: "stage-judge-metrics",
				reps: 2,
				projectedCost: {
					reps: 2,
					perRepMaximumUsd: 45,
					totalMaximumUsd: 90,
				},
			},
			(dependencies) => {
				const { stageSession, runStageJudge } = dependencies;
				const { runWorkflowStage } = stageSession;

				return {
					...dependencies,
					stageSession: {
						...stageSession,
						runWorkflowStage: async (request) => ({
							...(await runWorkflowStage(request)),
							sessionId: request.targetDir,
						}),
					},
					runStageJudge: (model, effort, budget, input, source) => {
						if (
							input.stage === "build" &&
							repOrdinal(input.transcript.sessionId) === 1
						) {
							return Promise.reject(
								new JudgeExecutionError({
									cause: new Error("stage Judge invocation failed"),
									prompt: "prompt",
									attempts: [
										{
											payload: { invalid: true },
											costUsd: CONFIRMATION_METRIC.costUsd,
											metrics: CONFIRMATION_METRIC,
											outcome: "REJECTED",
											error: "invalid output",
										},
									],
									costUsd: CONFIRMATION_METRIC.costUsd,
								}),
							);
						}

						return runStageJudge(model, effort, budget, input, source);
					},
				};
			},
		);
		const records = await Promise.all(
			outcome.repRecordFiles.map(async (path) =>
				parseConfirmationRepRecord(await Bun.file(path).text()),
			),
		);
		const report = z
			.object({
				reliability: z.array(
					z.object({
						name: z.string(),
						successful: z.number(),
						gradeDistribution: z.record(z.string(), z.number()),
					}),
				),
				resources: z.object({
					completeReps: z.number(),
					missingMetricReps: z.number(),
					total: z.object({ costUsd: z.array(z.number()) }),
				}),
			})
			.parse(JSON.parse(await Bun.file(outcome.reportFile).text()));
		const [failed] = records;
		await removeWorktree(harness.sourceRoot, failed?.worktreePath ?? "missing");

		expect(failed?.metrics).toEqual({
			status: "MISSING",
			calls: [
				{ role: "worker", metrics: CONFIRMATION_METRIC },
				{ role: "worker", metrics: CONFIRMATION_METRIC },
				{ role: "stage-judge", metrics: CONFIRMATION_METRIC },
				{ role: "stage-judge", metrics: CONFIRMATION_METRIC },
			],
			missing: ["stage-judge call metrics"],
		});
		expect(report.reliability).toEqual([
			{
				name: "discuss",
				successful: 1,
				gradeDistribution: Object.fromEntries([["A", 2]]),
			},
			{
				name: "build",
				successful: 1,
				gradeDistribution: Object.fromEntries([["A", 1]]),
			},
			{ name: "final", successful: 1, gradeDistribution: { PASS: 1 } },
		]);
		expect(report.resources).toEqual({
			completeReps: 1,
			missingMetricReps: 1,
			total: { costUsd: [1.25] },
		});
	});

	it("lets pipeline peers finish and preserves only a pre-evidence failure", async () => {
		const harness = await PipelineConfirmationHarness.setup(testResources);
		const failed = Promise.withResolvers<boolean>();
		const finished: number[] = [];

		const outcome = await harness.run(
			{ groupId: "pipeline-failures" },
			(dependencies) => {
				const { stageSession } = dependencies;
				const { runWorkflowStage } = stageSession;

				return {
					...dependencies,
					stageSession: {
						...stageSession,
						runWorkflowStage: async (request) => {
							const ordinal = repOrdinal(request.targetDir);
							if (ordinal === 2) {
								failed.resolve(true);

								throw new Error("worker failed before evidence");
							}

							await failed.promise;
							if (request.stage === "discuss") {
								finished.push(ordinal);
							}
							const result = await runWorkflowStage(request);

							return {
								...result,
								sessionId: `${ordinal}-${request.stage}`,
							};
						},
					},
					runStageJudge: (_model, _effort, _budget, input, source) => {
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
											costUsd: CONFIRMATION_METRIC.costUsd,
											metrics: CONFIRMATION_METRIC,
											outcome: "REJECTED",
											error: "invalid output",
										},
									],
									costUsd: CONFIRMATION_METRIC.costUsd,
								}),
							);
						}

						const scorecard = pipelineStageScorecard(input, source);
						const continues = input.transcript.sessionId.startsWith("3-");

						return Promise.resolve({
							...scorecard,
							grade: {
								...scorecard.grade,
								summary: continues ? "continue" : "stop",
								grade: continues ? "A" : "F",
								verdict: continues ? "CONTINUE" : "STOP",
							},
						});
					},
					runFinalJudge: () =>
						Promise.reject(new Error("final Judge is not reached")),
				};
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
		expect(harness.logs).toContain(
			`Pipeline rep pipeline-failures-rep-2 failed; evidence preserved at ${preservedPath}`,
		);
		const preserved = await stat(preservedPath);
		expect(preserved.isDirectory()).toBe(true);
		expect(harness.removed).not.toContain(preservedPath);
		expect(harness.removed).toContain(records[2]?.worktreePath ?? "missing");
		expect(records[0]?.metrics.status).toBe("COMPLETE");
		expect(
			harness.retained.has("pipeline-failures/pipeline-failures-rep-1"),
		).toBe(true);
		expect(
			harness.retained.has("pipeline-failures/pipeline-failures-rep-3"),
		).toBe(true);
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
		await removeWorktree(harness.sourceRoot, preservedPath);
	});
});

function repOrdinal(targetDirectory: string): number {
	const match = /-rep-(?<ordinal>\d+)$/u.exec(targetDirectory);

	return Number(match?.groups?.["ordinal"]);
}

async function repositoryState(directory: string): Promise<{
	readonly head: string;
	readonly branch: string;
	readonly status: string;
	readonly base: Uint8Array;
}> {
	return {
		head: await runCommand(["git", "rev-parse", "HEAD"], directory),
		branch: await runCommand(["git", "branch", "--show-current"], directory),
		status: await runCommand(["git", "status", "--porcelain"], directory),
		base: await Bun.file(join(directory, "base.txt")).bytes(),
	};
}
