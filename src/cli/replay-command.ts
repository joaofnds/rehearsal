import { randomUUID } from "node:crypto";
import {
	loadAttempts,
	LineageMismatchError,
	presentAttempts,
} from "#benchmark/attempts";
import {
	assertPlanningStageCompleted,
	installInstructions,
	readTaskCard,
	readTaskOutput,
} from "#benchmark/backlog";
import {
	captureStageCorpus,
	materializeCheckpoint,
	corpusLayoutRoots,
} from "#benchmark/checkpoint";
import {
	captureBaselineContext,
	captureCheckIntegrity,
	captureFileHashes,
	captureTreatmentChecks,
} from "#benchmark/checks";
import { runCommand } from "#benchmark/command";
import type { ReplayCliConfig } from "#benchmark/config";
import {
	CONTROL_DIR,
	readProjectInstructions,
	judgeSelfPreferenceWarning,
	parseReplayArgs,
} from "#benchmark/config";
import { runReplay } from "#benchmark/replay";
import type { ReplayDependencies, ReplayRequest } from "#benchmark/replay";
import type { ReplayStageOutcome } from "#benchmark/replay-command";
import { executeReplayStage } from "#benchmark/replay-command";
import type { ReplayConfirmationOutcome } from "#benchmark/replay-confirmation";
import { runReplayConfirmation } from "#benchmark/replay-confirmation";
import type { BenchmarkRunPaths } from "#benchmark/run-layout";
import {
	benchmarkRunPaths,
	benchmarkRunsDirectory,
	recordedRunNames,
} from "#benchmark/run-layout";
import { loadStageRubric, runStageJudge } from "#benchmark/stage-grading";
import {
	addWorktree,
	assertBuildCommitted,
	captureBuildCandidate,
	changedPathsBetween,
	git,
	removeWorktree,
} from "#benchmark/target";
import { createProductOwner, runWorkflowStage } from "#benchmark/workflow";
import { asUsageError } from "#cli/commands";
import {
	RefusedPreconditionError,
	refuseStageCorpus,
	requireInteractiveStdin,
} from "#cli/interactive-stdin";
import type { CommandOutput } from "#cli/output";
import { writeDiagnostic, writeRecord } from "#cli/output";
import { terminalQuestioner } from "#cli/questioner";

export interface ReplayEvidence {
	readonly recordPath: string;
	readonly lineage: string;
}

export type ReplayCommandOutcome = ReplayStageOutcome<
	ReplayEvidence,
	ReplayConfirmationOutcome
>;

export interface ReplayCommandRequest {
	readonly args: readonly string[];
	readonly json: boolean;
	readonly stdinIsTerminal: boolean;
}

export interface ReplayCommandDependencies {
	readonly output: CommandOutput;
	readonly resolveRunDirectory: (runName: string) => Promise<string>;
	readonly execute: (
		config: ReplayCliConfig,
		paths: BenchmarkRunPaths,
		output: CommandOutput,
	) => Promise<ReplayCommandOutcome>;
}

export async function runReplayCommand(
	request: ReplayCommandRequest,
	dependencies: ReplayCommandDependencies,
): Promise<void> {
	const config = asUsageError(() => parseReplayArgs(request.args));
	refuseStageCorpus(config.corpus);
	if (config.confirmation !== undefined && !config.confirmation.approved) {
		requireInteractiveStdin(
			request.stdinIsTerminal,
			"approving the projected cost needs a TTY; pass --yes instead",
		);
	}

	writeDiagnostic(dependencies.output, judgeSelfPreferenceWarning(config));

	await dependencies.resolveRunDirectory(config.runName);
	const paths = benchmarkRunPaths(
		benchmarkRunsDirectory(CONTROL_DIR),
		config.runName,
	);
	const outcome = await dependencies.execute(
		config,
		paths,
		dependencies.output,
	);

	await reportOutcome(request, config, paths, outcome, dependencies.output);
}

async function reportOutcome(
	request: ReplayCommandRequest,
	config: ReplayCliConfig,
	paths: BenchmarkRunPaths,
	outcome: ReplayCommandOutcome,
	output: CommandOutput,
): Promise<void> {
	if (outcome.kind === "confirmation") {
		output.stderr(`Confirmation group: ${outcome.evidence.groupRecordFile}\n`);
		for (const recordFile of outcome.evidence.repRecordFiles) {
			output.stderr(`Confirmation rep: ${recordFile}\n`);
		}
		await writeRecord(output, outcome.evidence.reportFile, request.json);

		return;
	}

	output.stderr(await attemptComparison(config, paths, outcome.evidence));
	await writeRecord(output, outcome.evidence.recordPath, request.json);
}

/**
 * The replay is already recorded and paid for, so a refusal to compare its
 * attempts is reported rather than thrown away with the command.
 */
async function attemptComparison(
	config: ReplayCliConfig,
	paths: BenchmarkRunPaths,
	evidence: ReplayEvidence,
): Promise<string> {
	try {
		return `${await presentAttempts(
			evidence.lineage,
			await loadAttempts(paths, config.stage, evidence.lineage),
		)}\n`;
	} catch (error) {
		if (!(error instanceof LineageMismatchError)) {
			throw error;
		}

		return `${error.message}\n`;
	}
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

export async function executeReplay(
	config: ReplayCliConfig,
	paths: BenchmarkRunPaths,
	output: CommandOutput,
): Promise<ReplayCommandOutcome> {
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
		log: (message) => {
			output.stderr(`${message}\n`);
		},
	};
	const replayRequest: ReplayRequest = {
		paths,
		stage: config.stage,
		instructions: await readProjectInstructions(),
		controlSha: await currentControlSha(),
		model: config.model,
		effort: config.effort,
		judgeModel: config.judgeModel,
		judgeEffort: config.judgeEffort,
		sessionBudgetUsd: config.sessionBudgetUsd,
	};
	const questioner = terminalQuestioner();

	try {
		return await executeReplayStage(config, replayRequest, {
			approval: {
				output: (message) => {
					output.stderr(`${message}\n`);
				},
				prompt: (message) => questioner.question(message),
			},
			runDebug: async (debugRequest) => {
				const outcome = await runReplay(replayDependencies, debugRequest);

				return {
					recordPath: outcome.recordPath,
					lineage: outcome.record.consumed.lineage,
				};
			},
			runConfirmed: (confirmationRequest) =>
				runReplayConfirmation(replayDependencies, confirmationRequest),
			groupId: randomUUID,
			corpusRoots: corpusLayoutRoots(CONTROL_DIR),
		});
	} finally {
		questioner.close();
	}
}

export async function resolveRunDirectory(runName: string): Promise<string> {
	const paths = benchmarkRunPaths(benchmarkRunsDirectory(CONTROL_DIR), runName);
	if (await Bun.file(paths.manifestFile).exists()) {
		return paths.checkpointsDirectory;
	}

	const recorded = await recordedRunNames(paths.runsDirectory);

	throw new RefusedPreconditionError(
		`No replayable run named ${paths.name}; recorded runs: ${
			recorded.join(", ") || "none"
		}`,
	);
}
