import type { ClaudeCallMetrics, StageLetterGrade } from "./contracts";

export type ConfirmationStageOutcome =
	| {
			readonly stage: string;
			readonly status: "JUDGED";
			readonly grade: StageLetterGrade;
			readonly verdict: "CONTINUE" | "STOP";
	  }
	| {
			readonly stage: string;
			readonly status: "EXECUTION_FAILED" | "METRICS_MISSING" | "NOT_REACHED";
	  };

export type ConfirmationFinalOutcome =
	| { readonly status: "JUDGED"; readonly verdict: "PASS" | "FAIL" }
	| {
			readonly status: "EXECUTION_FAILED" | "METRICS_MISSING" | "NOT_REACHED";
	  };

export interface ConfirmationReliabilityRep {
	readonly metricsComplete: boolean;
	readonly stages: readonly ConfirmationStageOutcome[];
	readonly finalOutcome: ConfirmationFinalOutcome;
}

export interface ReliabilitySummary {
	readonly name: string;
	readonly requested: number;
	readonly attempted: number;
	readonly notReached: number;
	readonly failed: number;
	readonly successful: number;
	readonly gradeDistribution: Readonly<Record<string, number>>;
	readonly successRate: number;
	readonly standardError: number;
	readonly passK: number;
}

export function reliabilitySummaryNamed(
	quality: readonly ReliabilitySummary[],
	name: string,
): ReliabilitySummary {
	const summary = quality.find((candidate) => candidate.name === name);
	if (summary === undefined) {
		throw new Error(`Comparison arm has no ${name} quality summary`);
	}

	return summary;
}

interface ReliabilityObservation {
	readonly attempted: boolean;
	readonly successful: boolean;
	readonly grade?: string | undefined;
}

function summarize(
	name: string,
	observations: readonly ReliabilityObservation[],
): ReliabilitySummary {
	const requested = observations.length;
	if (requested === 0) {
		throw new Error("A confirmation report requires at least one rep");
	}

	let attempted = 0;
	let successful = 0;
	const gradeDistribution: Record<string, number> = {};
	for (const observation of observations) {
		if (observation.attempted) {
			attempted += 1;
		}
		if (observation.successful) {
			successful += 1;
		}
		if (observation.grade !== undefined) {
			gradeDistribution[observation.grade] =
				(gradeDistribution[observation.grade] ?? 0) + 1;
		}
	}

	const notReached = requested - attempted;
	const successRate = successful / requested;

	return {
		name,
		requested,
		attempted,
		notReached,
		failed: attempted - successful,
		successful,
		gradeDistribution,
		successRate,
		standardError: Math.sqrt((successRate * (1 - successRate)) / requested),
		passK: successRate ** requested,
	};
}

function stageObservation(
	outcome: ConfirmationStageOutcome,
	metricsComplete: boolean,
): ReliabilityObservation {
	if (outcome.status === "NOT_REACHED") {
		return { attempted: false, successful: false };
	}
	if (outcome.status !== "JUDGED") {
		return { attempted: true, successful: false };
	}

	return {
		attempted: true,
		successful:
			metricsComplete &&
			outcome.verdict === "CONTINUE" &&
			(outcome.grade === "A" || outcome.grade === "B"),
		grade: outcome.grade,
	};
}

function finalObservation(
	outcome: ConfirmationFinalOutcome,
	metricsComplete: boolean,
): ReliabilityObservation {
	if (outcome.status === "NOT_REACHED") {
		return { attempted: false, successful: false };
	}
	if (outcome.status !== "JUDGED") {
		return { attempted: true, successful: false };
	}

	return {
		attempted: true,
		successful: metricsComplete && outcome.verdict === "PASS",
		grade: outcome.verdict,
	};
}

export function buildReliabilityReport(
	declaredStages: readonly string[],
	reps: readonly ConfirmationReliabilityRep[],
): readonly ReliabilitySummary[] {
	const stages = declaredStages.map((stage) =>
		summarize(
			stage,
			reps.map((rep) => {
				const outcome = rep.stages.find(
					(candidate) => candidate.stage === stage,
				);
				if (outcome === undefined) {
					throw new Error(`Rep is missing the declared ${stage} stage`);
				}

				return stageObservation(outcome, rep.metricsComplete);
			}),
		),
	);

	return [
		...stages,
		summarize(
			"final",
			reps.map((rep) =>
				finalObservation(rep.finalOutcome, rep.metricsComplete),
			),
		),
	];
}

const CALL_ROLES = [
	"worker",
	"product-owner",
	"stage-judge",
	"final-judge",
] as const;

type CallRole = (typeof CALL_ROLES)[number];

interface ConfirmationCallEvidence {
	readonly role: CallRole;
	readonly metrics: ClaudeCallMetrics;
}

export interface ConfirmationResourceRep {
	readonly metrics:
		| {
				readonly status: "COMPLETE";
				readonly calls: readonly ConfirmationCallEvidence[];
		  }
		| {
				readonly status: "MISSING";
				readonly calls: readonly ConfirmationCallEvidence[];
				readonly missing: readonly string[];
		  };
	readonly workerTrajectorySteps: number;
	readonly elapsedMs: number;
	readonly stages: readonly {
		readonly stage: string;
		readonly elapsedMs?: number | undefined;
	}[];
}

export interface MetricDistributions {
	readonly costUsd: readonly number[];
	readonly inputTokens: readonly number[];
	readonly outputTokens: readonly number[];
	readonly cacheReadTokens: readonly number[];
	readonly cacheWriteTokens: readonly number[];
}

export interface ConfirmationResourceReport {
	readonly completeReps: number;
	readonly missingMetricReps: number;
	readonly perRole: Readonly<Record<CallRole, MetricDistributions>>;
	readonly total: MetricDistributions;
	readonly workerTurns: readonly number[];
	readonly stageElapsedMs: Readonly<Record<string, readonly number[]>>;
	readonly repElapsedMs: readonly number[];
	readonly makespanMs: number;
}

interface MutableMetricDistributions {
	readonly costUsd: number[];
	readonly inputTokens: number[];
	readonly outputTokens: number[];
	readonly cacheReadTokens: number[];
	readonly cacheWriteTokens: number[];
}

function emptyMetricDistributions(): MutableMetricDistributions {
	return {
		costUsd: [],
		inputTokens: [],
		outputTokens: [],
		cacheReadTokens: [],
		cacheWriteTokens: [],
	};
}

function sumCallMetrics(
	calls: readonly ConfirmationCallEvidence[],
	role?: CallRole,
): Omit<ClaudeCallMetrics, "turns" | "durationMs" | "apiDurationMs"> {
	const total = {
		costUsd: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
	};
	for (const call of calls) {
		if (role !== undefined && call.role !== role) {
			continue;
		}

		total.costUsd += call.metrics.costUsd;
		total.inputTokens += call.metrics.inputTokens;
		total.outputTokens += call.metrics.outputTokens;
		total.cacheReadTokens += call.metrics.cacheReadTokens;
		total.cacheWriteTokens += call.metrics.cacheWriteTokens;
	}

	return total;
}

function appendMetricDistributions(
	distributions: MetricDistributions,
	metrics: ReturnType<typeof sumCallMetrics>,
): MutableMetricDistributions {
	return {
		costUsd: [...distributions.costUsd, metrics.costUsd],
		inputTokens: [...distributions.inputTokens, metrics.inputTokens],
		outputTokens: [...distributions.outputTokens, metrics.outputTokens],
		cacheReadTokens: [
			...distributions.cacheReadTokens,
			metrics.cacheReadTokens,
		],
		cacheWriteTokens: [
			...distributions.cacheWriteTokens,
			metrics.cacheWriteTokens,
		],
	};
}

function sortMetricDistributions(
	distributions: MetricDistributions,
): MetricDistributions {
	return {
		costUsd: distributions.costUsd.toSorted((left, right) => left - right),
		inputTokens: distributions.inputTokens.toSorted(
			(left, right) => left - right,
		),
		outputTokens: distributions.outputTokens.toSorted(
			(left, right) => left - right,
		),
		cacheReadTokens: distributions.cacheReadTokens.toSorted(
			(left, right) => left - right,
		),
		cacheWriteTokens: distributions.cacheWriteTokens.toSorted(
			(left, right) => left - right,
		),
	};
}

export function buildResourceReport(
	declaredStages: readonly string[],
	reps: readonly ConfirmationResourceRep[],
	makespanMs: number,
): ConfirmationResourceReport {
	const perRole = {
		worker: emptyMetricDistributions(),
		"product-owner": emptyMetricDistributions(),
		"stage-judge": emptyMetricDistributions(),
		"final-judge": emptyMetricDistributions(),
	} satisfies Record<CallRole, MutableMetricDistributions>;
	let total = emptyMetricDistributions();
	const workerTurns: number[] = [];
	const repElapsedMs: number[] = [];
	const stageElapsedMs: Record<string, number[]> = {};
	for (const stage of declaredStages) {
		stageElapsedMs[stage] = [];
	}

	let completeReps = 0;
	for (const rep of reps) {
		if (rep.metrics.status === "MISSING") {
			continue;
		}

		completeReps += 1;
		for (const role of CALL_ROLES) {
			perRole[role] = appendMetricDistributions(
				perRole[role],
				sumCallMetrics(rep.metrics.calls, role),
			);
		}
		total = appendMetricDistributions(total, sumCallMetrics(rep.metrics.calls));
		workerTurns.push(rep.workerTrajectorySteps);
		repElapsedMs.push(rep.elapsedMs);
		for (const stage of rep.stages) {
			const durations = stageElapsedMs[stage.stage];
			if (durations !== undefined && stage.elapsedMs !== undefined) {
				durations.push(stage.elapsedMs);
			}
		}
	}

	const sortedStageElapsedMs: Record<string, readonly number[]> = {};
	for (const [stage, durations] of Object.entries(stageElapsedMs)) {
		sortedStageElapsedMs[stage] = durations.toSorted(
			(left, right) => left - right,
		);
	}

	return {
		completeReps,
		missingMetricReps: reps.length - completeReps,
		perRole: {
			worker: sortMetricDistributions(perRole.worker),
			"product-owner": sortMetricDistributions(perRole["product-owner"]),
			"stage-judge": sortMetricDistributions(perRole["stage-judge"]),
			"final-judge": sortMetricDistributions(perRole["final-judge"]),
		},
		total: sortMetricDistributions(total),
		workerTurns: workerTurns.toSorted((left, right) => left - right),
		stageElapsedMs: sortedStageElapsedMs,
		repElapsedMs: repElapsedMs.toSorted((left, right) => left - right),
		makespanMs,
	};
}
