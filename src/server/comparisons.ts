import type {
	ComparisonArm,
	ComparisonReport,
	LegacyComparisonReport,
} from "#benchmark/comparison-record";
import { COMPARISON_ARMS } from "#benchmark/comparison-record";
import type { Immutable } from "#benchmark/contracts";
import type { ComparisonAttribution } from "./comparison-attribution";
import { comparisonAttribution } from "./comparison-attribution";

export type ComparisonArmPair =
	`${ComparisonArm}Minus${Capitalize<ComparisonArm>}`;

function pairKey(minuend: ComparisonArm, subtrahend: ComparisonArm): string {
	return `${minuend}Minus${subtrahend[0]?.toUpperCase()}${subtrahend.slice(1)}`;
}

function armPairs(): readonly {
	readonly minuend: ComparisonArm;
	readonly subtrahend: ComparisonArm;
}[] {
	return COMPARISON_ARMS.flatMap((minuend) =>
		COMPARISON_ARMS.filter((subtrahend) => subtrahend !== minuend).map(
			(subtrahend) => ({ minuend, subtrahend }),
		),
	);
}

export interface ComparisonReportWithAttribution {
	readonly report: Immutable<ComparisonReport | LegacyComparisonReport>;
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
	report: Immutable<ComparisonReport | LegacyComparisonReport>,
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
