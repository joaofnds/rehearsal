import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { InferResponseType } from "hono/client";
import { apiClient } from "#client/api-client";
import { CorpusPill } from "#client/system/components/corpus-pill";
import { Disclosure } from "#client/system/components/disclosure";
import { EmptyState } from "#client/system/components/empty-state";
import { FilterPill } from "#client/system/components/filter-pill";
import type { GradeValue } from "#client/system/components/grade";
import { Grade } from "#client/system/components/grade";
import { Status } from "#client/system/components/status";
import { TableShell } from "#client/system/components/table-shell";
import { runStatusState } from "./run-status";
import "./run-history-page.css";

/**
 * The row shape comes from the server's own route type via Hono's RPC
 * client, `apiClient.api.runs.$get`, rather than a hand-declared schema
 * repeating what `src/server/run-history.ts`'s `RunHistoryRow` already
 * states (decision-3's stated reason for choosing Hono).
 */
type RunHistoryResponse = InferResponseType<typeof apiClient.api.runs.$get>;
type RunHistoryRow = RunHistoryResponse["rows"][number];
type UnreadableRun = RunHistoryResponse["unreadable"][number];

const COLUMNS = ["Run", "Case", "Outcome", "Grade", "Corpus"] as const;

const FILTERS = ["All", "Stopped"] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(row: RunHistoryRow, filter: Filter): boolean {
	return filter === "All" || row.status.startsWith("STOPPED:");
}

async function fetchRunHistoryReport(): Promise<RunHistoryResponse> {
	const response = await apiClient.api.runs.$get();

	return response.json();
}

function UnreadableRuns({
	runs,
}: {
	readonly runs: readonly UnreadableRun[];
}): React.JSX.Element {
	return (
		<div className="rh-run-history__unreadable" role="alert">
			<p>
				These runs could not be read, so they are missing from the table below:
			</p>
			<ul>
				{runs.map((run) => (
					<li key={run.id}>{`${run.id} — ${run.reason}`}</li>
				))}
			</ul>
		</div>
	);
}

function outcomeCell(row: RunHistoryRow): React.JSX.Element {
	return (
		<span className="rh-run-history__outcome">
			<Status state={runStatusState(row.status)} />
			<span className="rh-run-history__outcome-detail">{row.status}</span>
		</span>
	);
}

function causeList(
	staleCauses: readonly string[],
): readonly React.JSX.Element[] {
	return staleCauses.map((cause) => (
		<span key={cause} className="rh-run-history__cause">
			{cause}
		</span>
	));
}

function causesFor(staleCauses: readonly string[]): React.ReactNode {
	if (staleCauses.length <= 1) {
		return causeList(staleCauses);
	}

	return (
		<Disclosure
			collapsedLabel={`${staleCauses.length} causes`}
			expandedLabel="hide causes"
		>
			{causeList(staleCauses)}
		</Disclosure>
	);
}

function corpusCell(row: RunHistoryRow): React.JSX.Element {
	if (row.corpus === undefined && !row.stale) {
		return <span className="rh-run-history__no-corpus">—</span>;
	}

	return (
		<span className="rh-run-history__corpus">
			{row.corpus === undefined ? null : (
				<CorpusPill hash={row.corpus.digest} />
			)}
			<Status state={row.stale ? "stale" : "clear"} />
			{causesFor(row.staleCauses)}
		</span>
	);
}

function gradeCell(row: RunHistoryRow): React.JSX.Element {
	const value: GradeValue =
		row.grade === undefined ? { pending: true } : { letter: row.grade };

	return <Grade value={value} size="13" />;
}

function FilterBar({
	active,
	onSelect,
}: {
	readonly active: Filter;
	readonly onSelect: (filter: Filter) => void;
}): React.JSX.Element {
	return (
		<div className="rh-run-history__filters">
			{FILTERS.map((filter) => (
				<FilterPill
					key={filter}
					pressed={filter === active}
					onPress={() => {
						onSelect(filter);
					}}
				>
					{filter}
				</FilterPill>
			))}
		</div>
	);
}

export function RunHistoryPage(): React.JSX.Element {
	const [filter, setFilter] = useState<Filter>("All");
	const query = useQuery({
		queryKey: ["run-history"],
		queryFn: fetchRunHistoryReport,
	});

	const unreadable = query.data?.unreadable ?? [];
	const recorded = query.data?.rows ?? [];
	const rows = recorded.filter((row) => matchesFilter(row, filter));
	const onlyUnreadableRuns = recorded.length === 0 && unreadable.length > 0;

	return (
		<main className="rh-run-history">
			<h1>Run history</h1>
			<FilterBar active={filter} onSelect={setFilter} />

			{query.isLoading ? <p>Loading…</p> : null}
			{query.isError ? <p role="alert">Could not load run history.</p> : null}

			{unreadable.length > 0 ? <UnreadableRuns runs={unreadable} /> : null}

			{query.isSuccess && rows.length === 0 && !onlyUnreadableRuns ? (
				<EmptyState heading="No runs recorded">
					<p>
						The corpus is linked and a spend limit is set. Declare a case, then
						run it. Every attempt lands here as a durable record.
					</p>
					<button type="button" disabled>
						Declare a case
					</button>
				</EmptyState>
			) : null}

			{rows.length > 0 ? (
				<TableShell
					caption="DURABLE RECORDS"
					columns={[...COLUMNS]}
					rows={rows.map((row) => [
						row.run,
						row.caseId,
						outcomeCell(row),
						gradeCell(row),
						corpusCell(row),
					])}
				/>
			) : null}
		</main>
	);
}
