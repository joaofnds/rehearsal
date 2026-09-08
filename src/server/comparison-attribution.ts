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
 * A pipeline arm's `executedCorpus` path is stage-qualified
 * (`inputs/corpus/<stage>/CLAUDE.md`, written by `frozenDirectoryFiles` walking
 * each stage's own capture directory under `inputs/corpus/`, per
 * `pipeline-confirmation.ts`), while a session arm's path is bare
 * (`CLAUDE.md`). Both name the same corpus-layout file once per stage that
 * declared it, so the layout path, everything after `corpus/<stage>/`, is the
 * identity `dedupedByPath` must key on: keying on the raw path instead treats
 * one file edited identically across every stage as a difference at every
 * stage but one, which is the false refusal this function exists to prevent.
 */
function layoutPath(path: string): string {
	const segments = path.split("/");
	const corpusIndex = segments.lastIndexOf("corpus");
	if (corpusIndex === -1) {
		return path;
	}

	const afterStage = segments.slice(corpusIndex + 2);

	return afterStage.length === 0 ? path : afterStage.join("/");
}

function dedupedByPath(files: readonly HashedFile[]): HashedFile[] {
	const byPath = new Map<string, string>();
	for (const file of files) {
		const path = layoutPath(file.path);
		if (!byPath.has(path)) {
			byPath.set(path, file.sha256);
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
