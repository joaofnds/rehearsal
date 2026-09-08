import { afterEach, describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { stubFetch, stubFetchByPath } from "#client/test-support/fetch-stub";
import { createAppRouter } from "./router";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function renderAt(path: string): void {
	stubFetch({ rows: [], unreadable: [] });
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
		stubFetchByPath(
			new Map([["/api/corpus", { root: "/corpus", digest: "a", files: [] }]]),
		);
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const router = createAppRouter({
			history: createMemoryHistory({ initialEntries: ["/corpus"] }),
		});
		render(
			<QueryClientProvider client={client}>
				<RouterProvider router={router} />
			</QueryClientProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("Instruction corpus")).toBeInTheDocument();
		});
	});

	it("renders the comparison screen at /comparisons/$digest", async () => {
		const digest = "e".repeat(64);
		stubFetchByPath(
			new Map([
				[
					`/api/comparisons/${digest}`,
					{ report: { cases: [] }, attribution: {} },
				],
			]),
		);
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const router = createAppRouter({
			history: createMemoryHistory({
				initialEntries: [`/comparisons/${digest}`],
			}),
		});
		render(
			<QueryClientProvider client={client}>
				<RouterProvider router={router} />
			</QueryClientProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("Comparison")).toBeInTheDocument();
		});
	});
});
