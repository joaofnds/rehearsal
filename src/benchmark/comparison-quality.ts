import type { ParsedConfirmationRepRecord } from "./confirmation-record";
import type { ReliabilitySummary } from "./confirmation-report";
import {
	buildReliabilityReport,
	reliabilitySummaryNamed,
} from "./confirmation-report";
import type { ComparisonProjectionInput } from "./comparison-evidence";
import type {
	ComparisonContrast,
	PairedEstimate,
} from "./comparison-estimator";
import {
	buildPairedEstimate,
	COMPARISON_CONTRASTS,
} from "./comparison-estimator";
import type { ComparisonArm } from "./comparison-record";
import type { Immutable } from "./contracts";

export interface ComparisonQualityCase {
	readonly caseId: string;
	readonly arms: Readonly<Record<ComparisonArm, readonly ReliabilitySummary[]>>;
}

export interface QualityContrastEstimate {
	readonly name: string;
	readonly successRate: PairedEstimate;
	readonly passK: PairedEstimate;
}

export interface QualityContrastReport {
	readonly quality: readonly QualityContrastEstimate[];
}

export interface ComparisonQualityReport {
	readonly cases: readonly ComparisonQualityCase[];
	readonly contrasts: Readonly<
		Record<ComparisonContrast, QualityContrastReport>
	>;
}

function armQuality(
	contract: Immutable<ComparisonProjectionInput["contract"]>,
	reps: readonly Immutable<ParsedConfirmationRepRecord>[],
): readonly ReliabilitySummary[] {
	const inputs = reps.map((rep) => {
		if (contract.mode === "stage" || contract.mode === "session") {
			return {
				metricsComplete: rep.metrics.status === "COMPLETE",
				stages: rep.stages,
				finalOutcome: { status: "NOT_REACHED" as const },
			};
		}
		if (rep.finalOutcome.status === "NOT_APPLICABLE") {
			throw new Error("Pipeline comparison rep has no final outcome");
		}

		return {
			metricsComplete: rep.metrics.status === "COMPLETE",
			stages: rep.stages,
			finalOutcome: rep.finalOutcome,
		};
	});
	const quality = buildReliabilityReport(contract.declaredStages, inputs);

	return contract.mode === "stage" || contract.mode === "session"
		? quality.slice(0, contract.declaredStages.length)
		: quality;
}

interface BuildQualityContrastRequest {
	readonly names: readonly string[];
	readonly cases: readonly ComparisonQualityCase[];
	readonly minuend: ComparisonArm;
	readonly subtrahend: ComparisonArm;
}

function buildQualityContrast(
	request: Immutable<BuildQualityContrastRequest>,
): QualityContrastReport {
	return {
		quality: request.names.map((name) => {
			const summaries = request.cases.map((benchmarkCase) => ({
				caseId: benchmarkCase.caseId,
				minuend: reliabilitySummaryNamed(
					benchmarkCase.arms[request.minuend],
					name,
				),
				subtrahend: reliabilitySummaryNamed(
					benchmarkCase.arms[request.subtrahend],
					name,
				),
			}));

			return {
				name,
				successRate: buildPairedEstimate(
					summaries.map(({ caseId, minuend, subtrahend }) => ({
						caseId,
						minuend: [minuend.successRate],
						subtrahend: [subtrahend.successRate],
					})),
				),
				passK: buildPairedEstimate(
					summaries.map(({ caseId, minuend, subtrahend }) => ({
						caseId,
						minuend: [minuend.passK],
						subtrahend: [subtrahend.passK],
					})),
				),
			};
		}),
	};
}

export function buildComparisonQuality(
	request: Immutable<ComparisonProjectionInput>,
): ComparisonQualityReport {
	const cases = request.cases.map((benchmarkCase) => ({
		caseId: benchmarkCase.caseId,
		arms: {
			baseline: armQuality(request.contract, benchmarkCase.arms.baseline),
			candidate: armQuality(request.contract, benchmarkCase.arms.candidate),
			control: armQuality(request.contract, benchmarkCase.arms.control),
		},
	}));
	const names = [
		...request.contract.declaredStages,
		...(request.contract.mode === "pipeline" ? ["final"] : []),
	];
	const [candidateMinusBaseline, candidateMinusControl, baselineMinusControl] =
		COMPARISON_CONTRASTS;

	return {
		cases,
		contrasts: {
			candidateMinusBaseline: buildQualityContrast({
				names,
				cases,
				...candidateMinusBaseline,
			}),
			candidateMinusControl: buildQualityContrast({
				names,
				cases,
				...candidateMinusControl,
			}),
			baselineMinusControl: buildQualityContrast({
				names,
				cases,
				...baselineMinusControl,
			}),
		},
	};
}
