import type { StageLetterGrade } from "./contracts";

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
			outcome.verdict === "CONTINUE" &&
			(outcome.grade === "A" || outcome.grade === "B"),
		grade: outcome.grade,
	};
}

function finalObservation(
	outcome: ConfirmationFinalOutcome,
): ReliabilityObservation {
	if (outcome.status === "NOT_REACHED") {
		return { attempted: false, successful: false };
	}
	if (outcome.status !== "JUDGED") {
		return { attempted: true, successful: false };
	}

	return {
		attempted: true,
		successful: outcome.verdict === "PASS",
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

				return stageObservation(outcome);
			}),
		),
	);

	return [
		...stages,
		summarize(
			"final",
			reps.map((rep) => finalObservation(rep.finalOutcome)),
		),
	];
}
