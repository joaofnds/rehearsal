import { afterEach, describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { z } from "zod";
import { RunHistoryPage } from "./run-history-page";
import type { runHistoryResponseSchema } from "./run-history-row";

type RunHistoryResponseBody = z.infer<typeof runHistoryResponseSchema>;

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function respondingWith(body: RunHistoryResponseBody): void {
	const stub = (): Promise<Response> => Promise.resolve(Response.json(body));
	stub.preconnect = fetch.preconnect;
	globalThis.fetch = stub;
}

function renderPage(): void {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<RunHistoryPage />
		</QueryClientProvider>,
	);
}

describe(RunHistoryPage.name, () => {
	it("renders the empty-state block when no runs are recorded", async () => {
		respondingWith({ rows: [] });

		renderPage();

		await waitFor(() => {
			expect(screen.getByText("No runs recorded")).toBeInTheDocument();
		});
	});

	it("renders a row for every recorded run, status and corpus as design-system components", async () => {
		respondingWith({
			rows: [
				{
					run: "2026-09-06T21-58-29.508Z",
					caseId: "audit-log",
					status: "STOPPED:build",
					stage: "shape",
					corpus: { digest: "a3a62f" },
					stale: true,
					staleCauses: ["CLAUDE.md changed"],
				},
			],
		});

		renderPage();

		await waitFor(() => {
			expect(screen.getByText("2026-09-06T21-58-29.508Z")).toBeInTheDocument();
		});
		expect(screen.getByText("audit-log")).toBeInTheDocument();
		expect(screen.getByText("stopped")).toBeInTheDocument();
		expect(screen.getByText("corpus@a3a62f")).toBeInTheDocument();
		expect(screen.getByText("stale")).toBeInTheDocument();
	});

	it("renders a run with no recorded checkpoint without a corpus digest", async () => {
		respondingWith({
			rows: [
				{
					run: "2026-09-05T00-00-00.000Z",
					caseId: "audit-log",
					status: "STOPPED:discuss",
					stage: undefined,
					corpus: undefined,
					stale: false,
					staleCauses: [],
				},
			],
		});

		renderPage();

		await waitFor(() => {
			expect(screen.getByText("2026-09-05T00-00-00.000Z")).toBeInTheDocument();
		});
		expect(screen.queryByText(/^corpus@/u)).not.toBeInTheDocument();
	});
});
