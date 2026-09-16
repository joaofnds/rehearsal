import type {
	SessionHistoryAttemptCost,
	SessionHistoryCostReading,
	SessionHistoryRequestCost,
	SessionHistoryRequestEntry,
	SessionHistoryRequestSeries,
} from "#benchmark/session-history";
import type { SessionHistoryRequestCostEntry } from "#server/session-history-reader";
import type { TranscriptInstructionLoads } from "#benchmark/transcript-instruction-loads";

const tokens = new Intl.NumberFormat("en-US");
const usd = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
	maximumFractionDigits: 6,
});

export function requestRowId(entry: SessionHistoryRequestEntry): string {
	return `${entry.line}`;
}

function requestCostLabel(cost: SessionHistoryRequestCost | undefined): string {
	if (cost === undefined) {
		return "not priced outside the attempt region";
	}

	return cost.state === "priced"
		? usd.format(cost.costUsd)
		: `? Unpriced · ${cost.reason}`;
}

function costLabel(reading: SessionHistoryCostReading): string {
	if (reading.state === "unavailable") {
		return `? Unavailable · ${reading.reasons.join(", ")}`;
	}
	if (reading.state === "incomplete") {
		return `◐ Incomplete · ${usd.format(reading.costUsd)} over ${reading.pricedRequestCount} of ${reading.requestCount} requests · ${reading.reasons.join(", ")}`;
	}

	return `✓ Complete · ${usd.format(reading.costUsd)}`;
}

function totalsLabel(series: SessionHistoryRequestSeries): string {
	const { attemptTotals } = series;
	if (attemptTotals.state === "unavailable") {
		return `? Unavailable · ${attemptTotals.reasons.join(", ")}`;
	}
	if (attemptTotals.state === "incomplete") {
		return `◐ Incomplete · ${tokens.format(attemptTotals.totalInputTokens)} total input tokens over ${attemptTotals.countedRequestCount} of ${attemptTotals.requestCount} requests · ${attemptTotals.reasons.join(", ")}`;
	}

	return `✓ Complete · ${tokens.format(attemptTotals.totalInputTokens)} total input tokens over ${attemptTotals.requestCount} attempt requests`;
}

/**
 * A row's share of the widest total in the series, so a fall between two
 * requests renders as a fall. Scaling each row against its own value, or
 * against a running maximum, would flatten every row to full width and hide
 * exactly the shape the timeline exists to show.
 */
function barWidth(
	entry: SessionHistoryRequestEntry,
	widest: number,
): string | undefined {
	if (entry.usageState !== "complete" || widest === 0) {
		return undefined;
	}

	return `${(entry.totalInputTokens / widest) * 100}%`;
}

/**
 * Measured over every entry rather than the filtered rows, so filtering the
 * panes does not rescale the bars and make a narrowed view look different
 * from the same requests in the full one.
 */
function widestTotal(entries: readonly SessionHistoryRequestEntry[]): number {
	let widest = 0;
	for (const entry of entries) {
		if (entry.usageState === "complete") {
			widest = Math.max(widest, entry.totalInputTokens);
		}
	}

	return widest;
}

function categoryLabel(entry: SessionHistoryRequestEntry): string {
	if (entry.usageState !== "complete") {
		return "usage conflict";
	}
	const { usage } = entry;

	return [
		`in ${tokens.format(usage.inputTokens)}`,
		`out ${tokens.format(usage.outputTokens)}`,
		`read ${tokens.format(usage.cacheReadTokens)}`,
		`write ${tokens.format(usage.cacheWriteTokens)}`,
	].join(" · ");
}

function modelLabel(entry: SessionHistoryRequestEntry): string {
	if (entry.modelState === "conflict") {
		return "model conflict";
	}

	return entry.model ?? "? Unavailable model";
}

function InstructionLoads({
	loads,
}: {
	readonly loads: TranscriptInstructionLoads;
}): React.JSX.Element {
	if (loads.state === "unavailable") {
		return (
			<p className="rh-timeline__note">
				? Unavailable · the transcript carries no instructions attachment.
			</p>
		);
	}

	return (
		<ul className="rh-timeline__loads">
			{loads.loads.map((load) => (
				<li key={`${load.memoryType}:${load.filePath}`}>
					<code>{load.filePath}</code>
					<small>{load.memoryType}</small>
					<small>
						reason, trigger and include parent unavailable in the transcript
					</small>
				</li>
			))}
			{loads.loads.length === 0 ? (
				<li>The attachment names no loaded file.</li>
			) : null}
		</ul>
	);
}

export function RequestTimeline({
	series,
	entries,
	cost,
	requestCosts,
	instructionLoads,
	selected,
	onSelect,
}: {
	readonly series: SessionHistoryRequestSeries;
	/** The rows to show, which the source filter narrows from series.entries. */
	readonly entries: readonly SessionHistoryRequestEntry[];
	readonly cost: SessionHistoryAttemptCost;
	readonly requestCosts: readonly SessionHistoryRequestCostEntry[];
	readonly instructionLoads: TranscriptInstructionLoads;
	readonly selected: string | undefined;
	readonly onSelect: (entry: SessionHistoryRequestEntry) => void;
}): React.JSX.Element {
	const widest = widestTotal(series.entries);
	const compactedLines = new Set(
		series.compactions.map((compaction) => compaction.line),
	);
	const costByLine = new Map(
		requestCosts.map((entry) => [entry.line, entry.cost]),
	);

	return (
		<section className="rh-timeline" aria-label="Request timeline">
			<h2>Request timeline</h2>
			<p className="rh-timeline__note">
				{series.name}. The provider's active context window is not measured:
				this number omits {series.omits.join(" and ")}.
			</p>
			<dl className="rh-timeline__readings">
				<div>
					<dt>Attempt totals</dt>
					<dd>{totalsLabel(series)}</dd>
				</div>
				<div>
					<dt>Provider reported</dt>
					<dd>{costLabel(cost.reported)}</dd>
				</div>
				<div>
					<dt>Calculated</dt>
					<dd>{costLabel(cost.calculated)}</dd>
				</div>
				<div>
					<dt>Remaining difference</dt>
					<dd>{costLabel(cost.difference)}</dd>
				</div>
			</dl>
			<div
				className="rh-timeline__rows"
				role="listbox"
				aria-label="Request timeline"
			>
				{entries.map((entry) => (
					<button
						type="button"
						role="option"
						key={requestRowId(entry)}
						aria-selected={requestRowId(entry) === selected}
						className="rh-timeline__row"
						onClick={() => {
							onSelect(entry);
						}}
					>
						<span className="rh-timeline__row-head">
							<code>{entry.requestId ?? "no request id"}</code>
							<small>{entry.region}</small>
						</span>
						<span
							className="rh-timeline__bar"
							style={{ inlineSize: barWidth(entry, widest) }}
						/>
						<strong>
							{entry.usageState === "complete"
								? tokens.format(entry.totalInputTokens)
								: "conflict"}
						</strong>
						<small>{categoryLabel(entry)}</small>
						<small>{modelLabel(entry)}</small>
						<small>{requestCostLabel(costByLine.get(entry.line))}</small>
						{compactedLines.has(entry.line) ? (
							<small className="rh-timeline__compaction">
								⇥ compaction at this line
							</small>
						) : null}
					</button>
				))}
				{entries.length === 0 ? (
					<p className="rh-timeline__note">
						This attempt's transcript records no request.
					</p>
				) : null}
			</div>
			<h3>Automatic instruction loads</h3>
			<InstructionLoads loads={instructionLoads} />
		</section>
	);
}
