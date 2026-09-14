import { afterEach, describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import type { SessionHistoryReport } from "#benchmark/session-history";
import { stubFetch, stubFetchByPath } from "#client/test-support/fetch-stub";
import { createAppRouter } from "./router";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function renderAt(path: string): void {
	stubFetch({ rows: [], unreadable: [] });
	renderRouterAt(path);
}

function renderAtWithStub(
	path: string,
	byPath: ReadonlyMap<string, unknown>,
): void {
	stubFetchByPath(byPath);
	renderRouterAt(path);
}

function renderRouterAt(path: string): void {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const router = createAppRouter({
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	render(
		<QueryClientProvider client={client}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
}

function emptyHistory(caseId: string, id: string): SessionHistoryReport {
	return {
		schemaVersion: 1,
		attempt: {
			caseId,
			id,
			model: "sonnet",
			outcome: "SUCCESSFUL",
			corpusFiles: [],
		},
		evidence: { state: "complete" },
		startingContext: [],
		attemptEvents: [],
		boundaryUnknown: [],
		startingSources: [],
		sources: [],
	};
}

describe(createAppRouter.name, () => {
	it("renders run history at the root path, the landing screen", async () => {
		renderAt("/");

		await waitFor(() => {
			expect(screen.getByText("Run history")).toBeInTheDocument();
		});
	});

	it("renders the design system reference at /system", async () => {
		renderAt("/system");

		await waitFor(() => {
			expect(screen.getByText("Rehearsal design system")).toBeInTheDocument();
		});
	});

	it("renders the corpus screen at /corpus", async () => {
		renderAtWithStub(
			"/corpus",
			new Map([
				[
					"/api/corpus",
					{ root: "/corpus", digest: "a", files: [], refusals: [] },
				],
			]),
		);

		await waitFor(() => {
			expect(screen.getByText("Instruction corpus")).toBeInTheDocument();
		});
	});

	it("renders the comparison screen at /comparisons/$digest", async () => {
		const digest = "e".repeat(64);
		renderAtWithStub(
			`/comparisons/${digest}`,
			new Map([
				[
					`/api/comparisons/${digest}`,
					{ report: { cases: [] }, attribution: {} },
				],
			]),
		);

		await waitFor(() => {
			expect(screen.getByText("Comparison")).toBeInTheDocument();
		});
	});

	it("renders standalone saved session history", async () => {
		renderAtWithStub(
			"/attempts/session/case-a/attempt-a",
			new Map([
				[
					"/api/attempts/session/case-a/attempt-a/history",
					emptyHistory("case-a", "attempt-a"),
				],
			]),
		);

		await waitFor(() => {
			expect(screen.getByText("Saved context history")).toBeInTheDocument();
		});
	});

	it("renders confirmation rep saved session history", async () => {
		renderAtWithStub(
			"/groups/group-a/reps/group-a-rep-1/attempt",
			new Map([
				[
					"/api/groups/group-a/reps/group-a-rep-1/attempt/history",
					emptyHistory("case-a", "group-a-rep-1"),
				],
			]),
		);

		await waitFor(() => {
			expect(screen.getByText("Saved context history")).toBeInTheDocument();
		});
	});
});
