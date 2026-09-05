export const EXIT_CODES = {
	completed: 0,
	executionFailure: 1,
	usageError: 2,
	refusedPrecondition: 3,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export interface CommandFailure extends Error {
	readonly exitCode: ExitCode;
}

function isCommandFailure(error: Readonly<Error>): error is CommandFailure {
	return "exitCode" in error;
}

export function exitCodeFor(error: Readonly<Error>): ExitCode {
	return isCommandFailure(error) ? error.exitCode : EXIT_CODES.executionFailure;
}

export class RefusedPreconditionError extends Error implements CommandFailure {
	public readonly exitCode = EXIT_CODES.refusedPrecondition;

	public constructor(message: string) {
		super(message);
		this.name = "RefusedPreconditionError";
	}
}
