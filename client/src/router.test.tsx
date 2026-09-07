import { describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { createAppRouter } from "./router";

const originalFetch = globalThis.fetch;

function stubbingRunsEmpty(): void {
	const stub = (): Promise<Response> =>
		Promise.resolve(Response.json({ rows: [] }));
	stub.preconnect = fetch.preconnect;
	globalThis.fetch = stub;
}

function renderAt(path: string): void {
	stubbingRunsEmpty();
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

		globalThis.fetch = originalFetch;
	});

	it("renders the design system reference at /system", async () => {
		renderAt("/system");

		await waitFor(() => {
			expect(screen.getByText("Rehearsal design system")).toBeInTheDocument();
		});

		globalThis.fetch = originalFetch;
	});
});
