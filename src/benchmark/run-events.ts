import { Database } from "bun:sqlite";

export type RunEventKind =
	| "stage-started"
	| "turn-completed"
	| "stage-completed"
	| "run-completed"
	| "run-interrupted";

export interface NewRunEvent {
	readonly runId: string;
	readonly kind: RunEventKind;
	readonly stage: string;
	readonly spentUsd: number;
	readonly elapsedMs: number;
}

export interface RunEvent extends NewRunEvent {
	readonly sequence: number;
	readonly recordedAt: string;
}

export interface RunEventStore {
	readonly append: (event: NewRunEvent) => RunEvent;
	readonly eventsSince: (
		runId: string,
		sequence: number,
	) => readonly RunEvent[];
	readonly latestEvent: (runId: string) => RunEvent | undefined;
	readonly runIds: () => readonly string[];
	readonly close: () => void;
}

const SCHEMA = `
	CREATE TABLE IF NOT EXISTS run_events (
		sequence INTEGER PRIMARY KEY AUTOINCREMENT,
		run_id TEXT NOT NULL,
		kind TEXT NOT NULL,
		stage TEXT NOT NULL,
		spent_usd REAL NOT NULL,
		elapsed_ms INTEGER NOT NULL,
		recorded_at TEXT NOT NULL
	);
	CREATE INDEX IF NOT EXISTS run_events_run_id ON run_events(run_id, sequence);
`;

interface RunEventRow {
	readonly sequence: number;
	readonly run_id: string;
	readonly kind: RunEventKind;
	readonly stage: string;
	readonly spent_usd: number;
	readonly elapsed_ms: number;
	readonly recorded_at: string;
}

function toRunEvent(row: RunEventRow): RunEvent {
	return {
		sequence: row.sequence,
		runId: row.run_id,
		kind: row.kind,
		stage: row.stage,
		spentUsd: row.spent_usd,
		elapsedMs: row.elapsed_ms,
		recordedAt: row.recorded_at,
	};
}

export function openRunEventStore(path: string): RunEventStore {
	const database = new Database(path);
	database.run(SCHEMA);

	const insert = database.query<
		RunEventRow,
		[string, RunEventKind, string, number, number, string]
	>(
		`INSERT INTO run_events (run_id, kind, stage, spent_usd, elapsed_ms, recorded_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 RETURNING *`,
	);
	const selectSince = database.query<RunEventRow, [string, number]>(
		"SELECT * FROM run_events WHERE run_id = ? AND sequence > ? ORDER BY sequence ASC",
	);
	const selectLatest = database.query<RunEventRow, [string]>(
		"SELECT * FROM run_events WHERE run_id = ? ORDER BY sequence DESC LIMIT 1",
	);
	const selectRunIds = database.query<{ run_id: string }, []>(
		"SELECT DISTINCT run_id FROM run_events",
	);

	return {
		append: (event) => {
			const row = insert.get(
				event.runId,
				event.kind,
				event.stage,
				event.spentUsd,
				event.elapsedMs,
				new Date().toISOString(),
			);
			if (row === null) {
				throw new Error("Failed to append run event");
			}

			return toRunEvent(row);
		},
		eventsSince: (runId, sequence) =>
			selectSince.all(runId, sequence).map((row) => toRunEvent(row)),
		latestEvent: (runId) => {
			const row = selectLatest.get(runId);

			return row === null ? undefined : toRunEvent(row);
		},
		runIds: () => selectRunIds.all().map((row) => row.run_id),
		close: () => {
			database.close();
		},
	};
}
