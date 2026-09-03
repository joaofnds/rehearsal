import { stageCorpusRefusal } from "#benchmark/session-corpus";
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

/**
 * A stage cannot be given a corpus source, so run and replay refuse one before
 * they resolve anything else rather than after a stage has been paid for.
 */
export function refuseStageCorpus(corpus: string | undefined): void {
	if (corpus === undefined) {
		return;
	}

	throw new RefusedPreconditionError(stageCorpusRefusal(corpus).message);
}
