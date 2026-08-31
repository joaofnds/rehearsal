import { readdir } from "node:fs/promises";
import { join } from "node:path";
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
} from "./src/benchmark/checkpoint";
import {
	captureBaselineContext,
	captureCheckIntegrity,
	captureFileHashes,
	captureTreatmentChecks,
} from "./src/benchmark/checks";
import { runCommand } from "./src/benchmark/command";
import type {
	ConfirmationConfig,
	ReplayCliConfig,
} from "./src/benchmark/config";
import {
	CONTROL_DIR,
	parseReplayArgs,
	REQUIRED_BUN_VERSION,
} from "./src/benchmark/config";
import { runReplay } from "./src/benchmark/replay";
import type { ReplayRequest } from "./src/benchmark/replay";
import type { ReplayConfirmationRequest } from "./src/benchmark/replay-confirmation";
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
import { runWorkflowStage } from "./src/benchmark/workflow";

const RUNS_DIRECTORY = benchmarkRunsDirectory(CONTROL_DIR);

export type ReplayStageOutcome<DebugEvidence, ConfirmationEvidence> =
	| { readonly kind: "debug"; readonly evidence: DebugEvidence }
	| { readonly kind: "confirmation"; readonly evidence: ConfirmationEvidence };

export interface ReplayStageExecutionDependencies<
	DebugEvidence,
	ConfirmationEvidence,
> {
	readonly approval: {
		readonly output: (message: string) => void;
		readonly prompt: (message: string) => Promise<string>;
	};
	readonly runDebug: (request: ReplayRequest) => Promise<DebugEvidence>;
	readonly runConfirmed: (
		request: ReplayConfirmationRequest,
	) => Promise<ConfirmationEvidence>;
	readonly groupId: () => string;
	readonly corpusRoots: readonly string[];
}

export async function executeReplayStage<DebugEvidence, ConfirmationEvidence>(
	config: { readonly confirmation: ConfirmationConfig | undefined },
	request: ReplayRequest,
	dependencies: ReplayStageExecutionDependencies<
		DebugEvidence,
		ConfirmationEvidence
	>,
): Promise<ReplayStageOutcome<DebugEvidence, ConfirmationEvidence>> {
	if (config.confirmation !== undefined) {
		throw new Error("Stage confirmation is not wired");
	}

	dependencies.approval.output("single-rep evidence, not a score");

	return { kind: "debug", evidence: await dependencies.runDebug(request) };
}

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

	const outcome = await runReplay(
		{
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
		},
		{
			paths,
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
	// The replay itself is already recorded and paid for, so a refusal to
	// compare is reported rather than thrown away with the command.
	try {
		console.log(
			await presentAttempts(
				outcome.record.consumed.lineage,
				await loadAttempts(
					paths,
					config.stage,
					outcome.record.consumed.lineage,
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
