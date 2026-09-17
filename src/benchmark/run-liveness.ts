import { readRunMarker } from "./target";

/**
 * Whether the process that claimed a target is still running. Reconciliation
 * asks the opposite question of the same two collaborators
 * (`run-reconciliation.ts`), acting when a pid is dead; a run-history row
 * asserts the positive, that this run is executing right now. The two readers
 * also disagree about a missing marker: reconciliation reads it as "nothing to
 * reconcile" and leaves the run alone, while a run with no marker is simply not
 * running, because a restored target has no claim on it.
 */
export interface RunLiveness {
	readonly readMarker: (
		sourceRoot: string,
	) => Promise<{ readonly pid: number } | undefined>;
	readonly isAlive: (pid: number) => boolean;
}

/**
 * `process.kill(pid, 0)` throws for a dead pid rather than returning false,
 * per Node's documented signal-0 liveness probe.
 */
export function liveRunLiveness(): RunLiveness {
	return {
		readMarker: readRunMarker,
		isAlive: (pid) => {
			try {
				process.kill(pid, 0);

				return true;
			} catch {
				return false;
			}
		},
	};
}
