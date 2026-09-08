import type {
	ComparisonReport,
	LegacyComparisonReport,
} from "#benchmark/comparison-record";
import { reliabilitySummaryNamed } from "#benchmark/confirmation-report";
import { armPairs, pairKey } from "./comparison-arm-pair";
import type { ComparisonAttribution } from "./comparison-attribution";
import { comparisonAttribution } from "./comparison-attribution";
import type { QualityReading } from "./comparison-quality-reading";
import { qualityReading } from "./comparison-quality-reading";

export interface ComparisonReportWithAttribution {
	readonly report: ComparisonReport | LegacyComparisonReport;
	readonly attribution: Readonly<
		Record<string, Readonly<Record<string, ComparisonAttribution>>>
	>;
	readonly qualityReadings: Readonly<
		Record<
			string,
			Readonly<Record<string, Readonly<Record<string, QualityReading>>>>
		>
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
	const qualityReadings: Record<
		string,
		Record<string, Record<string, QualityReading>>
	> = {};
	const measures = [
		...report.declaredStages,
		...(report.mode === "pipeline" ? ["final"] : []),
	];

	for (const benchmarkCase of report.cases) {
		const byPair: Record<string, ComparisonAttribution> = {};
		const qualityByPair: Record<string, Record<string, QualityReading>> = {};
		for (const { minuend, subtrahend } of armPairs()) {
			const pair = pairKey(minuend, subtrahend);
			byPair[pair] = comparisonAttribution(
				benchmarkCase.arms[minuend].executedCorpus,
				benchmarkCase.arms[subtrahend].executedCorpus,
			);

			const byMeasure: Record<string, QualityReading> = {};
			for (const name of measures) {
				byMeasure[name] = qualityReading({
					minuend: reliabilitySummaryNamed(
						benchmarkCase.arms[minuend].quality,
						name,
					),
					subtrahend: reliabilitySummaryNamed(
						benchmarkCase.arms[subtrahend].quality,
						name,
					),
					minuendArm: minuend,
					subtrahendArm: subtrahend,
				});
			}

			qualityByPair[pair] = byMeasure;
		}

		attribution[benchmarkCase.caseId] = byPair;
		qualityReadings[benchmarkCase.caseId] = qualityByPair;
	}

	return { report, attribution, qualityReadings };
}
