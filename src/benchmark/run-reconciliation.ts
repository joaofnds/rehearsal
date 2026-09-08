import { join } from "node:path";
import { loadRunManifest } from "./manifest";
import { readRunMarker } from "./target";
import type { RunEventStore } from "./run-events";
import { isTerminalRunEventKind } from "./run-events";

export interface ReconciliationDependencies {
	readonly runsDirectory: string;
	readonly artifactExists: (path: string) => Promise<boolean>;
	readonly loadManifest: (
		path: string,
	) => Promise<{ readonly sourceRoot: string } | undefined>;
	readonly readMarker: (
		sourceRoot: string,
	) => Promise<{ readonly pid: number } | undefined>;
	readonly isAlive: (pid: number) => boolean;
}

/**
 * A run whose latest event is already terminal, or whose artifact already
 * landed on disk, needs nothing done: the first is a run this pass already
 * reconciled (or one that finished normally without a stale event), the
 * second is a run that finished normally before this pass ran. A missing
 * manifest or claim marker is "nothing to reconcile", not an error: the
 * crash may have preceded the manifest write, or the target may already
 * have been restored by a graceful shutdown this pass raced with.
 */
export async function reconcileInterruptedRuns(
	store: RunEventStore,
	dependencies: ReconciliationDependencies,
): Promise<readonly string[]> {
	const reconciled: string[] = [];

	for (const runId of store.runIds()) {
		try {
			const latest = store.latestEvent(runId);
			if (latest === undefined || isTerminalRunEventKind(latest.kind)) {
				continue;
			}

			const artifactFile = join(dependencies.runsDirectory, `${runId}.json`);
			if (await dependencies.artifactExists(artifactFile)) {
				continue;
			}

			const manifestFile = join(
				dependencies.runsDirectory,
				`${runId}.checkpoints`,
				"manifest.json",
			);
			const manifest = await dependencies.loadManifest(manifestFile);
			if (manifest === undefined) {
				continue;
			}

			const marker = await dependencies.readMarker(manifest.sourceRoot);
			if (marker === undefined || dependencies.isAlive(marker.pid)) {
				continue;
			}

			store.append({
				runId,
				kind: "run-interrupted",
				stage: latest.stage,
				spentUsd: latest.spentUsd,
				elapsedMs: latest.elapsedMs,
			});
			reconciled.push(runId);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`Failed to reconcile run ${runId}: ${message}`);
		}
	}

	return reconciled;
}

/**
 * The real collaborators `reconcileInterruptedRuns` needs against the
 * filesystem and the OS: `loadRunManifest` throws on a missing file, where
 * this pass wants "nothing to reconcile", so the existence check comes
 * first; `process.kill(pid, 0)` throws for a dead pid rather than returning
 * false, per Node's documented signal-0 liveness probe.
 */
export function liveReconciliationDependencies(
	runsDirectory: string,
): ReconciliationDependencies {
	return {
		runsDirectory,
		artifactExists: (path) => Bun.file(path).exists(),
		loadManifest: async (path) => {
			if (!(await Bun.file(path).exists())) {
				return undefined;
			}

			return loadRunManifest(path);
		},
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
