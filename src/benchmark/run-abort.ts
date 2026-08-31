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

	return {
		trackPendingStage: (pending) => {
			pendingStage = pending;
		},
		trackPendingArtifact: (artifact) => {
			pendingArtifact = artifact;
		},
		markAborted: (reason) => {
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
		},
	};
}
