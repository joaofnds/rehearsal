import type { ClaudeCallMetrics } from "./contracts";
import type { ConfirmationRepRecord } from "./confirmation-record";

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
