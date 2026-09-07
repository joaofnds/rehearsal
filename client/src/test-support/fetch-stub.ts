import type { InferResponseType } from "hono/client";
import type { apiClient } from "#client/api-client";

type RunHistoryResponseBody = InferResponseType<typeof apiClient.api.runs.$get>;

/**
 * A one-shot `fetch` stub for the `/api/runs` response shape, typed to
 * satisfy Bun's `typeof fetch` (which carries a `preconnect` static member no
 * stub function has by default). Callers restore `globalThis.fetch`
 * themselves, typically in `afterEach`.
 */
export function stubFetch(body: RunHistoryResponseBody): void {
	const stub = (): Promise<Response> => Promise.resolve(Response.json(body));
	stub.preconnect = fetch.preconnect;
	globalThis.fetch = stub;
}
