#!/usr/bin/env bun
import { join } from "node:path";
import { CONTROL_DIR, REQUIRED_BUN_VERSION } from "#benchmark/config";
import { liveCorpusSource } from "#benchmark/corpus-file";
import { benchmarkRunsDirectory } from "#benchmark/run-layout";
import { createAppServer } from "./app";

const DEFAULT_PORT = 4173;

function main(): void {
	if (Bun.version !== REQUIRED_BUN_VERSION) {
		throw new Error(
			`Use Bun ${REQUIRED_BUN_VERSION}; current version is ${Bun.version}`,
		);
	}

	const app = createAppServer({
		runsDirectory: benchmarkRunsDirectory(CONTROL_DIR),
		corpusSource: liveCorpusSource(),
		clientDistDirectory: join(CONTROL_DIR, "client", "dist"),
	});

	const port = Number(Bun.env["PORT"] ?? DEFAULT_PORT);
	Bun.serve({ port, fetch: app.fetch });
	console.log(`rehearsal serving on http://localhost:${String(port)}`);
}

if (import.meta.main) {
	main();
}
