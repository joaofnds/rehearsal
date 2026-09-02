import type { ComparisonArm } from "./comparison-record";

export interface PairedCaseObservations {
	readonly caseId: string;
	readonly minuend: readonly number[];
	readonly subtrahend: readonly number[];
}

interface ComparisonContrastDefinition {
	readonly name:
		| "candidateMinusBaseline"
		| "candidateMinusControl"
		| "baselineMinusControl";
	readonly minuend: ComparisonArm;
	readonly subtrahend: ComparisonArm;
}

export const COMPARISON_CONTRASTS = [
	{
		name: "candidateMinusBaseline",
		minuend: "candidate",
		subtrahend: "baseline",
	},
	{
		name: "candidateMinusControl",
		minuend: "candidate",
		subtrahend: "control",
	},
	{
		name: "baselineMinusControl",
		minuend: "baseline",
		subtrahend: "control",
	},
] as const satisfies readonly ComparisonContrastDefinition[];

export type ComparisonContrast = (typeof COMPARISON_CONTRASTS)[number]["name"];

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
