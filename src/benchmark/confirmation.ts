import type { ConfirmationConfig } from "./config";

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

export interface RequestedExecution<Result> {
	readonly confirmation: ConfirmationConfig | undefined;
	readonly projectCost: () => ConfirmationCostProjection;
	readonly approval: ConfirmationApprovalIO;
	readonly runDebug: () => Promise<Result>;
	readonly runConfirmed: (
		projection: ConfirmationCostProjection,
	) => Promise<Result>;
}

export async function runRequestedExecution<Result>(
	execution: RequestedExecution<Result>,
): Promise<Result> {
	if (execution.confirmation === undefined) {
		execution.approval.output("single-rep evidence, not a score");

		return execution.runDebug();
	}

	const projection = execution.projectCost();
	await requireConfirmationApproval(
		projection,
		execution.confirmation.approved,
		execution.approval,
	);

	return execution.runConfirmed(projection);
}

export interface ConfirmationPlan<Inputs> {
	readonly groupId: string;
	readonly reps: number;
	readonly frozenInputs: Inputs;
	readonly worktreePath: (repId: string) => string;
}

export interface ConfirmationRepPlan<Inputs> {
	readonly groupId: string;
	readonly ordinal: number;
	readonly repId: string;
	readonly worktreePath: string;
	readonly inputs: Inputs;
}

export interface ConfirmationRepResult<Inputs, Result> {
	readonly plan: ConfirmationRepPlan<Inputs>;
	readonly outcome: PromiseSettledResult<Result>;
}

async function executeRep<Inputs, Result>(
	plan: ConfirmationRepPlan<Inputs>,
	execute: (plan: ConfirmationRepPlan<Inputs>) => Promise<Result>,
): Promise<ConfirmationRepResult<Inputs, Result>> {
	try {
		return {
			plan,
			outcome: { status: "fulfilled", value: await execute(plan) },
		};
	} catch (error) {
		return { plan, outcome: { status: "rejected", reason: error } };
	}
}

export function runConfirmation<Inputs, Result>(
	confirmation: ConfirmationPlan<Inputs>,
	execute: (plan: ConfirmationRepPlan<Inputs>) => Promise<Result>,
): Promise<readonly ConfirmationRepResult<Inputs, Result>[]> {
	const plans = Array.from({ length: confirmation.reps }, (_value, index) => {
		const ordinal = index + 1;
		const repId = `${confirmation.groupId}-rep-${ordinal}`;

		return {
			groupId: confirmation.groupId,
			ordinal,
			repId,
			worktreePath: confirmation.worktreePath(repId),
			inputs: confirmation.frozenInputs,
		};
	});

	return Promise.all(plans.map((plan) => executeRep(plan, execute)));
}
