import type { WorkflowStage } from "./config";
import type {
	FailedJudgeRunArtifact,
	RunArtifact,
	StageJudgeInput,
	StageJudgeRecord,
} from "./contracts";
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
	readonly persistence: RunArtifactPersistence;
}

export interface RunAbortRequest {
	readonly artifactFile: string;
	readonly teardown: () => Promise<void>;
}

export interface RunAbort {
	readonly writePendingStage: (pending: PendingStage) => Promise<void>;
	readonly updatePendingStage: (pending: PendingStage) => void;
	readonly writeStageProgress: (record: StageJudgeRecord) => Promise<void>;
	readonly completeStage: (record: StageJudgeRecord) => Promise<void>;
	readonly writePendingArtifact: (artifact: RunArtifact) => Promise<void>;
	readonly completeArtifact: (artifact: RunArtifact) => Promise<void>;
	readonly writeFailedArtifact: (
		artifact: FailedJudgeRunArtifact,
	) => Promise<void>;
	readonly markAborted: (reason: string) => Promise<void>;
	readonly teardown: () => Promise<void>;
	readonly release: () => void;
}

const RUN_SIGNALS: readonly NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];

export interface RunArtifactPersistence {
	readonly write: (path: string, contents: string) => Promise<void>;
}

export const fileRunArtifactPersistence: RunArtifactPersistence = {
	write: async (path, contents) => {
		await Bun.write(path, contents);
	},
};

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
	persistence: RunArtifactPersistence = fileRunArtifactPersistence,
): Promise<void> {
	await persistence.write(path, `${JSON.stringify(artifact, null, 2)}\n`);
}

export async function writeStageJudgeFailure(
	pending: PendingStage,
	reason: string,
	persistence: RunArtifactPersistence = fileRunArtifactPersistence,
): Promise<void> {
	await persistence.write(
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
	let signalAbortStarted = false;
	let abortRequested = false;
	let transitionReady = Promise.resolve();

	const enqueueTransition = async (
		transition: () => Promise<void>,
	): Promise<void> => {
		const previousTransition = transitionReady;
		const currentTransition = Promise.withResolvers<undefined>();
		transitionReady = currentTransition.promise;
		await previousTransition;

		try {
			await transition();
		} finally {
			currentTransition.resolve(undefined);
		}
	};
	const enqueueNormalTransition = (
		transition: () => Promise<void>,
	): Promise<void> => {
		if (abortRequested) {
			return Promise.resolve();
		}

		return enqueueTransition(async () => {
			if (!abortRequested) {
				await transition();
			}
		});
	};
	const writePendingStage = (pending: PendingStage): Promise<void> => {
		if (abortRequested) {
			return Promise.resolve();
		}

		pendingStage = pending;

		return enqueueNormalTransition(() =>
			dependencies.persistence.write(
				pending.file,
				`${JSON.stringify(
					{
						status: "AWAITING_STAGE_JUDGE",
						stage: pending.stage,
						input: pending.input,
					},
					null,
					2,
				)}\n`,
			),
		);
	};
	const writeStageProgress = (record: StageJudgeRecord): Promise<void> => {
		if (abortRequested) {
			return Promise.resolve();
		}
		if (pendingStage === undefined) {
			return Promise.reject(new Error("No stage transition is pending"));
		}

		const { file } = pendingStage;

		return enqueueNormalTransition(() =>
			dependencies.persistence.write(
				file,
				`${JSON.stringify(record, null, 2)}\n`,
			),
		);
	};
	const completeStage = (record: StageJudgeRecord): Promise<void> => {
		if (abortRequested) {
			return Promise.resolve();
		}
		if (pendingStage === undefined) {
			return Promise.reject(new Error("No stage transition is pending"));
		}

		const { file } = pendingStage;

		return enqueueNormalTransition(async () => {
			await dependencies.persistence.write(
				file,
				`${JSON.stringify(record, null, 2)}\n`,
			);
			pendingStage = undefined;
		});
	};
	const writePendingArtifact = (artifact: RunArtifact): Promise<void> => {
		if (abortRequested) {
			return Promise.resolve();
		}

		pendingArtifact = artifact;

		return enqueueNormalTransition(() =>
			writeRunArtifact(
				request.artifactFile,
				artifact,
				dependencies.persistence,
			),
		);
	};
	const completeArtifact = (artifact: RunArtifact): Promise<void> => {
		if (abortRequested) {
			return Promise.resolve();
		}

		pendingArtifact = artifact;

		return enqueueNormalTransition(async () => {
			await writeRunArtifact(
				request.artifactFile,
				artifact,
				dependencies.persistence,
			);
			pendingArtifact = undefined;
		});
	};
	const writeFailedArtifact = (
		artifact: FailedJudgeRunArtifact,
	): Promise<void> => {
		pendingArtifact = artifact;

		return enqueueTransition(async () => {
			await writeRunArtifact(
				request.artifactFile,
				artifact,
				dependencies.persistence,
			);
			pendingArtifact = undefined;
		});
	};
	const markAborted = (reason: string): Promise<void> => {
		if (abortRecorded === undefined) {
			abortRequested = true;
			const stageToFail = pendingStage;
			const artifactToFail = pendingArtifact;
			abortRecorded = enqueueTransition(async () => {
				if (stageToFail !== undefined) {
					try {
						await writeStageJudgeFailure(
							stageToFail,
							reason,
							dependencies.persistence,
						);
					} catch (error) {
						dependencies.reportError(
							`Failed to update run artifacts: ${error instanceof Error ? error.message : String(error)}`,
						);
					}
				}
				if (artifactToFail !== undefined) {
					try {
						await writeRunArtifact(
							request.artifactFile,
							{
								...artifactToFail,
								status: "FAILED",
							},
							dependencies.persistence,
						);
					} catch (error) {
						dependencies.reportError(
							`Failed to update run artifacts: ${error instanceof Error ? error.message : String(error)}`,
						);
					}
				}
			});
		}

		return abortRecorded;
	};
	const teardown = (): Promise<void> => {
		teardownStarted ??= request.teardown();

		return teardownStarted;
	};
	const attemptRecovery = async (
		recover: () => Promise<void>,
	): Promise<void> => {
		try {
			await recover();
		} catch (error) {
			dependencies.reportError(
				error instanceof Error ? error.message : String(error),
			);
		}
	};
	const abortAndExit = async (signal: NodeJS.Signals): Promise<void> => {
		if (teardownStarted === undefined) {
			await attemptRecovery(dependencies.killActiveCommands);
		}
		await markAborted(`run interrupted by ${signal}`);
		await attemptRecovery(teardown);
		dependencies.exit(signalExitCode(signal));
	};
	const restoreOnSignal = (signal: NodeJS.Signals): void => {
		dependencies.reportError(
			`\nReceived ${signal}; restoring the target before exit.`,
		);
		if (signalAbortStarted) {
			return;
		}

		signalAbortStarted = true;
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
		writePendingStage,
		updatePendingStage: (pending) => {
			if (!abortRequested) {
				pendingStage = pending;
			}
		},
		writeStageProgress,
		completeStage,
		writePendingArtifact,
		completeArtifact,
		writeFailedArtifact,
		markAborted,
		teardown,
		release,
	};
}
