import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { ClaudeCallMetrics } from "./contracts";
import type {
	ConfirmationGroupRecord,
	ConfirmationRepRecord,
} from "./confirmation-record";

export type FrozenFile = ConfirmationGroupRecord["inputs"]["files"][number];

export async function writeFrozenFile(
	groupDirectory: string,
	path: string,
	content: string,
	kind: FrozenFile["kind"],
): Promise<FrozenFile> {
	await Bun.write(path, content);

	return {
		kind,
		path: relative(groupDirectory, path),
		sha256: createHash("sha256").update(content).digest("hex"),
	};
}

export async function frozenDirectoryFiles(
	groupDirectory: string,
	directory: string,
	kind: FrozenFile["kind"],
): Promise<readonly FrozenFile[]> {
	const files: FrozenFile[] = [];
	const entries = await readdir(directory, { recursive: true });
	for (const entry of entries.toSorted()) {
		const path = join(directory, entry);
		const file = Bun.file(path);
		if (!(await file.exists()) || file.type === "directory") {
			continue;
		}

		const bytes = await file.bytes();
		files.push({
			kind,
			path: relative(groupDirectory, path),
			sha256: createHash("sha256").update(bytes).digest("hex"),
		});
	}

	return files;
}

export interface ConfirmationRepResult {
	readonly recordFile: string;
	readonly preservedWorktree: boolean;
}

interface CompletedConfirmationRep {
	readonly targetRoot: string;
	readonly retentionName: string;
	readonly resultSha: string;
	readonly recordFile: string;
	readonly recordContent: string;
	readonly worktreePath: string;
	readonly recordRetentionRef: (
		targetRoot: string,
		retentionName: string,
		resultSha: string,
	) => Promise<void>;
	readonly removeWorktree: (
		targetRoot: string,
		worktreePath: string,
	) => Promise<void>;
}

export async function settleCompletedConfirmationRep(
	rep: Readonly<CompletedConfirmationRep>,
): Promise<ConfirmationRepResult> {
	await rep.recordRetentionRef(
		rep.targetRoot,
		rep.retentionName,
		rep.resultSha,
	);
	await Bun.write(rep.recordFile, rep.recordContent);
	await rep.removeWorktree(rep.targetRoot, rep.worktreePath);

	return { recordFile: rep.recordFile, preservedWorktree: false };
}

interface DiagnosticConfirmationRep {
	readonly recordFile: string;
	readonly recordContent: string;
	readonly worktreeCreated: boolean;
	readonly preservedMessage: string;
	readonly log: (message: string) => void;
}

export async function settleDiagnosticConfirmationRep(
	rep: Readonly<DiagnosticConfirmationRep>,
): Promise<ConfirmationRepResult> {
	await Bun.write(rep.recordFile, rep.recordContent);
	if (rep.worktreeCreated) {
		rep.log(rep.preservedMessage);
	}

	return {
		recordFile: rep.recordFile,
		preservedWorktree: rep.worktreeCreated,
	};
}

type MetricRole = "worker" | "product-owner" | "stage-judge" | "final-judge";

export interface ConfirmationMetricAttempt {
	readonly metrics?: ClaudeCallMetrics | undefined;
}

export interface ConfirmationMetricAttempts {
	readonly worker: readonly ConfirmationMetricAttempt[];
	readonly productOwner: readonly ConfirmationMetricAttempt[] | undefined;
	readonly stageJudge: readonly ConfirmationMetricAttempt[];
	readonly finalJudge: readonly ConfirmationMetricAttempt[] | undefined;
}

export function metricAttempts(
	metrics: readonly ClaudeCallMetrics[] | undefined,
): readonly ConfirmationMetricAttempt[] | undefined {
	return metrics?.map((value) => ({ metrics: value }));
}

export function requiredMetricAttempts(
	metrics: readonly ClaudeCallMetrics[] | undefined,
): readonly ConfirmationMetricAttempt[] {
	const attempts = metricAttempts(metrics);

	return attempts === undefined || attempts.length === 0 ? [{}] : attempts;
}

interface RoleAttempts {
	readonly role: MetricRole;
	readonly attempts: readonly ConfirmationMetricAttempt[];
}

export function collectConfirmationMetrics(
	attempts: ConfirmationMetricAttempts,
): Pick<ConfirmationRepRecord, "metrics" | "workerTrajectorySteps"> {
	const required: RoleAttempts[] = [
		{
			role: "worker",
			attempts: attempts.worker.length === 0 ? [{}] : attempts.worker,
		},
		{
			role: "product-owner",
			attempts: attempts.productOwner ?? [{}],
		},
		{
			role: "stage-judge",
			attempts: attempts.stageJudge.length === 0 ? [{}] : attempts.stageJudge,
		},
	];
	if (attempts.finalJudge !== undefined) {
		required.push({
			role: "final-judge",
			attempts: attempts.finalJudge.length === 0 ? [{}] : attempts.finalJudge,
		});
	}

	const calls: {
		readonly role: MetricRole;
		readonly metrics: ClaudeCallMetrics;
	}[] = [];
	const missing: string[] = [];
	for (const group of required) {
		for (const attempt of group.attempts) {
			if (attempt.metrics === undefined) {
				missing.push(`${group.role} call metrics`);

				continue;
			}

			calls.push({ role: group.role, metrics: attempt.metrics });
		}
	}
	const workerTrajectorySteps = calls
		.filter(({ role }) => role === "worker")
		.reduce((total, call) => total + call.metrics.turns, 0);

	return {
		metrics:
			missing.length === 0
				? { status: "COMPLETE", calls }
				: { status: "MISSING", calls, missing },
		workerTrajectorySteps,
	};
}
