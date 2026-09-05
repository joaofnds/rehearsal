import { stageCorpusRefusal } from "#benchmark/session-corpus";
import { RefusedPreconditionError } from "#benchmark/exit-codes";

export { RefusedPreconditionError } from "#benchmark/exit-codes";

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
