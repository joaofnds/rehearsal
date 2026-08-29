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
import { type BenchmarkConfig, CONTROL_DIR } from "./config";
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
	captureStageJudgeInput,
	runStageGates,
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
	restoreTarget,
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

export async function runBenchmark(config: BenchmarkConfig, rl: Questioner) {
	const controlSha = await assertControlReady();
	const source = await assertSourceReady(config.sourceDir);
	const workflowBackup = await captureWorkflowBackup(source.root);
	const productOwnerDirectory = await mkdtemp(join(tmpdir(), "template-po-"));
	const timestamp = new Date().toISOString();
	const runFiles = await createRunFiles(timestamp);
	let stageFailureCalibrated = false;

	try {
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
		let resultSha: string | undefined;
		let diff: string | undefined;
		let changedPaths: readonly string[] | undefined;
		let checkIntegrity: LocalCheckResult | undefined;
		let localChecks: LocalCheckResult | undefined;
		let taskState: string | undefined;

		await runStageGates(async (stage) => {
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
						taskId,
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
				resultSha = build.resultSha;
				diff = build.diff;
				changedPaths = await changedPathsBetween(
					source.root,
					taskSha,
					resultSha,
				);
				checkIntegrity = await captureCheckIntegrity(
					source.root,
					baselineHashes,
				);
				localChecks = await captureTreatmentChecks(source.root);
				taskState = currentTaskOutput;

				return {
					...baseInput,
					taskState,
					diff,
					changedPaths,
					checkIntegrity,
					localChecks,
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
			const scorecard = await runStageJudge(
				config.judgeModel,
				config.judgeEffort,
				config.sessionBudgetUsd,
				input,
			);
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
			return scorecard;
		});

		if (
			!resultSha ||
			diff === undefined ||
			!changedPaths ||
			!checkIntegrity ||
			!localChecks ||
			taskState === undefined
		) {
			throw new Error("Build completed without captured evaluation evidence");
		}

		console.log("\nJudge session");
		const judge = await runJudge(
			config.judgeModel,
			config.judgeEffort,
			config.sessionBudgetUsd,
			rubric,
			baselineContext,
			diff,
			changedPaths,
			checkIntegrity,
			localChecks,
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
			resultSha,
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
			taskState,
			judgePrompt: judge.prompt,
			diff,
			checkIntegrity,
			localChecks,
			grade,
			reviewFile: runFiles.review,
		};
		await writeArtifact(runFiles.artifact, artifact);
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
				diff,
				changedPaths,
				checkIntegrity,
				localChecks,
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
		console.log("Calibration recorded; restoring the target.");
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		if (!stageFailureCalibrated) {
			await rl.question(
				`The run failed. Inspect ${source.root} if useful, then press Enter to restore the target.`,
			);
		}
		throw error;
	} finally {
		try {
			await restoreTarget(source, workflowBackup);
			console.log(`Target restored to ${source.sha}.`);
		} finally {
			await Promise.all([
				rm(workflowBackup.directory, { force: true, recursive: true }),
				rm(productOwnerDirectory, { force: true, recursive: true }),
			]);
		}
	}
}
