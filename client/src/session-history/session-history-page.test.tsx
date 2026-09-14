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

function renderStandalonePage(): void {
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
					boundary: "known",
					startingContext: [],
					boundaryUnknown: [],
					startingSources: [],
					sources: [
						{
							id: "unclassified",
							kind: "unclassified",
							name: "Unclassified recorded content",
							region: "attempt",
							firstLocator: { line: 3, block: 1 },
							measurement: {
								state: "partial",
								observedCharacters: 20,
								reasons: ["mixed body"],
							},
							observedDeliveryCount: 0,
							repeatDeliveryCount: 0,
							failedOccurrences: 0,
							partialOccurrences: 1,
							missingOccurrences: 0,
							unavailableOccurrences: 0,
							eventIds: ["3:1"],
						},
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
							missingOccurrences: 0,
							unavailableOccurrences: 0,
							eventIds: ["1:1", "2:1"],
						},
						{
							id: "tool-output:4:1",
							kind: "tool-output",
							name: "Bash · 4:1",
							region: "attempt",
							firstLocator: { line: 4, block: 1 },
							measurement: { state: "complete", characters: 8 },
							observedDeliveryCount: 0,
							repeatDeliveryCount: 0,
							failedOccurrences: 0,
							partialOccurrences: 0,
							missingOccurrences: 0,
							unavailableOccurrences: 0,
							eventIds: ["4:1"],
						},
						{
							id: "external:/outside.txt",
							kind: "external",
							name: "/outside.txt",
							path: "/outside.txt",
							region: "attempt",
							firstLocator: { line: 5, block: 1 },
							measurement: {
								state: "unavailable",
								reasons: ["unsupported text body"],
							},
							observedDeliveryCount: 0,
							repeatDeliveryCount: 0,
							failedOccurrences: 0,
							partialOccurrences: 0,
							missingOccurrences: 1,
							unavailableOccurrences: 1,
							eventIds: [],
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
							timestamp: "2026-09-14T10:00:00.000Z",
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
						{
							id: "3:1",
							locator: { line: 3, block: 1 },
							region: "attempt",
							kind: "unclassified",
							state: "partial",
							label: "Unclassified recorded content",
							sourceId: "unclassified",
							measurement: {
								state: "partial",
								observedCharacters: 20,
								reasons: ["mixed body"],
							},
							relatedEventIds: [],
						},
						{
							id: "4:1",
							locator: { line: 4, block: 1 },
							region: "attempt",
							kind: "result",
							state: "recorded",
							label: "Bash result",
							sourceId: "tool-output:4:1",
							measurement: { state: "complete", characters: 8 },
							relatedEventIds: [],
						},
					],
					diagnostics: {
						state: "partial",
						prefixLinesExcluded: 0,
						sourceLineCount: 3,
						measuredLineCount: 3,
						toolUseOccurrences: { total: 1, byName: [] },
						toolErrors: [
							{
								toolUseId: "failed-1",
								result: { line: 3, block: 1 },
							},
						],
						repeatedBashCommands: [],
						issues: [],
					},
				},
			],
			[
				"/api/attempts/session/case-a/attempt-a/history/4:1",
				{
					schemaVersion: 1,
					eventId: "4:1",
					locator: { line: 4, block: 1 },
					kind: "result",
					state: "recorded",
					relatedEventIds: [],
					deliveredText: "command output",
					deliveredMeasurement: { state: "complete", characters: 14 },
					snapshotMeasurement: {
						state: "unavailable",
						reasons: ["not recorded"],
					},
					applicationTruncated: false,
				},
			],
			[
				"/api/attempts/session/case-a/attempt-a/history/3:1",
				{
					schemaVersion: 1,
					eventId: "3:1",
					locator: { line: 3, block: 1 },
					kind: "unclassified",
					state: "partial",
					relatedEventIds: [],
					deliveredText: "partial recorded body",
					deliveredMeasurement: {
						state: "partial",
						observedCharacters: 20,
						reasons: ["mixed body"],
					},
					snapshotMeasurement: {
						state: "unavailable",
						reasons: ["not recorded"],
					},
					applicationTruncated: false,
				},
			],
			[
				"/api/attempts/session/case-a/attempt-a/history/1:1",
				{
					schemaVersion: 1,
					eventId: "1:1",
					locator: { line: 1, block: 1 },
					kind: "call",
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
					kind: "result",
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
	renderStandalonePage();
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
		fireEvent.click(screen.getByRole("button", { name: /CLAUDE.md/u }));
		expect(
			within(ledger).getByRole("option", { selected: true }),
		).toHaveTextContent("CLAUDE.md delivered");
		fireEvent.click(screen.getByRole("button", { name: /All sources/u }));
		expect(
			within(ledger).getByRole("option", { selected: true }),
		).toHaveTextContent("CLAUDE.md delivered");
		fireEvent.keyDown(ledger, { key: "k" });
		expect(
			within(ledger).getByRole("option", { selected: true }),
		).toHaveTextContent("Read CLAUDE.md");
		expect(
			screen.getByRole("button", { name: /CLAUDE.md/u }),
		).toHaveTextContent(
			"✓ Complete · 12 recorded text characters — not tokens",
		);
	});

	it("shows auditable source sorts and lets diagnostics clear a source filter", async () => {
		renderPage();
		await screen.findByRole("heading", { name: "Saved context history" });
		const sources = screen.getByRole("navigation", { name: "Loaded sources" });
		const sourceNames = (): string[] =>
			within(sources)
				.getAllByRole("button")
				.slice(1)
				.map((button) => button.textContent ?? "");

		expect(sourceNames()[0]).toContain("Unclassified recorded content");
		expect(sourceNames()[1]).toContain("CLAUDE.md");
		expect(sourceNames()[2]).toContain("Bash · 4:1");
		expect(sourceNames()[3]).toContain("/outside.txt");
		expect(sourceNames()[0]).toContain(
			"◐ Partial · 20 observed recorded text characters — not tokens · mixed body",
		);
		expect(sourceNames()[3]).toContain("? Unavailable · unsupported text body");

		fireEvent.click(screen.getByRole("button", { name: "Most repeated" }));
		expect(sourceNames()[0]).toContain("CLAUDE.md");
		expect(sourceNames()[1]).toContain("Unclassified recorded content");

		fireEvent.click(screen.getByRole("button", { name: /CLAUDE.md/u }));
		fireEvent.click(screen.getByRole("button", { name: /Tool error result/u }));
		await waitFor(() => {
			expect(screen.getByText("partial recorded body")).toBeInTheDocument();
		});
		expect(
			screen.getByRole("button", { name: /All sources/u }),
		).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByText("2026-09-14T10:00:00.000Z")).toBeInTheDocument();
		expect(screen.queryByText("undefined")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /Bash · 4:1/u }));
		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Saved result content" }),
			).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: /outside\.txt/u }));
		expect(
			screen.getByText("No events match this source."),
		).toBeInTheDocument();
	});

	it("names an empty historical attempt as boundary unknown", async () => {
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
						evidence: {
							state: "partial",
							reasons: ["empty transcript", "attempt boundary unavailable"],
						},
						boundary: "unknown",
						startingContext: [],
						attemptEvents: [],
						boundaryUnknown: [],
						startingSources: [],
						sources: [],
					},
				],
			]),
		);
		renderStandalonePage();

		await screen.findByRole("heading", { name: "Saved context history" });
		expect(screen.getByText("Boundary unknown")).toBeInTheDocument();
		expect(
			screen.getByText("? Unavailable · boundary unknown"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Boundary-unknown events" }),
		).toBeInTheDocument();
	});
});
