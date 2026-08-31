import { readClaudeEnvelope } from "./claude";
import type { ClaudeEnvelope } from "./contracts";

export type JudgeInvoker = (prompt: string) => Promise<string>;

export type JudgeAttempt =
	| {
			readonly payload: unknown;
			readonly costUsd: number;
			readonly outcome: "ACCEPTED";
	  }
	| {
			readonly payload: unknown;
			readonly costUsd: number;
			readonly outcome: "REJECTED";
			readonly error: string;
	  };

export class JudgeOutputValidationError extends Error {
	public override name = "JudgeOutputValidationError";

	public constructor(
		message: string,
		public readonly prompt: string,
		public readonly attempts: readonly JudgeAttempt[],
		public readonly costUsd: number,
	) {
		super(message);
	}
}

export interface JudgeAttemptResult<Value> {
	readonly value: Value;
	readonly attempts: readonly JudgeAttempt[];
	readonly costUsd: number;
}

const JUDGE_ATTEMPTS = 2;

export async function runJudgeAttempts<Value>(
	prompt: string,
	invoke: JudgeInvoker,
	validate: (envelope: ClaudeEnvelope) => Value,
): Promise<JudgeAttemptResult<Value>> {
	let costUsd = 0;
	const attempts: JudgeAttempt[] = [];
	let attemptPrompt = prompt;
	for (let attempt = 1; ; attempt += 1) {
		const output = await invoke(attemptPrompt);
		const envelope = readClaudeEnvelope(output);
		const attemptCostUsd = envelope.total_cost_usd ?? 0;
		const payload = envelope.structured_output ?? envelope.result ?? null;
		costUsd += attemptCostUsd;
		try {
			const value = validate(envelope);
			attempts.push({
				payload,
				costUsd: attemptCostUsd,
				outcome: "ACCEPTED",
			});

			return { value, attempts, costUsd };
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			attempts.push({
				payload,
				costUsd: attemptCostUsd,
				outcome: "REJECTED",
				error: reason,
			});
			if (attempt >= JUDGE_ATTEMPTS) {
				throw new JudgeOutputValidationError(reason, prompt, attempts, costUsd);
			}

			attemptPrompt = `${prompt}\n\nYour previous response was rejected: ${reason}. Correct it and return the full schema again.`;
		}
	}
}
