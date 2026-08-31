import type { WorkflowStage } from "./config";
import type { RunArtifact, StageJudgeInput } from "./contracts";
import type { JudgeAttempt } from "./judge-attempt";

export interface PendingStage {
	readonly file: string;
	readonly stage: WorkflowStage;
	readonly input: StageJudgeInput;
	readonly failure?:
		| {
				readonly prompt: string;
				readonly attempts: readonly JudgeAttempt[];
				readonly costUsd: number;
		  }
		| undefined;
}

export interface RunAbortDependencies {
	readonly killActiveCommands: () => Promise<void>;
	readonly registerSignal: (
		signal: NodeJS.Signals,
		handler: (signal: NodeJS.Signals) => void,
	) => void;
	readonly releaseSignal: (
		signal: NodeJS.Signals,
		handler: (signal: NodeJS.Signals) => void,
	) => void;
	readonly exit: (code: number) => void;
	readonly reportError: (message: string) => void;
}

export interface RunAbortRequest {
	readonly artifactFile: string;
	readonly teardown: () => Promise<void>;
}

export interface RunAbort {
	readonly trackPendingStage: (pending: PendingStage | undefined) => void;
	readonly trackPendingArtifact: (artifact: RunArtifact | undefined) => void;
	readonly markAborted: (reason: string) => Promise<void>;
	readonly teardown: () => Promise<void>;
	readonly release: () => void;
}

const RUN_SIGNALS: readonly NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];

function signalExitCode(signal: NodeJS.Signals): number {
	if (signal === "SIGTERM") {
		return 143;
	}
	if (signal === "SIGHUP") {
		return 129;
	}

	return 130;
}

export async function writeRunArtifact(
	path: string,
	artifact: RunArtifact,
): Promise<void> {
	await Bun.write(path, `${JSON.stringify(artifact, null, 2)}\n`);
}

export async function writeStageJudgeFailure(
	pending: PendingStage,
	reason: string,
): Promise<void> {
	await Bun.write(
		pending.file,
		`${JSON.stringify(
			{
				status: "STAGE_JUDGE_FAILED",
				stage: pending.stage,
				error: reason,
				input: pending.input,
				...pending.failure,
			},
			null,
			2,
		)}\n`,
	);
}

export function createRunAbort(
	dependencies: RunAbortDependencies,
	request: RunAbortRequest,
): RunAbort {
	let pendingArtifact: RunArtifact | undefined;
	let pendingStage: PendingStage | undefined;
	let abortRecorded: Promise<void> | undefined;
	let teardownStarted: Promise<void> | undefined;
	let abortStarted = false;

	const markAborted = (reason: string): Promise<void> => {
		abortRecorded ??= (async () => {
			try {
				if (pendingStage !== undefined) {
					await writeStageJudgeFailure(pendingStage, reason);
				}
				if (pendingArtifact !== undefined) {
					await writeRunArtifact(request.artifactFile, {
						...pendingArtifact,
						status: "FAILED",
					});
				}
			} catch (error) {
				dependencies.reportError(
					`Failed to update run artifacts: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		})();

		return abortRecorded;
	};
	const teardown = (): Promise<void> => {
		teardownStarted ??= request.teardown();

		return teardownStarted;
	};
	const abortAndExit = async (signal: NodeJS.Signals): Promise<void> => {
		try {
			if (teardownStarted === undefined) {
				await dependencies.killActiveCommands();
			}
			await markAborted(`run interrupted by ${signal}`);
			await teardown();
		} catch (error) {
			dependencies.reportError(
				error instanceof Error ? error.message : String(error),
			);
		} finally {
			dependencies.exit(signalExitCode(signal));
		}
	};
	const restoreOnSignal = (signal: NodeJS.Signals): void => {
		dependencies.reportError(
			`\nReceived ${signal}; restoring the target before exit.`,
		);
		if (abortStarted) {
			return;
		}

		abortStarted = true;
		void abortAndExit(signal);
	};
	const release = (): void => {
		for (const signal of RUN_SIGNALS) {
			dependencies.releaseSignal(signal, restoreOnSignal);
		}
	};

	for (const signal of RUN_SIGNALS) {
		dependencies.registerSignal(signal, restoreOnSignal);
	}

	return {
		trackPendingStage: (pending) => {
			pendingStage = pending;
		},
		trackPendingArtifact: (artifact) => {
			pendingArtifact = artifact;
		},
		markAborted,
		teardown,
		release,
	};
}
