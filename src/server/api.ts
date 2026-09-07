import { Hono } from "hono";
import type { CorpusRoot } from "#benchmark/corpus-file";
import { displayPath } from "#benchmark/config";
import { recordFileFor } from "#cli/show-command";
import { UsageError } from "#cli/commands";
import { RefusedPreconditionError } from "#benchmark/exit-codes";
import { parseRecordId } from "#cli/record-id";
import { redactAbsolutePaths } from "./redact-path";
import { runHistoryReport } from "./run-history";

export interface ApiDependencies {
	readonly runsDirectory: string;
	readonly corpusSource: CorpusRoot;
}

/**
 * Chained (`.get().get()`) rather than two separate `app.get()` statements,
 * because Hono's RPC type inference builds `AppType` off the chain: a caller
 * using `hc<AppType>()` gets `/api/runs`'s response type from this
 * declaration itself, so the client never redeclares the row shape by hand
 * (decision-3's stated reason for choosing Hono over an alternative with no
 * RPC client). `createApiApp` builds and returns this chain directly, rather
 * than through a helper taking a mutable `Hono` parameter, since the RPC
 * type only survives an unbroken method chain from `new Hono()`. That chain
 * is exactly the return type `ApiRoutes` below names, so an explicit
 * annotation here would have to be `ApiRoutes` itself, which is circular:
 * no other spelling of this type exists to write by hand.
 */
// oxlint-disable-next-line typescript/explicit-function-return-type, typescript/explicit-module-boundary-types
export const createApiApp = (dependencies: ApiDependencies) => {
	const app = new Hono()
		.get("/api/runs", async (context) => {
			const report = await runHistoryReport(
				dependencies.runsDirectory,
				dependencies.corpusSource,
			);

			return context.json(report);
		})
		.get("/api/records/:id", async (context) => {
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
					return context.json(
						{ error: redactAbsolutePaths(error.message) },
						400,
					);
				}
				if (error instanceof RefusedPreconditionError) {
					return context.json(
						{ error: redactAbsolutePaths(error.message) },
						404,
					);
				}

				throw error;
			}
		});

	/**
	 * No route-level throw reaches the browser with an absolute path: a route
	 * handler above catches every failure it anticipates, and this net catches
	 * whatever it did not, so a filesystem error surfacing from code neither
	 * this module nor `runHistoryReport` has wrapped is sanitized the same way.
	 * `redactAbsolutePaths` rather than `controlRelative`, because a corpus
	 * root or a target repository's path never lives under `CONTROL_DIR`, and
	 * `staleCheckpoints` (called on every `/api/runs` request per AC #2) can
	 * throw one of those in its message.
	 */
	app.onError((caughtError, context) => {
		const message =
			caughtError instanceof Error ? caughtError.message : String(caughtError);

		return context.json({ error: redactAbsolutePaths(message) }, 500);
	});

	return app;
};

export type ApiRoutes = ReturnType<typeof createApiApp>;
