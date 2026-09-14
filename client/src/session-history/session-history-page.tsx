import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type {
	SessionHistoryDetail,
	SessionHistoryEvent,
	SessionHistoryReport,
	SessionHistorySource,
	TextMeasurement,
} from "#benchmark/session-history";
import { apiClient } from "#client/api-client";
import "./session-history-page.css";

export type SessionHistoryIdentity =
	| {
			readonly kind: "standalone";
			readonly caseId: string;
			readonly uuid: string;
	  }
	| {
			readonly kind: "confirmation";
			readonly groupId: string;
			readonly repId: string;
	  };

type SourceSort = "introduced" | "repeated";

function summaryPath(identity: SessionHistoryIdentity): string {
	return identity.kind === "standalone"
		? `/api/attempts/session/${encodeURIComponent(identity.caseId)}/${encodeURIComponent(identity.uuid)}/history`
		: `/api/groups/${encodeURIComponent(identity.groupId)}/reps/${encodeURIComponent(identity.repId)}/attempt/history`;
}

async function fetchSummary(
	identity: SessionHistoryIdentity,
): Promise<SessionHistoryReport> {
	const response =
		identity.kind === "standalone"
			? await apiClient.api.attempts.session[":caseId"][":uuid"].history.$get({
					param: { caseId: identity.caseId, uuid: identity.uuid },
				})
			: await apiClient.api.groups[":groupId"].reps[
					":repId"
				].attempt.history.$get({
					param: { groupId: identity.groupId, repId: identity.repId },
				});
	if (!response.ok) {
		throw new Error(`Request failed with ${response.status}`);
	}

	return response.json();
}

async function fetchDetail(
	identity: SessionHistoryIdentity,
	eventId: string,
): Promise<SessionHistoryDetail> {
	const response =
		identity.kind === "standalone"
			? await apiClient.api.attempts.session[":caseId"][":uuid"].history[
					":eventId"
				].$get({
					param: { caseId: identity.caseId, uuid: identity.uuid, eventId },
				})
			: await apiClient.api.groups[":groupId"].reps[":repId"].attempt.history[
					":eventId"
				].$get({
					param: { groupId: identity.groupId, repId: identity.repId, eventId },
				});
	if (!response.ok) {
		throw new Error(`Request failed with ${response.status}`);
	}

	return response.json();
}

function measurementLabel(measurement: TextMeasurement): string {
	if (measurement.state === "complete") {
		return `${measurement.characters} Unicode code points`;
	}
	if (measurement.state === "partial") {
		return `${measurement.observedCharacters} observed Unicode code points · partial`;
	}

	return `Unavailable · ${measurement.reasons.join(", ")}`;
}

function locatorLabel(event: SessionHistoryEvent): string {
	return `${event.locator.line}:${event.locator.block}`;
}

function sortedSources(
	sources: readonly SessionHistorySource[],
	sort: SourceSort,
): readonly SessionHistorySource[] {
	return sources.toSorted((left, right) => {
		if (sort === "repeated") {
			const repeats =
				(right.repeatDeliveryCount ?? -1) - (left.repeatDeliveryCount ?? -1);
			if (repeats !== 0) {
				return repeats;
			}
		}
		const line = left.firstLocator.line - right.firstLocator.line;
		if (line !== 0) {
			return line;
		}
		const block = left.firstLocator.block - right.firstLocator.block;
		if (block !== 0) {
			return block;
		}

		return left.name.localeCompare(right.name);
	});
}

function SourceList({
	sources,
	selected,
	sort,
	onSelect,
}: {
	readonly sources: readonly SessionHistorySource[];
	readonly selected: string | undefined;
	readonly sort: SourceSort;
	readonly onSelect: (source: SessionHistorySource | undefined) => void;
}): React.JSX.Element {
	return (
		<nav className="rh-history__sources" aria-label="Loaded sources">
			<button
				type="button"
				className="rh-history__source"
				aria-pressed={selected === undefined}
				onClick={() => {
					onSelect(undefined);
				}}
			>
				<span>All sources</span>
				<span>{sources.length}</span>
			</button>
			{sortedSources(sources, sort).map((source) => (
				<button
					type="button"
					key={source.id}
					className="rh-history__source"
					aria-pressed={selected === source.id}
					onClick={() => {
						onSelect(source);
					}}
				>
					<span>
						<strong>{source.name}</strong>
						<small>{source.kind}</small>
					</span>
					<span className="rh-history__count">
						{source.repeatDeliveryCount === undefined
							? "?"
							: `${source.repeatDeliveryCount}×`}
					</span>
				</button>
			))}
		</nav>
	);
}

function EventLedger({
	events,
	selected,
	onSelect,
}: {
	readonly events: readonly SessionHistoryEvent[];
	readonly selected: string | undefined;
	readonly onSelect: (id: string) => void;
}): React.JSX.Element {
	const active = selected ?? events[0]?.id;
	const move = (delta: number): void => {
		const index = Math.max(
			0,
			events.findIndex(({ id }) => id === active),
		);
		const next =
			events[Math.min(events.length - 1, Math.max(0, index + delta))];
		if (next !== undefined) {
			onSelect(next.id);
		}
	};

	return (
		<div
			className="rh-history__ledger"
			role="listbox"
			aria-label="Attempt events"
			tabIndex={0}
			onKeyDown={(event) => {
				if (event.key === "j" || event.key === "k") {
					event.preventDefault();
					move(event.key === "j" ? 1 : -1);
				}
			}}
		>
			{events.map((event) => (
				<button
					type="button"
					role="option"
					aria-selected={event.id === active}
					className="rh-history__event"
					key={event.id}
					onClick={() => {
						onSelect(event.id);
					}}
				>
					<code>{locatorLabel(event)}</code>
					<span>{event.label}</span>
					<small>{event.state}</small>
				</button>
			))}
			{events.length === 0 ? <p>No events match this source.</p> : null}
		</div>
	);
}

function DetailPane({
	detail,
}: {
	readonly detail: SessionHistoryDetail;
}): React.JSX.Element {
	return (
		<div className="rh-history__detail-body">
			<header>
				<code>{`${detail.locator.line}:${detail.locator.block}`}</code>
				<span>{detail.state}</span>
			</header>
			<section>
				<h3>Observed delivery</h3>
				<p className="rh-history__measurement">
					{measurementLabel(detail.deliveredMeasurement)}
				</p>
				{detail.deliveredText === undefined ? (
					<p>Content unavailable.</p>
				) : (
					<pre>{detail.deliveredText}</pre>
				)}
			</section>
			<section>
				<h3>Structured source snapshot</h3>
				<p className="rh-history__measurement">
					{measurementLabel(detail.snapshotMeasurement)}
				</p>
				{detail.sourceSnapshot === undefined ? (
					<p>Snapshot unavailable.</p>
				) : (
					<pre>{detail.sourceSnapshot}</pre>
				)}
			</section>
			{detail.applicationTruncated ? (
				<p className="rh-history__notice">
					Display capped at 65,536 UTF-8 bytes.
				</p>
			) : null}
		</div>
	);
}

export function SessionHistoryPage({
	identity,
}: {
	readonly identity: SessionHistoryIdentity;
}): React.JSX.Element {
	const path = summaryPath(identity);
	const [sourceId, setSourceId] = useState<string>();
	const [selectedEventId, setSelectedEventId] = useState<string>();
	const [sourceSort, setSourceSort] = useState<SourceSort>("introduced");
	const summary = useQuery({
		queryKey: ["session-history", path],
		queryFn: () => fetchSummary(identity),
	});
	const events = useMemo(() => {
		const all = summary.data?.attemptEvents ?? [];
		return sourceId === undefined
			? all
			: all.filter((event) => event.sourceId === sourceId);
	}, [sourceId, summary.data]);
	const activeEventId = events.some(({ id }) => id === selectedEventId)
		? selectedEventId
		: events[0]?.id;
	const detail = useQuery({
		queryKey: ["session-history-detail", path, activeEventId],
		queryFn: () => fetchDetail(identity, activeEventId ?? ""),
		enabled: activeEventId !== undefined,
	});

	return (
		<main className="rh-history">
			<a className="rh-history__back" href="/">
				← Back to run history
			</a>
			<header className="rh-history__header">
				<div>
					<p className="rh-history__eyebrow">ATTEMPT EVIDENCE</p>
					<h1>Saved context history</h1>
				</div>
				{summary.data === undefined ? null : (
					<dl>
						<div>
							<dt>Case</dt>
							<dd>{summary.data.attempt.caseId}</dd>
						</div>
						<div>
							<dt>Attempt</dt>
							<dd>{summary.data.attempt.id}</dd>
						</div>
						<div>
							<dt>Model</dt>
							<dd>{summary.data.attempt.model}</dd>
						</div>
						<div>
							<dt>Outcome</dt>
							<dd>{summary.data.attempt.outcome}</dd>
						</div>
					</dl>
				)}
			</header>
			{summary.isLoading ? <p>Loading history…</p> : null}
			{summary.isError ? (
				<p role="alert">Could not load saved history.</p>
			) : null}
			{summary.data === undefined ? null : (
				<>
					<section
						className="rh-history__starting"
						aria-label="Starting context"
					>
						<span>
							{summary.data.evidence.state === "unavailable"
								? "Boundary unknown"
								: "Starting context"}
						</span>
						<strong>
							{summary.data.startingContext.length > 0
								? summary.data.startingContext.length
								: summary.data.boundaryUnknown.length}{" "}
							recorded events
						</strong>
					</section>
					<div className="rh-history__toolbar">
						<span>Sort sources</span>
						<button
							type="button"
							aria-pressed={sourceSort === "introduced"}
							onClick={() => {
								setSourceSort("introduced");
							}}
						>
							Introduced
						</button>
						<button
							type="button"
							aria-pressed={sourceSort === "repeated"}
							onClick={() => {
								setSourceSort("repeated");
							}}
						>
							Most repeated
						</button>
					</div>
					<div className="rh-history__workbench">
						<SourceList
							sources={summary.data.sources}
							selected={sourceId}
							sort={sourceSort}
							onSelect={(source) => {
								setSourceId(source?.id);
								setSelectedEventId(source?.eventIds[0]);
							}}
						/>
						<section className="rh-history__events" aria-label="Event ledger">
							<h2>Attempt events</h2>
							<EventLedger
								events={events}
								selected={activeEventId}
								onSelect={setSelectedEventId}
							/>
						</section>
						<aside className="rh-history__detail" aria-label="Event detail">
							<h2>Evidence detail</h2>
							{detail.isLoading ? <p>Loading evidence…</p> : null}
							{detail.isError ? (
								<p role="alert">Could not load event evidence.</p>
							) : null}
							{detail.data === undefined ? null : (
								<DetailPane detail={detail.data} />
							)}
						</aside>
					</div>
				</>
			)}
		</main>
	);
}
