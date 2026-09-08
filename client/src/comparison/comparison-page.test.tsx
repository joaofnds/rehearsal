import { afterEach, describe, expect, it } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComparisonReport } from "#benchmark/comparison-record";
import type { ComparisonAttribution } from "#server/comparison-attribution";
import { stubFetchByPath } from "#client/test-support/fetch-stub";
import { ComparisonPage } from "./comparison-page";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

const DIGEST = "d".repeat(64);

type ReportArm = ComparisonReport["cases"][number]["arms"]["baseline"];

const CANDIDATE_CLEARS = Object.fromEntries([
	["A", 3],
	["D", 1],
]);
const BASELINE_LAGS = Object.fromEntries([
	["A", 1],
	["D", 3],
]);

function arm(
	role: ReportArm["role"],
	hash: string,
	gradeDistribution: Readonly<Record<string, number>>,
): ReportArm {
	return {
		role,
		source: {
			group: { path: "group.json", sha256: "0".repeat(64) },
			reps: [
				{
					path: "rep.json",
					sha256: "0".repeat(64),
					repId: "rep-1",
					ordinal: 1,
				},
			],
		},
		executedCorpus: [{ path: "CLAUDE.md", sha256: hash.repeat(64) }],
		quality: [
			{
				name: "final",
				requested: 4,
				attempted: 4,
				notReached: 0,
				failed: 0,
				successful: 4,
				gradeDistribution,
				successRate: 1,
				standardError: 0,
				passK: 1,
			},
		],
		resources: {
			status: "UNAVAILABLE",
			completeReps: 0,
			missingMetricReps: 1,
			missingEvidence: [{ repId: "rep-1", ordinal: 1, missing: ["worker"] }],
		},
	};
}

interface ComparisonResponseFixture {
	readonly report: { readonly cases: ComparisonReport["cases"] };
	readonly attribution: Readonly<
		Record<string, Readonly<Record<string, ComparisonAttribution>>>
	>;
}

function comparisonResponseBody(): ComparisonResponseFixture {
	return {
		report: {
			cases: [
				{
					caseId: "case-1",
					arms: {
						baseline: arm("baseline", "1", BASELINE_LAGS),
						candidate: arm("candidate", "2", CANDIDATE_CLEARS),
						control: arm("control", "3", BASELINE_LAGS),
					},
				},
			],
		},
		attribution: {
			"case-1": {
				candidateMinusBaseline: {
					claim: "refused",
					differingPaths: ["CLAUDE.md"],
				},
			},
		},
	};
}

function renderPage(): void {
	stubFetchByPath(
		new Map([[`/api/comparisons/${DIGEST}`, comparisonResponseBody()]]),
	);
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<ComparisonPage digest={DIGEST} />
		</QueryClientProvider>,
	);
}

describe(ComparisonPage.name, () => {
	it("renders one row per case, not per attempt pair", async () => {
		renderPage();

		await waitFor(() => {
			expect(screen.getByText("case-1")).toBeInTheDocument();
		});
	});

	it("renders each arm's grade distribution as counts, never a synthesized median", async () => {
		renderPage();

		await waitFor(() => {
			expect(screen.getByText("case-1")).toBeInTheDocument();
		});
		expect(screen.getAllByText("A×3").length).toBeGreaterThan(0);
		expect(screen.getAllByText("D×1").length).toBeGreaterThan(0);
		expect(screen.queryByText(/range/iu)).not.toBeInTheDocument();
	});

	it("shows the attempt-pairs table by default, with both switcher options offered", async () => {
		renderPage();

		await waitFor(() => {
			expect(screen.getByText("case-1")).toBeInTheDocument();
		});
		expect(
			screen.getByRole("button", { name: "Attempt pairs", pressed: true }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "What moved", pressed: false }),
		).toBeInTheDocument();
	});

	it("renders the planned-feature block instead of a working tab when What moved is selected", async () => {
		renderPage();

		await waitFor(() => {
			expect(screen.getByText("case-1")).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole("button", { name: "What moved" }));

		expect(screen.getByText("PLANNED")).toBeInTheDocument();
		expect(screen.queryByRole("table")).not.toBeInTheDocument();
	});

	it("refuses the attribution claim and lists the differing paths when the corpora disagree", async () => {
		renderPage();

		await waitFor(() => {
			expect(screen.getByText("case-1")).toBeInTheDocument();
		});
		expect(
			screen.getByText(/refuses the attribution claim/iu),
		).toBeInTheDocument();
		expect(screen.getByText("CLAUDE.md")).toBeInTheDocument();
	});

	it("renders the empty state, not a generic error, when no comparison is recorded for the digest", async () => {
		const stub = (): Promise<Response> =>
			Promise.resolve(Response.json({ error: "not found" }, { status: 404 }));
		stub.preconnect = fetch.preconnect;
		globalThis.fetch = stub;
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={client}>
				<ComparisonPage digest={DIGEST} />
			</QueryClientProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("No comparison recorded")).toBeInTheDocument();
		});
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("reports no corpus difference, never a false attribution, when the two arms' corpora are identical", async () => {
		stubFetchByPath(
			new Map([
				[
					`/api/comparisons/${DIGEST}`,
					{
						...comparisonResponseBody(),
						attribution: {
							"case-1": {
								candidateMinusBaseline: { claim: "identical" },
							},
						},
					},
				],
			]),
		);
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		render(
			<QueryClientProvider client={client}>
				<ComparisonPage digest={DIGEST} />
			</QueryClientProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("case-1")).toBeInTheDocument();
		});
		expect(
			screen.getByText(/no corpus difference between these arms/iu),
		).toBeInTheDocument();
		expect(
			screen.queryByText(/refuses the attribution claim/iu),
		).not.toBeInTheDocument();
	});
});
