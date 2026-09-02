export const EXIT_CODES = {
	completed: 0,
	executionFailure: 1,
	usageError: 2,
	refusedPrecondition: 3,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
