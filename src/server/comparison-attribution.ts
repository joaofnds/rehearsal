import type { HashedFile } from "#benchmark/checkpoint";
import { corpusDifferences } from "#benchmark/checkpoint";

export type ComparisonAttribution =
	| { readonly claim: "identical" }
	| { readonly claim: "refused"; readonly differingPaths: readonly string[] };

const ATTRIBUTION_WORDING = {
	modified: (path: string) => path,
	missingFromRight: (path: string) => path,
	missingFromLeft: (path: string) => path,
};

/**
 * A corpus file is recorded once per stage that declared it (`checkpoint.ts`'s
 * `snapshotStageCorpus`), so the same path can appear more than once in either
 * arm's `executedCorpus` with the same hash every time. Deduping by path
 * before diffing is what keeps one edited file from being counted once per
 * stage that read it.
 */
function dedupedByPath(files: readonly HashedFile[]): HashedFile[] {
	const byPath = new Map<string, string>();
	for (const file of files) {
		if (!byPath.has(file.path)) {
			byPath.set(file.path, file.sha256);
		}
	}

	return [...byPath.entries()].map(([path, sha256]) => ({ path, sha256 }));
}

export function comparisonAttribution(
	left: readonly HashedFile[],
	right: readonly HashedFile[],
): ComparisonAttribution {
	const differingPaths = corpusDifferences(
		dedupedByPath(left),
		dedupedByPath(right),
		ATTRIBUTION_WORDING,
	);

	return differingPaths.length === 0
		? { claim: "identical" }
		: { claim: "refused", differingPaths };
}
