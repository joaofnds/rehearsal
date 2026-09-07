import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { InferResponseType } from "hono/client";
import { apiClient } from "#client/api-client";
import { CorpusPill } from "#client/system/components/corpus-pill";
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

const COLUMNS = ["Run", "Case", "Outcome", "Grade", "Corpus"] as const;

const FILTERS = ["All", "Stopped"] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(row: RunHistoryRow, filter: Filter): boolean {
	return filter === "All" || row.status.startsWith("STOPPED:");
}

async function fetchRunHistoryRows(): Promise<readonly RunHistoryRow[]> {
	const response = await apiClient.api.runs.$get();
	const body = await response.json();

	return body.rows;
}

function outcomeCell(row: RunHistoryRow): React.JSX.Element {
	return (
		<span className="rh-run-history__outcome">
			<Status state={runStatusState(row.status)} />
			<span className="rh-run-history__outcome-detail">{row.status}</span>
		</span>
	);
}

function corpusCell(row: RunHistoryRow): React.JSX.Element {
	if (row.corpus === undefined) {
		return <span className="rh-run-history__no-corpus">—</span>;
	}

	return (
		<span className="rh-run-history__corpus">
			<CorpusPill hash={row.corpus.digest} />
			<Status state={row.stale ? "stale" : "clear"} />
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

function EmptyState(): React.JSX.Element {
	return (
		<div className="rh-run-history__empty">
			<h2>No runs recorded</h2>
			<p>
				The corpus is linked and a spend limit is set. Declare a case, then run
				it — every attempt lands here as a durable record.
			</p>
			<button type="button" disabled>
				Declare a case
			</button>
		</div>
	);
}

export function RunHistoryPage(): React.JSX.Element {
	const [filter, setFilter] = useState<Filter>("All");
	const query = useQuery({
		queryKey: ["run-history"],
		queryFn: fetchRunHistoryRows,
	});

	const rows = (query.data ?? []).filter((row) => matchesFilter(row, filter));

	return (
		<main className="rh-run-history">
			<h1>Run history</h1>
			<FilterBar active={filter} onSelect={setFilter} />

			{query.isLoading ? <p>Loading…</p> : null}
			{query.isError ? <p role="alert">Could not load run history.</p> : null}

			{query.isSuccess && rows.length === 0 ? <EmptyState /> : null}

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
