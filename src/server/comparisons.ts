import type {
	ComparisonReport,
	LegacyComparisonReport,
} from "#benchmark/comparison-record";
import { armPairs, pairKey } from "./comparison-arm-pair";
import type { ComparisonAttribution } from "./comparison-attribution";
import { comparisonAttribution } from "./comparison-attribution";

export interface ComparisonReportWithAttribution {
	readonly report: ComparisonReport | LegacyComparisonReport;
	readonly attribution: Readonly<
		Record<string, Readonly<Record<string, ComparisonAttribution>>>
	>;
}

/**
 * One attribution claim per case per arm pair, so the client renders the
 * refusal or the claim without recomputing `corpusDifferences` itself: the
 * dedup-by-path rule (`comparison-attribution.ts`) is a server-owned contract,
 * not something a browser re-derives from raw file lists.
 */
export function comparisonReport(
	report: ComparisonReport | LegacyComparisonReport,
): ComparisonReportWithAttribution {
	const attribution: Record<string, Record<string, ComparisonAttribution>> = {};

	for (const benchmarkCase of report.cases) {
		const byPair: Record<string, ComparisonAttribution> = {};
		for (const { minuend, subtrahend } of armPairs()) {
			byPair[pairKey(minuend, subtrahend)] = comparisonAttribution(
				benchmarkCase.arms[minuend].executedCorpus,
				benchmarkCase.arms[subtrahend].executedCorpus,
			);
		}

		attribution[benchmarkCase.caseId] = byPair;
	}

	return { report, attribution };
}
