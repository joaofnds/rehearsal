#!/usr/bin/env bun
import { join } from "node:path";
import { CONTROL_DIR, REQUIRED_BUN_VERSION } from "#benchmark/config";
import { liveCorpusSource } from "#benchmark/corpus-file";
import {
	benchmarkRunsDirectory,
	runEventsDatabaseFile,
} from "#benchmark/run-layout";
import { openRunEventStore } from "#benchmark/run-events";
import {
	liveReconciliationDependencies,
	reconcileInterruptedRuns,
} from "#benchmark/run-reconciliation";
import { createAppServer } from "./app";

const DEFAULT_PORT = 4173;

/**
 * Runs once at startup and completes before the server accepts traffic: a
 * crash leaves a run's event stream stuck at a non-terminal event, and a
 * fresh process boot is the meaningful moment to ask whether the pid that
 * was running it is still alive. Awaiting it here, rather than firing it in
 * the background, keeps a client from reading a run as "running" in the
 * window between the port opening and reconciliation finishing. A run
 * genuinely still in flight when only the server restarts is left alone
 * (its pid is alive), so this cannot mistake a healthy run for a crashed
 * one.
 */
async function reconcileOnStartup(runsDirectory: string): Promise<void> {
	const store = await openRunEventStore(runEventsDatabaseFile(runsDirectory));
	try {
		await reconcileInterruptedRuns(
			store,
			liveReconciliationDependencies(runsDirectory),
		);
	} finally {
		store.close();
	}
}

async function main(): Promise<void> {
	if (Bun.version !== REQUIRED_BUN_VERSION) {
		throw new Error(
			`Use Bun ${REQUIRED_BUN_VERSION}; current version is ${Bun.version}`,
		);
	}

	const runsDirectory = benchmarkRunsDirectory(CONTROL_DIR);
	await reconcileOnStartup(runsDirectory);

	const app = createAppServer({
		runsDirectory,
		corpusSource: liveCorpusSource(),
		clientDistDirectory: join(CONTROL_DIR, "client", "dist"),
	});

	const port = Number(Bun.env["PORT"] ?? DEFAULT_PORT);
	Bun.serve({ port, fetch: app.fetch });
	console.log(`rehearsal serving on http://localhost:${String(port)}`);
}

if (import.meta.main) {
	await main();
}
