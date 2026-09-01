import type { ProviderCall } from "./contracts";
import type { JudgeAttempt } from "./judge-attempt";

export function judgeProviderCalls(
	attempts: readonly JudgeAttempt[],
): ProviderCall[] {
	return attempts.map(({ metrics }) =>
		metrics === undefined ? {} : { metrics },
	);
}

export class JudgeExecutionError extends Error {
	public readonly prompt: string;
	public readonly attempts: readonly JudgeAttempt[];
	public readonly providerCalls: readonly ProviderCall[];
	public readonly costUsd: number;

	public constructor(props: {
		readonly cause: unknown;
		readonly prompt: string;
		readonly attempts: readonly JudgeAttempt[];
		readonly costUsd: number;
	}) {
		super(
			props.cause instanceof Error
				? props.cause.message
				: "Judge execution failed",
			{ cause: props.cause },
		);
		this.name = "JudgeExecutionError";
		this.prompt = props.prompt;
		this.attempts = props.attempts;
		this.providerCalls = [...judgeProviderCalls(props.attempts), {}];
		this.costUsd = props.costUsd;
	}
}
