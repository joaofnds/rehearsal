import { useQuery } from "@tanstack/react-query";
import { CorpusPill } from "#client/system/components/corpus-pill";
import { SectionLabel } from "#client/system/components/section-label";
import { Status } from "#client/system/components/status";
import { TableShell } from "#client/system/components/table-shell";
import type { RunHistoryRow } from "./run-history-row";
import { runHistoryResponseSchema } from "./run-history-row";
import { runStatusState } from "./run-status";
import "./run-history-page.css";

const COLUMNS = ["Run", "Case", "Outcome", "Corpus"] as const;

async function fetchRunHistoryRows(): Promise<readonly RunHistoryRow[]> {
	const response = await fetch("/api/runs");
	const body: unknown = await response.json();

	return runHistoryResponseSchema.parse(body).rows;
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
	const query = useQuery({
		queryKey: ["run-history"],
		queryFn: fetchRunHistoryRows,
	});

	const rows = query.data ?? [];

	return (
		<main className="rh-run-history">
			<h1>Run history</h1>

			{query.isLoading ? <p>Loading…</p> : null}
			{query.isError ? <p role="alert">Could not load run history.</p> : null}

			{query.isSuccess && rows.length === 0 ? <EmptyState /> : null}

			{rows.length > 0 ? (
				<>
					<SectionLabel>DURABLE RECORDS</SectionLabel>
					<TableShell
						caption="DURABLE RECORDS"
						columns={[...COLUMNS]}
						rows={rows.map((row) => [
							row.run,
							row.caseId,
							outcomeCell(row),
							corpusCell(row),
						])}
					/>
				</>
			) : null}
		</main>
	);
}
