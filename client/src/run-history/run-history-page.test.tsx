import { afterEach, describe, expect, it } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import type { apiClient } from "#client/api-client";
import { stubFetch } from "#client/test-support/fetch-stub";
import { RunHistoryPage } from "./run-history-page";

type RunHistoryResponseBody = InferResponseType<typeof apiClient.api.runs.$get>;

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function respondingWith(body: RunHistoryResponseBody): void {
	stubFetch(body);
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
		respondingWith({ rows: [], unreadable: [] });

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
					grade: "B",
					corpus: { digest: "a3a62f" },
					stale: true,
					staleCauses: ["CLAUDE.md changed"],
				},
			],
			unreadable: [],
		});

		renderPage();

		await waitFor(() => {
			expect(screen.getByText("2026-09-06T21-58-29.508Z")).toBeInTheDocument();
		});
		expect(screen.getByText("audit-log")).toBeInTheDocument();
		expect(screen.getByText("stopped")).toBeInTheDocument();
		expect(screen.getByText("corpus@a3a62f")).toBeInTheDocument();
		expect(screen.getByText("stale")).toBeInTheDocument();
		expect(screen.getByText("B")).toBeInTheDocument();
	});

	it("names the records table once, so the caption is not doubled by a heading", async () => {
		respondingWith({
			rows: [
				{
					run: "2026-09-06T21-58-29.508Z",
					caseId: "audit-log",
					status: "STOPPED:build",
					stage: "shape",
					grade: "B",
					corpus: { digest: "a3a62f" },
					stale: true,
					staleCauses: ["CLAUDE.md changed"],
				},
			],
			unreadable: [],
		});

		renderPage();

		await waitFor(() => {
			expect(screen.getByRole("table")).toHaveAccessibleName("DURABLE RECORDS");
		});
		expect(screen.getAllByText("DURABLE RECORDS")).toHaveLength(1);
	});

	it("renders a pending grade cell for a row with no recorded grade", async () => {
		respondingWith({
			rows: [
				{
					run: "2026-09-04T00-00-00.000Z",
					caseId: "audit-log",
					status: "STOPPED:discuss",
					stage: undefined,
					grade: undefined,
					corpus: undefined,
					stale: false,
					staleCauses: [],
				},
			],
			unreadable: [],
		});

		renderPage();

		await waitFor(() => {
			expect(screen.getByText("2026-09-04T00-00-00.000Z")).toBeInTheDocument();
		});
		expect(document.querySelector(".rh-grade--pending")).not.toBeNull();
	});

	it("renders a filter bar built from FilterPill, all pressed by default", async () => {
		respondingWith({ rows: [], unreadable: [] });

		renderPage();

		await waitFor(() => {
			expect(screen.getByRole("button", { name: /All/u })).toBeInTheDocument();
		});
		expect(screen.getByRole("button", { name: /All/u })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("narrows the table to stopped runs when the Stopped filter is pressed", async () => {
		respondingWith({
			rows: [
				{
					run: "2026-09-06T21-58-29.508Z",
					caseId: "audit-log",
					status: "STOPPED:build",
					stage: "shape",
					grade: "B",
					corpus: { digest: "a3a62f" },
					stale: true,
					staleCauses: [],
				},
				{
					run: "2026-09-03T00-00-00.000Z",
					caseId: "audit-log",
					status: "COMPLETE",
					stage: "build",
					grade: "A",
					corpus: { digest: "b1c2d3" },
					stale: false,
					staleCauses: [],
				},
			],
			unreadable: [],
		});

		renderPage();

		await waitFor(() => {
			expect(screen.getByText("2026-09-06T21-58-29.508Z")).toBeInTheDocument();
		});
		expect(screen.getByText("2026-09-03T00-00-00.000Z")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Stopped" }));

		expect(screen.getByText("2026-09-06T21-58-29.508Z")).toBeInTheDocument();
		expect(
			screen.queryByText("2026-09-03T00-00-00.000Z"),
		).not.toBeInTheDocument();
	});

	it("renders a run with no recorded checkpoint without a corpus digest", async () => {
		respondingWith({
			rows: [
				{
					run: "2026-09-05T00-00-00.000Z",
					caseId: "audit-log",
					status: "STOPPED:discuss",
					stage: undefined,
					grade: undefined,
					corpus: undefined,
					stale: false,
					staleCauses: [],
				},
			],
			unreadable: [],
		});

		renderPage();

		await waitFor(() => {
			expect(screen.getByText("2026-09-05T00-00-00.000Z")).toBeInTheDocument();
		});
		expect(screen.queryByText(/^corpus@/u)).not.toBeInTheDocument();
	});
});
