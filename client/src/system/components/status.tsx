import "./status.css";

export const STATUS_STATES = [
	"accepted",
	"running",
	"queued",
	"stopped",
	"interrupted",
	"fired",
	"clear",
	"stale",
	"pending",
	"checkpoint-present",
	"checkpoint-absent",
] as const;

export type StatusState = (typeof STATUS_STATES)[number];

export const STATUS_VOCABULARY = {
	accepted: { glyph: "✓", word: "accepted" },
	running: { glyph: "●", word: "running" },
	queued: { glyph: "○", word: "queued" },
	stopped: { glyph: "◼", word: "stopped" },
	interrupted: { glyph: "⊘", word: "interrupted" },
	fired: { glyph: "✕", word: "fired" },
	clear: { glyph: "✓", word: "clear" },
	stale: { glyph: "⚠", word: "stale" },
	pending: { glyph: "◌", word: "pending" },
	"checkpoint-present": { glyph: "◆", word: "checkpoint present" },
	"checkpoint-absent": { glyph: "◇", word: "checkpoint absent" },
} satisfies Record<StatusState, { glyph: string; word: string }>;

export function Status({
	state,
}: {
	readonly state: StatusState;
}): React.JSX.Element {
	const { glyph, word } = STATUS_VOCABULARY[state];

	return (
		<span className={`rh-status rh-status--${state}`}>
			<span
				className={state === "running" ? "rh-live" : undefined}
				aria-hidden="true"
			>
				{glyph}
			</span>
			<span>{word}</span>
		</span>
	);
}
