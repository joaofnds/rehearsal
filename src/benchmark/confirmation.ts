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

export interface ConfirmationApprovalIO {
	readonly output: (message: string) => void;
	readonly prompt: (message: string) => Promise<string>;
}

export async function requireConfirmationApproval(
	projection: ConfirmationCostProjection,
	approved: boolean,
	io: ConfirmationApprovalIO,
): Promise<void> {
	io.output(formatProjectedCost(projection));
	if (approved) {
		return;
	}

	const response = await io.prompt("Start confirmation? [y/N] ");
	const answer = response.trim().toLowerCase();
	if (answer !== "y" && answer !== "yes") {
		throw new Error("Confirmation declined");
	}
}
