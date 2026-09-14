import { afterEach, describe, expect, it } from "bun:test";
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { stubFetchByPath } from "#client/test-support/fetch-stub";
import { SessionHistoryPage } from "./session-history-page";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function renderPage(): void {
	stubFetchByPath(
		new Map([
			[
				"/api/attempts/session/case-a/attempt-a/history",
				{
					schemaVersion: 1,
					attempt: {
						caseId: "case-a",
						id: "attempt-a",
						model: "sonnet",
						outcome: "SUCCESSFUL",
						corpusFiles: [],
					},
					evidence: { state: "complete" },
					startingContext: [],
					boundaryUnknown: [],
					startingSources: [],
					sources: [
						{
							id: "project:/work/CLAUDE.md",
							kind: "project",
							name: "CLAUDE.md",
							path: "/work/CLAUDE.md",
							region: "attempt",
							firstLocator: { line: 1, block: 1 },
							measurement: { state: "complete", characters: 12 },
							observedDeliveryCount: 1,
							repeatDeliveryCount: 0,
							failedOccurrences: 0,
							partialOccurrences: 0,
							unavailableOccurrences: 0,
							eventIds: ["1:1", "2:1"],
						},
					],
					attemptEvents: [
						{
							id: "1:1",
							locator: { line: 1, block: 1 },
							region: "attempt",
							kind: "call",
							state: "invoked",
							label: "Read CLAUDE.md",
							toolUseId: "read-1",
							toolName: "Read",
							sourceId: "project:/work/CLAUDE.md",
							measurement: { state: "unavailable", reasons: ["not delivered"] },
							relatedEventIds: ["2:1"],
						},
						{
							id: "2:1",
							locator: { line: 2, block: 1 },
							region: "attempt",
							kind: "result",
							state: "delivered",
							label: "CLAUDE.md delivered",
							toolUseId: "read-1",
							sourceId: "project:/work/CLAUDE.md",
							measurement: { state: "complete", characters: 12 },
							relatedEventIds: ["1:1"],
							deliveryOrdinal: 1,
						},
					],
				},
			],
			[
				"/api/attempts/session/case-a/attempt-a/history/1:1",
				{
					schemaVersion: 1,
					eventId: "1:1",
					locator: { line: 1, block: 1 },
					state: "invoked",
					relatedEventIds: ["2:1"],
					deliveredMeasurement: {
						state: "unavailable",
						reasons: ["not delivered"],
					},
					snapshotMeasurement: {
						state: "unavailable",
						reasons: ["not recorded"],
					},
					applicationTruncated: false,
				},
			],
			[
				"/api/attempts/session/case-a/attempt-a/history/2:1",
				{
					schemaVersion: 1,
					eventId: "2:1",
					locator: { line: 2, block: 1 },
					state: "delivered",
					relatedEventIds: ["1:1"],
					deliveredText: "instruction body",
					deliveredMeasurement: { state: "complete", characters: 16 },
					sourceSnapshot: "source snapshot",
					snapshotMeasurement: { state: "complete", characters: 15 },
					applicationTruncated: false,
				},
			],
		]),
	);
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<SessionHistoryPage
				identity={{ kind: "standalone", caseId: "case-a", uuid: "attempt-a" }}
			/>
		</QueryClientProvider>,
	);
}

describe(SessionHistoryPage.name, () => {
	it("cross-selects a source and walks its events with j and k", async () => {
		renderPage();
		await screen.findByRole("heading", { name: "Saved context history" });
		fireEvent.click(screen.getByRole("button", { name: /CLAUDE.md/u }));
		const ledger = screen.getByRole("listbox", { name: "Attempt events" });
		expect(within(ledger).getAllByRole("option")).toHaveLength(2);

		fireEvent.keyDown(ledger, { key: "j" });
		await waitFor(() => {
			expect(screen.getByText("instruction body")).toBeInTheDocument();
			expect(screen.getByText("source snapshot")).toBeInTheDocument();
		});
		fireEvent.keyDown(ledger, { key: "k" });
		expect(
			within(ledger).getByRole("option", { selected: true }),
		).toHaveTextContent("Read CLAUDE.md");
	});
});
