import { Hono } from "hono";
import type { CorpusRoot } from "#benchmark/corpus-file";
import { displayPath } from "#benchmark/config";
import { controlRelative } from "#cli/list-command";
import { recordFileFor } from "#cli/show-command";
import { UsageError } from "#cli/commands";
import { RefusedPreconditionError } from "#benchmark/exit-codes";
import { parseRecordId } from "#cli/record-id";
import { runHistoryRows } from "./run-history";

export interface ApiDependencies {
	readonly runsDirectory: string;
	readonly corpusSource: CorpusRoot;
}

export function createApiApp(dependencies: ApiDependencies): Hono {
	const app = new Hono();

	app.get("/api/runs", async (context) => {
		const rows = await runHistoryRows(
			dependencies.runsDirectory,
			dependencies.corpusSource,
		);

		return context.json({ rows });
	});

	app.get("/api/records/:id", async (context) => {
		try {
			const id = parseRecordId(context.req.param("id"));
			const file = await recordFileFor(id, dependencies.runsDirectory);
			if (!(await Bun.file(file).exists())) {
				throw new RefusedPreconditionError(
					`No record ${context.req.param("id")} at ${displayPath(file)}`,
				);
			}

			return context.body(await Bun.file(file).text(), 200, {
				"content-type": "application/json",
			});
		} catch (error) {
			if (error instanceof UsageError) {
				return context.json({ error: controlRelative(error.message) }, 400);
			}
			if (error instanceof RefusedPreconditionError) {
				return context.json({ error: controlRelative(error.message) }, 404);
			}

			throw error;
		}
	});

	/**
	 * No route-level throw reaches the browser with an absolute path: a route
	 * handler above catches every failure it anticipates, and this net catches
	 * whatever it did not, so a filesystem error surfacing from code neither
	 * this module nor `listRecords` has wrapped is sanitized the same way.
	 */
	app.onError((caughtError, context) => {
		const message =
			caughtError instanceof Error ? caughtError.message : String(caughtError);

		return context.json({ error: controlRelative(message) }, 500);
	});

	return app;
}
