import type { CommandFailure } from "#cli/exit-codes";
import { EXIT_CODES } from "#cli/exit-codes";

export class RefusedPreconditionError extends Error implements CommandFailure {
	public readonly exitCode = EXIT_CODES.refusedPrecondition;

	public constructor(message: string) {
		super(message);
		this.name = "RefusedPreconditionError";
	}
}

export function requireInteractiveStdin(
	stdinIsTerminal: boolean,
	reason: string,
): void {
	if (stdinIsTerminal) {
		return;
	}

	throw new RefusedPreconditionError(`stdin is not a terminal: ${reason}`);
}
