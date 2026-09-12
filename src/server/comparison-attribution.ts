import type { HashedFile } from "#benchmark/checkpoint";
import { corpusDifferences } from "#benchmark/checkpoint";
import type {
	ComparisonReport,
	LegacyComparisonReport,
} from "#benchmark/comparison-record";

export type ComparisonAttribution =
	| { readonly claim: "identical" }
	| { readonly claim: "attributable"; readonly differingPath: string }
	| { readonly claim: "refused"; readonly differingPaths: readonly string[] };

const ATTRIBUTION_WORDING = {
	modified: (path: string) => path,
	missingFromRight: (path: string) => path,
	missingFromLeft: (path: string) => path,
};

/**
 * A pipeline arm's `executedCorpus` path is stage-qualified
 * (`inputs/corpus/<stage>/CLAUDE.md`, written by `frozenDirectoryFiles` walking
 * each stage's own capture directory under `inputs/corpus/`, per
 * `pipeline-confirmation.ts`). A session arm omits that stage segment
 * (`inputs/corpus/output-styles/brief.md`). Both must resolve to the original
 * corpus-layout path, so `dedupedByPath` receives the comparison mode instead
 * of guessing which segment is a stage. Keying on raw pipeline paths would
 * count one file once per stage; dropping a segment from a session path can
 * collapse distinct layout files that share a basename.
 */
type ComparisonMode = (ComparisonReport | LegacyComparisonReport)["mode"];

function layoutPath(path: string, mode: ComparisonMode): string {
	const segments = path.split("/");
	const corpusIndex = segments.lastIndexOf("corpus");
	if (corpusIndex === -1) {
		return path;
	}

	const layoutStart = corpusIndex + (mode === "session" ? 1 : 2);
	const layoutSegments = segments.slice(layoutStart);

	return layoutSegments.length === 0 ? path : layoutSegments.join("/");
}

function dedupedByPath(
	files: readonly HashedFile[],
	mode: ComparisonMode,
): HashedFile[] {
	const byPath = new Map<string, string>();
	for (const file of files) {
		const path = layoutPath(file.path, mode);
		if (!byPath.has(path)) {
			byPath.set(path, file.sha256);
		}
	}

	return [...byPath.entries()].map(([path, sha256]) => ({ path, sha256 }));
}

export function comparisonAttribution(
	left: readonly HashedFile[],
	right: readonly HashedFile[],
	mode: ComparisonMode,
): ComparisonAttribution {
	const differingPaths = corpusDifferences(
		dedupedByPath(left, mode),
		dedupedByPath(right, mode),
		ATTRIBUTION_WORDING,
	);

	if (differingPaths.length === 0) {
		return { claim: "identical" };
	}

	const [differingPath] = differingPaths;
	return differingPaths.length === 1 && differingPath !== undefined
		? { claim: "attributable", differingPath }
		: { claim: "refused", differingPaths };
}
