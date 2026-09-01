import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import {
	loadAttempts,
	LineageMismatchError,
	presentAttempts,
} from "./src/benchmark/attempts";
import {
	assertPlanningStageCompleted,
	installInstructions,
	readTaskCard,
	readTaskOutput,
} from "./src/benchmark/backlog";
import {
	captureStageCorpus,
	materializeCheckpoint,
	skillSearchRoots,
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
import type { ReplayDependencies, ReplayRequest } from "./src/benchmark/replay";
import type { ReplayStageOutcome } from "./src/benchmark/replay-command";
import { executeReplayStage } from "./src/benchmark/replay-command";
import type { ReplayConfirmationOutcome } from "./src/benchmark/replay-confirmation";
import { runReplayConfirmation } from "./src/benchmark/replay-confirmation";
import {
	benchmarkRunPaths,
	benchmarkRunsDirectory,
	runNameFromCheckpointsEntry,
} from "./src/benchmark/run-layout";
import type { BenchmarkRunPaths } from "./src/benchmark/run-layout";
import { loadStageRubric, runStageJudge } from "./src/benchmark/stage-grading";
import {
	addWorktree,
	assertBuildCommitted,
	captureBuildCandidate,
	changedPathsBetween,
	git,
	removeWorktree,
} from "./src/benchmark/target";
import { createProductOwner, runWorkflowStage } from "./src/benchmark/workflow";

const RUNS_DIRECTORY = benchmarkRunsDirectory(CONTROL_DIR);

async function resolveRunDirectory(paths: BenchmarkRunPaths): Promise<string> {
	if (await Bun.file(paths.manifestFile).exists()) {
		return paths.checkpointsDirectory;
	}

	let runEntries: string[];
	try {
		runEntries = await readdir(paths.runsDirectory);
	} catch {
		runEntries = [];
	}
	const recorded = runEntries
		.map((entry) => runNameFromCheckpointsEntry(entry))
		.filter((entry) => entry !== undefined);

	throw new Error(
		`No replayable run named ${paths.name}; recorded runs: ${
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
	const paths = benchmarkRunPaths(RUNS_DIRECTORY, config.runName);
	await resolveRunDirectory(paths);
	const replayDependencies: ReplayDependencies = {
		createProductOwner,
		stageSession: {
			runWorkflowStage,
			readTaskOutput,
			readTaskCard,
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
	};
	const request: ReplayRequest = {
		paths,
		stage: config.stage,
		instructions: await Bun.file(join(CONTROL_DIR, "CLAUDE.md")).text(),
		controlSha: await currentControlSha(),
		model: config.model,
		effort: config.effort,
		judgeModel: config.judgeModel,
		judgeEffort: config.judgeEffort,
		sessionBudgetUsd: config.sessionBudgetUsd,
	};
	const rl = createInterface({ input, output });
	let outcome: ReplayStageOutcome<
		Awaited<ReturnType<typeof runReplay>>,
		ReplayConfirmationOutcome
	>;
	try {
		outcome = await executeReplayStage(config, request, {
			approval: {
				output: console.log,
				prompt: (message) => rl.question(message),
			},
			runDebug: (debugRequest) => runReplay(replayDependencies, debugRequest),
			runConfirmed: (confirmationRequest) =>
				runReplayConfirmation(replayDependencies, confirmationRequest),
			groupId: randomUUID,
			corpusRoots: skillSearchRoots(CONTROL_DIR),
		});
	} finally {
		rl.close();
	}
	if (outcome.kind === "confirmation") {
		console.log(`\nConfirmation group: ${outcome.evidence.groupRecordFile}`);
		console.log(`Confirmation report: ${outcome.evidence.reportFile}`);
		for (const recordFile of outcome.evidence.repRecordFiles) {
			console.log(`Confirmation rep: ${recordFile}`);
		}

		return;
	}

	console.log(`\nReplay record: ${outcome.evidence.recordPath}`);
	// The replay itself is already recorded and paid for, so a refusal to
	// compare is reported rather than thrown away with the command.
	try {
		console.log(
			await presentAttempts(
				outcome.evidence.record.consumed.lineage,
				await loadAttempts(
					paths,
					config.stage,
					outcome.evidence.record.consumed.lineage,
				),
			),
		);
	} catch (error) {
		if (!(error instanceof LineageMismatchError)) {
			throw error;
		}

		console.log(`\n${error.message}`);
	}
}

if (import.meta.main) {
	await main();
}
