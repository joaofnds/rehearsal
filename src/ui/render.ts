import type { Overview, OverviewSection } from "#ui/overview";

const STYLES = `
:root {
	color-scheme: light dark;
	--surface: Canvas;
	--text: CanvasText;
	--muted: color-mix(in srgb, CanvasText 60%, Canvas);
	--border: color-mix(in srgb, CanvasText 20%, Canvas);
	--accent: color-mix(in srgb, CanvasText 12%, Canvas);
	--space: 1rem;
}

body {
	margin: 0;
	padding: calc(var(--space) * 1.5);
	background: var(--surface);
	color: var(--text);
	font: 16px/1.5 system-ui, sans-serif;
}

h1 {
	font-size: 1.5rem;
	font-weight: 600;
	margin: 0 0 var(--space);
}

h2 {
	font-size: 1rem;
	font-weight: 600;
	margin: 0;
}

main {
	display: flex;
	flex-direction: column;
	gap: calc(var(--space) * 1.5);
	max-width: 60rem;
}

section {
	display: flex;
	flex-direction: column;
	gap: calc(var(--space) * 0.5);
}

.count {
	color: var(--muted);
	font-weight: 400;
}

ul {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}

li {
	border: 1px solid var(--border);
	border-radius: 6px;
}

a {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--space) * 0.75);
	padding: calc(var(--space) * 0.6) calc(var(--space) * 0.75);
	min-height: 44px;
	box-sizing: border-box;
	align-items: center;
	color: inherit;
	text-decoration: none;
}

a:hover {
	background: var(--accent);
}

a:focus-visible {
	outline: 2px solid var(--text);
	outline-offset: -2px;
}

.id {
	font-family: ui-monospace, monospace;
	font-size: 0.8125rem;
}

.field {
	color: var(--muted);
	font-size: 0.875rem;
}

.empty {
	color: var(--muted);
	font-size: 0.875rem;
	margin: 0;
}

.unreadable {
	border-color: color-mix(in srgb, CanvasText 45%, Canvas);
}

.unreadable .field::before {
	content: "unreadable: ";
	font-weight: 600;
}
`;

export function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function renderEntries(section: OverviewSection): string {
	const entries = section.entries.map(
		(entry) =>
			`<li><a href="/record/${encodeURIComponent(entry.id)}"><span class="id">${escapeHtml(entry.id)}</span>${entry.fields
				.map((field) => `<span class="field">${escapeHtml(field)}</span>`)
				.join("")}</a></li>`,
	);
	const unreadable = section.unreadable.map(
		(record) =>
			`<li class="unreadable"><a href="/record/${encodeURIComponent(record.id)}"><span class="id">${escapeHtml(record.id)}</span><span class="field">${escapeHtml(record.reason)}</span></a></li>`,
	);

	if (entries.length === 0 && unreadable.length === 0) {
		return `<p class="empty">Nothing recorded.</p>`;
	}

	return `<ul>${[...entries, ...unreadable].join("")}</ul>`;
}

function renderSection(section: OverviewSection): string {
	const total = section.entries.length + section.unreadable.length;

	return `<section aria-labelledby="${section.kind}-heading">
<h2 id="${section.kind}-heading">${section.kind} <span class="count">${total}</span></h2>
${renderEntries(section)}
</section>`;
}

export function renderOverview(overview: Overview): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rehearsal</title>
<style>${STYLES}</style>
</head>
<body>
<h1>Rehearsal</h1>
<main>${overview.sections.map(renderSection).join("")}</main>
</body>
</html>`;
}
