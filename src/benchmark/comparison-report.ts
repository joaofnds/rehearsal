import type { ConfirmationRepRecord } from "./confirmation-record";
import type { ReliabilitySummary } from "./confirmation-report";
import { buildReliabilityReport } from "./confirmation-report";
import type { ComparisonContract } from "./comparison-evidence";
import type { ComparisonArm } from "./comparison-record";
import type { Immutable } from "./contracts";

export interface PairedCaseObservations {
	readonly caseId: string;
	readonly minuend: readonly number[];
	readonly subtrahend: readonly number[];
}

export const COMPARISON_CONTRASTS = [
	"candidateMinusBaseline",
	"candidateMinusControl",
	"baselineMinusControl",
] as const;
export type ComparisonContrast = (typeof COMPARISON_CONTRASTS)[number];

interface QualityCaseInput {
	readonly caseId: string;
	readonly arms: Readonly<
		Record<ComparisonArm, readonly ConfirmationRepRecord[]>
	>;
}

export interface BuildComparisonQualityRequest {
	readonly contract: ComparisonContract;
	readonly cases: readonly QualityCaseInput[];
}

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

export interface PairedEstimate {
	readonly caseDeltas: readonly {
		readonly caseId: string;
		readonly value: number;
	}[];
	readonly meanDelta: number;
	readonly standardError: number;
}

function mean(values: readonly number[]): number {
	if (values.length === 0) {
		throw new Error("A paired estimate requires observations in every arm");
	}

	const sorted = values.toSorted((left, right) => left - right);

	return sorted.reduce((total, value) => total + value, 0) / sorted.length;
}

export function buildPairedEstimate(
	cases: readonly PairedCaseObservations[],
): PairedEstimate {
	if (cases.length < 2) {
		throw new Error("A paired estimate requires at least two cases");
	}

	const caseDeltas = cases.map((benchmarkCase) => ({
		caseId: benchmarkCase.caseId,
		value: mean(benchmarkCase.minuend) - mean(benchmarkCase.subtrahend),
	}));
	const meanDelta = mean(caseDeltas.map(({ value }) => value));
	const squaredDifferences = caseDeltas.map(
		({ value }) => (value - meanDelta) ** 2,
	);
	const sampleVariance =
		mean(squaredDifferences) * (caseDeltas.length / (caseDeltas.length - 1));

	return {
		caseDeltas,
		meanDelta,
		standardError: Math.sqrt(sampleVariance / caseDeltas.length),
	};
}

function armQuality(
	contract: Immutable<ComparisonContract>,
	reps: readonly Immutable<ConfirmationRepRecord>[],
): readonly ReliabilitySummary[] {
	if (reps.length !== contract.reps) {
		throw new Error(
			`Comparison arm has ${reps.length} reps; expected ${contract.reps}`,
		);
	}

	const inputs = reps.map((rep) => {
		if (contract.mode === "stage") {
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

	return contract.mode === "stage"
		? quality.slice(0, contract.declaredStages.length)
		: quality;
}

function qualitySummary(
	quality: readonly ReliabilitySummary[],
	name: string,
): ReliabilitySummary {
	const summary = quality.find((candidate) => candidate.name === name);
	if (summary === undefined) {
		throw new Error(`Comparison arm has no ${name} quality summary`);
	}

	return summary;
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
				minuend: qualitySummary(benchmarkCase.arms[request.minuend], name),
				subtrahend: qualitySummary(
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
	request: Immutable<BuildComparisonQualityRequest>,
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

	return {
		cases,
		contrasts: {
			candidateMinusBaseline: buildQualityContrast({
				names,
				cases,
				minuend: "candidate",
				subtrahend: "baseline",
			}),
			candidateMinusControl: buildQualityContrast({
				names,
				cases,
				minuend: "candidate",
				subtrahend: "control",
			}),
			baselineMinusControl: buildQualityContrast({
				names,
				cases,
				minuend: "baseline",
				subtrahend: "control",
			}),
		},
	};
}
