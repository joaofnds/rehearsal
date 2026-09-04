import { CONTROL_DIR } from "#benchmark/config";
import { benchmarkRunsDirectory } from "#benchmark/run-layout";
import { startServer } from "#ui/server";

const DEFAULT_PORT = 4173;
const port = Number(Bun.env["REHEARSAL_UI_PORT"] ?? DEFAULT_PORT);
const server = startServer(benchmarkRunsDirectory(CONTROL_DIR), port);

process.stderr.write(`Rehearsal UI on ${server.url.href}\n`);
