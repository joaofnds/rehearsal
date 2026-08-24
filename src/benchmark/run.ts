import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assertPlanningStageCompleted,
	createTaskCommit,
	readTaskState,
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
import type { RunArtifact, StageTranscript } from "./contracts";
import { runJudge, validateRubricDefinition } from "./judge";
import {
	assertBuildCommitted,
	assertControlReady,
	assertSourceReady,
	assertWorkspaceCleanAt,
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

			if (stage !== "build") {
				await assertPlanningStageCompleted(source.root, taskId, taskSha, stage);
			}
		}

		const { resultSha, diff } = await assertBuildCommitted(
			source.root,
			taskSha,
		);
		const changedPaths = await changedPathsBetween(
			source.root,
			taskSha,
			resultSha,
		);
		const checkIntegrity = await captureCheckIntegrity(
			source.root,
			baselineHashes,
		);
		const localChecks = await captureTreatmentChecks(source.root);
		const taskState = (await readTaskState(source.root, taskId)).output;

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
		const timestamp = new Date().toISOString();
		const runFiles = await createRunFiles(timestamp);
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
			originalGrade: grade,
			judgeModel: config.judgeModel,
			judgeEffort: config.judgeEffort,
			sessionBudgetUsd: config.sessionBudgetUsd,
			baselineContext,
			diff,
			changedPaths,
			checkIntegrity,
			localChecks,
		});
		await writeArtifact(runFiles.artifact, {
			...artifact,
			status: "COMPLETE",
			calibration,
		});
		console.log("Calibration recorded; restoring the target.");
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		await rl.question(
			`The run failed. Inspect ${source.root} if useful, then press Enter to restore the target.`,
		);
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
