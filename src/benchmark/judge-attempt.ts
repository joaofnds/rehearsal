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
