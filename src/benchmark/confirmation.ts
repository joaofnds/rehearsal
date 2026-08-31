export type ConfirmationCostRequest =
	| {
			readonly mode: "stage";
			readonly reps: number;
			readonly sessionBudgetUsd: number;
	  }
	| {
			readonly mode: "pipeline";
			readonly reps: number;
			readonly stages: number;
			readonly sessionBudgetUsd: number;
	  };

export interface ConfirmationCostProjection {
	readonly reps: number;
	readonly perRepMaximumUsd: number;
	readonly totalMaximumUsd: number;
}

export function projectConfirmationCost(
	request: ConfirmationCostRequest,
): ConfirmationCostProjection {
	const sessionsPerRep = request.mode === "stage" ? 4 : 3 * request.stages + 3;
	const perRepMaximumUsd = sessionsPerRep * request.sessionBudgetUsd;

	return {
		reps: request.reps,
		perRepMaximumUsd,
		totalMaximumUsd: request.reps * perRepMaximumUsd,
	};
}

export function formatProjectedCost(
	projection: ConfirmationCostProjection,
): string {
	return `Projected maximum cost: $${projection.totalMaximumUsd.toFixed(2)} (${projection.reps} reps x $${projection.perRepMaximumUsd.toFixed(2)})`;
}
