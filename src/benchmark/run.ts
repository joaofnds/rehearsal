import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assertPlanningStageCompleted,
	createTaskCommit,
	parseTaskState,
	readTaskOutput,
} from "./backlog";
import { collectCalibration, type Questioner } from "./calibration";
import {
	captureBaselineContext,
	captureCheckIntegrity,
	captureFileHashes,
	captureTreatmentChecks,
	runChecks,
} from "./checks";
import { runCommand } from "./command";
import { type BenchmarkConfig, CONTROL_DIR, WORKFLOW_STAGES } from "./config";
import type {
	ContextFile,
	LocalCheckResult,
	RunArtifact,
	StageJudgeInput,
	StageScorecard,
	StageTranscript,
} from "./contracts";
import { runJudge, validateRubricDefinition } from "./judge";
import {
	assertStageGradePassed,
	captureStageJudgeInput,
	runStageJudge,
} from "./stage-grading";
import {
	assertBuildCommitted,
	assertControlReady,
	assertSourceReady,
	assertWorkspaceCleanAt,
	captureBuildCandidate,
	captureWorkflowBackup,
	changedPathsBetween,
	claimTarget,
	teardownTarget,
} from "./target";
import { type ProductOwnerSession, runWorkflowStage } from "./workflow";

async function createRunFiles(timestamp: string) {
	const directory = join(CONTROL_DIR, ".benchmark-runs");
	const name = timestamp.replaceAll(":", "-");

	await mkdir(directory, { recursive: true });

	return {
		artifact: join(directory, `${name}.json`),
		review: join(directory, `${name}.review.json`),
		stage: (stage: string) => join(directory, `${name}.${stage}.json`),
	};
}

async function writeArtifact(path: string, artifact: RunArtifact) {
	await Bun.write(path, `${JSON.stringify(artifact, null, 2)}\n`);
}

interface BuildEvidence {
	readonly resultSha: string;
	readonly diff: string;
	readonly changedPaths: readonly string[];
	readonly checkIntegrity: LocalCheckResult;
	readonly localChecks: LocalCheckResult;
	readonly taskState: string;
}

export async function runBenchmark(config: BenchmarkConfig, rl: Questioner) {
	const controlSha = await assertControlReady();
	const source = await assertSourceReady(config.sourceDir);
	const workflowBackup = await captureWorkflowBackup(source.root);
	const productOwnerDirectory = await mkdtemp(join(tmpdir(), "template-po-"));
	const timestamp = new Date().toISOString();
	const runFiles = await createRunFiles(timestamp);
	let stageFailureCalibrated = false;
	let pendingArtifact: RunArtifact | undefined;

	let teardownStarted: Promise<void> | undefined;
	const teardown = () => {
		teardownStarted ??= teardownTarget(source, workflowBackup);
		return teardownStarted;
	};
	const restoreOnSignal = (signal: NodeJS.Signals) => {
		console.error(`\nReceived ${signal}; restoring the target before exit.`);
		teardown()
			.catch((error) =>
				console.error(error instanceof Error ? error.message : String(error)),
			)
			.finally(() => process.exit(signal === "SIGTERM" ? 143 : 130));
	};
	process.on("SIGINT", restoreOnSignal);
	process.on("SIGTERM", restoreOnSignal);

	try {
		await claimTarget(source);
		console.log(`Target: ${source.root}`);
		console.log(`Original commit: ${source.sha}`);
		console.log(`Workflow backup: ${workflowBackup.directory}`);
		await runChecks(source.root, "Baseline checks");
		await assertWorkspaceCleanAt(source.root, source.sha);
		const baselineHashes = await captureFileHashes(source.root);
		const baselineContext = await captureBaselineContext(source.root);
		const [task, productBrief, instructions, rubric, claudeVersion] =
			await Promise.all([
				Bun.file(join(CONTROL_DIR, "backlog-seed.md")).text(),
				Bun.file(join(CONTROL_DIR, "product-brief.md")).text(),
				Bun.file(join(CONTROL_DIR, "CLAUDE.md")).text(),
				Bun.file(join(CONTROL_DIR, "rubric.md")).text(),
				runCommand(["claude", "--version"], CONTROL_DIR),
			]);
		const rubricIds = validateRubricDefinition(rubric);
		const { taskId, taskSha } = await createTaskCommit(
			source.root,
			task,
			instructions,
		);
		const productOwner: ProductOwnerSession = {
			sessionId: randomUUID(),
			spentUsd: 0,
			started: false,
		};
		const workflow: StageTranscript[] = [];
		const stageScorecards: StageScorecard[] = [];
		const stageArtifacts: ContextFile[] = [];
		let buildEvidence: BuildEvidence | undefined;

		for (const stage of WORKFLOW_STAGES) {
			console.log(`\n${stage[0]?.toUpperCase()}${stage.slice(1)} session`);
			const transcript = await runWorkflowStage(
				source.root,
				productOwnerDirectory,
				config.model,
				config.effort,
				config.sessionBudgetUsd,
				productOwner,
				task,
				productBrief,
				taskId,
				stage,
			);
			workflow.push(transcript);

			const currentTaskOutput = await readTaskOutput(source.root, taskId);
			const buildCandidate =
				stage === "build"
					? await captureBuildCandidate(source.root, taskSha)
					: undefined;
			const baseInput: StageJudgeInput = {
				stage,
				task,
				productBrief,
				instructions,
				baselineContext,
				taskState: currentTaskOutput,
				transcript,
				priorArtifacts: [...stageArtifacts],
				diff: buildCandidate?.diff,
				changedPaths: buildCandidate?.changedPaths,
			};
			const input = await captureStageJudgeInput(baseInput, async () => {
				if (stage !== "build") {
					const currentTask = parseTaskState(currentTaskOutput);
					const planning = await assertPlanningStageCompleted(
						source.root,
						taskSha,
						stage,
						currentTask,
					);
					stageArtifacts.push(planning.artifact);

					return {
						...baseInput,
						taskState: planning.taskState,
						artifact: planning.artifact,
					};
				}

				const build = await assertBuildCommitted(source.root, taskSha);
				buildEvidence = {
					resultSha: build.resultSha,
					diff: build.diff,
					changedPaths: await changedPathsBetween(
						source.root,
						taskSha,
						build.resultSha,
					),
					checkIntegrity: await captureCheckIntegrity(
						source.root,
						baselineHashes,
					),
					localChecks: await captureTreatmentChecks(source.root),
					taskState: currentTaskOutput,
				};

				return {
					...baseInput,
					taskState: buildEvidence.taskState,
					diff: buildEvidence.diff,
					changedPaths: buildEvidence.changedPaths,
					checkIntegrity: buildEvidence.checkIntegrity,
					localChecks: buildEvidence.localChecks,
				};
			});

			console.log(`\n${stage} stage Judge`);
			await Bun.write(
				runFiles.stage(stage),
				`${JSON.stringify(
					{ status: "AWAITING_STAGE_JUDGE", stage, input },
					null,
					2,
				)}\n`,
			);
			let scorecard: StageScorecard;
			try {
				scorecard = await runStageJudge(
					config.judgeModel,
					config.judgeEffort,
					config.sessionBudgetUsd,
					input,
				);
			} catch (error) {
				await Bun.write(
					runFiles.stage(stage),
					`${JSON.stringify(
						{
							status: "STAGE_JUDGE_FAILED",
							stage,
							error: error instanceof Error ? error.message : String(error),
							input,
						},
						null,
						2,
					)}\n`,
				);
				throw error;
			}
			stageScorecards.push(scorecard);
			await Bun.write(
				runFiles.stage(stage),
				`${JSON.stringify(scorecard, null, 2)}\n`,
			);
			console.log(JSON.stringify(scorecard.grade, null, 2));
			if (scorecard.grade.verdict === "STOP") {
				const calibration = await collectCalibration({
					rl,
					reviewFile: runFiles.review,
					targetDir: source.root,
					originalInstructions: instructions,
					originalRubric: rubric,
					stageScorecards,
					judgeModel: config.judgeModel,
					judgeEffort: config.judgeEffort,
					sessionBudgetUsd: config.sessionBudgetUsd,
				});
				await Bun.write(
					runFiles.stage(stage),
					`${JSON.stringify({ ...scorecard, calibration }, null, 2)}\n`,
				);
				stageFailureCalibrated = true;
			}
			assertStageGradePassed(scorecard);
		}

		if (!buildEvidence) {
			throw new Error("Build stage did not run");
		}
		const evidence = buildEvidence;

		console.log("\nJudge session");
		const judge = await runJudge(
			config.judgeModel,
			config.judgeEffort,
			config.sessionBudgetUsd,
			rubric,
			baselineContext,
			evidence.diff,
			evidence.changedPaths,
			evidence.checkIntegrity,
			evidence.localChecks,
		);
		const { grade } = judge;
		console.log(JSON.stringify(grade, null, 2));
		const artifact: RunArtifact = {
			status: "AWAITING_HUMAN_REVIEW",
			timestamp,
			controlSha,
			sourceRoot: source.root,
			sourceOrigin: source.origin,
			sourceSha: source.sha,
			taskSha,
			resultSha: evidence.resultSha,
			model: config.model,
			effort: config.effort,
			judgeModel: config.judgeModel,
			judgeEffort: config.judgeEffort,
			sessionBudgetUsd: config.sessionBudgetUsd,
			bunVersion: Bun.version,
			claudeVersion: claudeVersion.trim(),
			task,
			productBrief,
			instructions,
			rubric,
			rubricIds,
			baselineContext,
			taskId,
			productOwnerSessionId: productOwner.sessionId,
			productOwnerCostUsd: productOwner.spentUsd,
			workflow,
			stageScorecards,
			taskState: evidence.taskState,
			judgePrompt: judge.prompt,
			diff: evidence.diff,
			checkIntegrity: evidence.checkIntegrity,
			localChecks: evidence.localChecks,
			grade,
			reviewFile: runFiles.review,
		};
		await writeArtifact(runFiles.artifact, artifact);
		pendingArtifact = artifact;
		console.log(`Run artifact: ${runFiles.artifact}`);
		console.log(`Human review: ${runFiles.review}`);

		const calibration = await collectCalibration({
			rl,
			reviewFile: runFiles.review,
			targetDir: source.root,
			originalInstructions: instructions,
			originalRubric: rubric,
			finalCandidate: {
				originalGrade: grade,
				baselineContext,
				diff: evidence.diff,
				changedPaths: evidence.changedPaths,
				checkIntegrity: evidence.checkIntegrity,
				localChecks: evidence.localChecks,
			},
			stageScorecards,
			judgeModel: config.judgeModel,
			judgeEffort: config.judgeEffort,
			sessionBudgetUsd: config.sessionBudgetUsd,
		});
		await writeArtifact(runFiles.artifact, {
			...artifact,
			status: "COMPLETE",
			calibration,
		});
		pendingArtifact = undefined;
		console.log("Calibration recorded; restoring the target.");
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		if (pendingArtifact) {
			try {
				await writeArtifact(runFiles.artifact, {
					...pendingArtifact,
					status: "FAILED",
				});
			} catch (writeError) {
				console.error(
					`Failed to update the run artifact: ${writeError instanceof Error ? writeError.message : String(writeError)}`,
				);
			}
		}
		if (!stageFailureCalibrated) {
			try {
				await rl.question(
					`The run failed. Inspect ${source.root} if useful, then press Enter to restore the target.`,
				);
			} catch {
				console.error("No interactive stdin; restoring the target now.");
			}
		}
		throw error;
	} finally {
		process.off("SIGINT", restoreOnSignal);
		process.off("SIGTERM", restoreOnSignal);
		try {
			await teardown();
		} finally {
			await rm(productOwnerDirectory, { force: true, recursive: true });
		}
	}
}
