import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadAttempts, presentAttempts } from "./src/benchmark/attempts";
import {
	assertPlanningStageCompleted,
	installInstructions,
	readTaskOutput,
} from "./src/benchmark/backlog";
import {
	captureStageCorpus,
	materializeCheckpoint,
} from "./src/benchmark/checkpoint";
import {
	captureBaselineContext,
	captureCheckIntegrity,
	captureFileHashes,
	captureTreatmentChecks,
} from "./src/benchmark/checks";
import { runCommand } from "./src/benchmark/command";
import type { ReplayCliConfig } from "./src/benchmark/config";
import {
	CONTROL_DIR,
	parseReplayArgs,
	REQUIRED_BUN_VERSION,
} from "./src/benchmark/config";
import { runReplay } from "./src/benchmark/replay";
import { loadStageRubric, runStageJudge } from "./src/benchmark/stage-grading";
import {
	addWorktree,
	assertBuildCommitted,
	captureBuildCandidate,
	changedPathsBetween,
	git,
	removeWorktree,
} from "./src/benchmark/target";
import { runWorkflowStage } from "./src/benchmark/workflow";

const RUNS_DIRECTORY = join(CONTROL_DIR, ".benchmark-runs");

async function resolveRunDirectory(runName: string): Promise<string> {
	const runDirectory = join(RUNS_DIRECTORY, `${runName}.checkpoints`);
	if (await Bun.file(join(runDirectory, "manifest.json")).exists()) {
		return runDirectory;
	}

	let runEntries: string[];
	try {
		runEntries = await readdir(RUNS_DIRECTORY);
	} catch {
		runEntries = [];
	}
	const recorded = runEntries
		.filter((entry) => entry.endsWith(".checkpoints"))
		.map((entry) => entry.slice(0, -".checkpoints".length));

	throw new Error(
		`No replayable run named ${runName}; recorded runs: ${
			recorded.join(", ") || "none"
		}`,
	);
}

/**
 * Replay exists to iterate on an uncommitted corpus, so a dirty control
 * repository is expected; the record marks it instead of refusing.
 */
async function currentControlSha(): Promise<string> {
	const sha = await git(CONTROL_DIR, "rev-parse", "HEAD");
	const status = await git(
		CONTROL_DIR,
		"status",
		"--porcelain=v1",
		"--untracked-files=all",
	);

	return status ? `${sha}-dirty` : sha;
}

async function main(): Promise<void> {
	if (Bun.version !== REQUIRED_BUN_VERSION) {
		throw new Error(
			`Use Bun ${REQUIRED_BUN_VERSION}; current version is ${Bun.version}`,
		);
	}

	const config: ReplayCliConfig = parseReplayArgs(Bun.argv.slice(2));
	const runDirectory = await resolveRunDirectory(config.runName);

	const outcome = await runReplay(
		{
			stageSession: {
				runWorkflowStage,
				readTaskOutput,
				captureBuildCandidate,
				assertPlanningStageCompleted,
				assertBuildCommitted,
				changedPathsBetween,
				captureCheckIntegrity,
				captureTreatmentChecks,
				captureStageCorpus,
			},
			runStageJudge,
			loadStageRubric,
			addWorktree,
			removeWorktree,
			materializeCheckpoint,
			captureBaselineContext,
			captureFileHashes,
			installInstructions,
			installDependencies: async (worktreeDir) => {
				await runCommand(["bun", "install", "--frozen-lockfile"], worktreeDir);
			},
			log: console.log,
		},
		{
			runName: config.runName,
			runDirectory,
			replaysRoot: join(RUNS_DIRECTORY, "replays"),
			stage: config.stage,
			instructions: await Bun.file(join(CONTROL_DIR, "CLAUDE.md")).text(),
			controlSha: await currentControlSha(),
			model: config.model,
			effort: config.effort,
			judgeModel: config.judgeModel,
			judgeEffort: config.judgeEffort,
			sessionBudgetUsd: config.sessionBudgetUsd,
		},
	);

	console.log(`\nReplay record: ${outcome.recordPath}`);
	console.log(
		await presentAttempts(
			outcome.record.consumed.lineage,
			await loadAttempts(
				RUNS_DIRECTORY,
				config.runName,
				config.stage,
				outcome.record.consumed.lineage,
			),
		),
	);
}

if (import.meta.main) {
	await main();
}
