import { isCorpusLayoutPath } from "./corpus-file";
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

/**
 * A `Read` tool_use never carries a bare layout path: the session reads a real
 * file, so `input.file_path` is absolute, either under the live install
 * (`~/.claude/<layoutPath>`) or under an attempt's corpus overlay
 * (`<attemptDirectory>/.claude/<layoutPath>`, `session-corpus.ts`). Both
 * shapes share the `.claude/` segment immediately before the layout path, so
 * the manifest entry is the suffix after the last one, not the read path
 * itself.
 */
function corpusLayoutSuffix(path: string): string | undefined {
	const marker = "/.claude/";
	const at = path.lastIndexOf(marker);

	return at === -1 ? undefined : path.slice(at + marker.length);
}

function readCorpusLayoutPath(path: string): string | undefined {
	if (isCorpusLayoutPath(path)) {
		return path;
	}

	const suffix = corpusLayoutSuffix(path);

	return suffix !== undefined && isCorpusLayoutPath(suffix)
		? suffix
		: undefined;
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
	const readPaths = filesRead(uses)
		.map((path) => readCorpusLayoutPath(path))
		.filter((path) => path !== undefined);
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
