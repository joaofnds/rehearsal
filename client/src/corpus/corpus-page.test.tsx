import { afterEach, describe, expect, it } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import type { apiClient } from "#client/api-client";
import { stubFetchByPath } from "#client/test-support/fetch-stub";
import { CorpusPage } from "./corpus-page";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

type CorpusResponse = InferResponseType<typeof apiClient.api.corpus.$get>;

function corpusResponseBody(): CorpusResponse {
	return {
		root: "/home/user/.claude",
		digest: "a41c7e",
		files: [
			{
				path: "CLAUDE.md",
				sha256: "0".repeat(64),
				lastEditedAt: "2026-09-04T09:41:00.000Z",
				readBy: 23,
			},
		],
		refusals: [],
	};
}

function renderPage(): void {
	stubFetchByPath(new Map([["/api/corpus", corpusResponseBody()]]));
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<CorpusPage />
		</QueryClientProvider>,
	);
}

describe(CorpusPage.name, () => {
	it("renders the corpus root unredacted", async () => {
		renderPage();

		await waitFor(() => {
			expect(screen.getByText("/home/user/.claude")).toBeInTheDocument();
		});
	});

	it("labels the header digest 'corpus root@<hash>', distinct from run history's 'corpus@<hash>'", async () => {
		renderPage();

		await waitFor(() => {
			expect(screen.getByText("corpus root@a41c7e")).toBeInTheDocument();
		});
	});

	it("renders one row per file with its path, hash, last-edited time, and read-by count", async () => {
		renderPage();

		await waitFor(() => {
			expect(screen.getByText("CLAUDE.md")).toBeInTheDocument();
		});
		expect(screen.getByText("23")).toBeInTheDocument();
	});

	it("renders the planned-feature block for the disabled edit-instruction workflow", async () => {
		renderPage();

		await waitFor(() => {
			expect(screen.getByText("CLAUDE.md")).toBeInTheDocument();
		});
		expect(screen.getByText("PLANNED")).toBeInTheDocument();
	});

	it("renders the empty state instead of a table when the corpus tree holds no files", async () => {
		stubFetchByPath(
			new Map([
				[
					"/api/corpus",
					{
						root: "/home/user/.claude",
						digest: "e3b0c4",
						files: [],
						refusals: [],
					},
				],
			]),
		);
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={client}>
				<CorpusPage />
			</QueryClientProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("No corpus files found")).toBeInTheDocument();
		});
		expect(screen.queryByRole("table")).not.toBeInTheDocument();
	});
});
