import { CORPUS_LAYOUT_DIRECTORIES } from "./corpus-file";
import type { Immutable } from "./contracts";
import type { ToolUse } from "./transcript";
import { filesRead, skillsInvoked } from "./transcript";

/**
 * The observed set is name-only: the transcript never carries the corpus's own
 * bytes (doc-9 gap 2), so a manifest entry is a layout path and nothing a hash
 * could attach to.
 */
export interface ContextManifest {
	readonly paths: readonly string[];
}

export type ManifestDivergence =
	| { readonly kind: "undeclared-file"; readonly path: string }
	| { readonly kind: "unloaded-file"; readonly path: string };

function isCorpusLayoutPath(path: string): boolean {
	return CORPUS_LAYOUT_DIRECTORIES.some((directory) =>
		path.startsWith(`${directory}/`),
	);
}

/**
 * `output_style` last-wins: a transcript naming two different styles across its
 * attachments is a case this card leaves for a follow-up to define further
 * (doc-9 gap 1, AC#4).
 */
function outputStyleLayoutPath(styles: readonly string[]): string | undefined {
	const last = styles.at(-1);

	return last === undefined ? undefined : `output-styles/${last}.md`;
}

export function observedManifest(
	uses: Immutable<readonly ToolUse[]>,
	styles: readonly string[],
): ContextManifest {
	const skillPaths = skillsInvoked(uses).map(
		(skill) => `skills/${skill}/SKILL.md`,
	);
	const readPaths = filesRead(uses).filter((path) => isCorpusLayoutPath(path));
	const stylePath = outputStyleLayoutPath(styles);

	const paths = [
		...skillPaths,
		...readPaths,
		...(stylePath === undefined ? [] : [stylePath]),
	];

	return { paths: [...new Set(paths)] };
}

export function reconcileManifest(
	manifest: Readonly<ContextManifest>,
	declared: readonly string[],
): readonly ManifestDivergence[] {
	const declaredSet = new Set(declared);
	const observedSet = new Set(manifest.paths);

	const undeclared: ManifestDivergence[] = manifest.paths
		.filter((path) => !declaredSet.has(path))
		.map((path) => ({ kind: "undeclared-file", path }));

	const unloaded: ManifestDivergence[] = declared
		.filter((path) => !observedSet.has(path))
		.map((path) => ({ kind: "unloaded-file", path }));

	return [...undeclared, ...unloaded];
}
