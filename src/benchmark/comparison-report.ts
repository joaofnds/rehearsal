import type { ConfirmationRepRecord } from "./confirmation-record";
import type {
	MetricDistributions,
	ReliabilitySummary,
} from "./confirmation-report";
import {
	buildReliabilityReport,
	buildResourceReport,
} from "./confirmation-report";
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

export interface ComparisonRepCaseInput {
	readonly caseId: string;
	readonly arms: Readonly<
		Record<ComparisonArm, readonly ConfirmationRepRecord[]>
	>;
}

export interface BuildComparisonQualityRequest {
	readonly contract: ComparisonContract;
	readonly cases: readonly ComparisonRepCaseInput[];
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

const RESOURCE_ROLES = [
	"worker",
	"product-owner",
	"stage-judge",
	"final-judge",
] as const;
type ResourceRole = (typeof RESOURCE_ROLES)[number];

export interface MetricValueSummary {
	readonly values: readonly number[];
	readonly mean: number;
}

export interface ResourceMetricSummary {
	readonly costUsd: MetricValueSummary;
	readonly inputTokens: MetricValueSummary;
	readonly outputTokens: MetricValueSummary;
	readonly cacheReadTokens: MetricValueSummary;
	readonly cacheWriteTokens: MetricValueSummary;
}

export interface MissingResourceEvidence {
	readonly repId: string;
	readonly ordinal: number;
	readonly missing: readonly string[];
}

export interface AvailableArmResources {
	readonly status: "AVAILABLE";
	readonly completeReps: number;
	readonly missingMetricReps: 0;
	readonly perRole: Readonly<Record<ResourceRole, ResourceMetricSummary>>;
	readonly total: ResourceMetricSummary;
	readonly workerTurns: MetricValueSummary;
}

export interface UnavailableArmResources {
	readonly status: "UNAVAILABLE";
	readonly completeReps: number;
	readonly missingMetricReps: number;
	readonly missingEvidence: readonly MissingResourceEvidence[];
}

export type ArmResources = AvailableArmResources | UnavailableArmResources;

export interface ComparisonResourceCase {
	readonly caseId: string;
	readonly arms: Readonly<Record<ComparisonArm, ArmResources>>;
}

export interface ContrastMissingResourceEvidence extends MissingResourceEvidence {
	readonly caseId: string;
	readonly arm: ComparisonArm;
}

export interface AvailableContrastResources {
	readonly status: "AVAILABLE";
	readonly perRole: Readonly<Record<ResourceRole, ResourceMetricEstimates>>;
	readonly total: ResourceMetricEstimates;
	readonly workerTurns: PairedEstimate;
}

export interface ResourceMetricEstimates {
	readonly costUsd: PairedEstimate;
	readonly inputTokens: PairedEstimate;
	readonly outputTokens: PairedEstimate;
	readonly cacheReadTokens: PairedEstimate;
	readonly cacheWriteTokens: PairedEstimate;
}

export interface UnavailableContrastResources {
	readonly status: "UNAVAILABLE";
	readonly missingEvidence: readonly ContrastMissingResourceEvidence[];
}

export type ContrastResources =
	| AvailableContrastResources
	| UnavailableContrastResources;

export interface ResourceContrastReport {
	readonly resources: ContrastResources;
}

export interface ComparisonResourcesReport {
	readonly cases: readonly ComparisonResourceCase[];
	readonly contrasts: Readonly<
		Record<ComparisonContrast, ResourceContrastReport>
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

function metricValueSummary(values: readonly number[]): MetricValueSummary {
	return { values, mean: mean(values) };
}

function resourceMetricSummary(
	distributions: Immutable<MetricDistributions>,
): ResourceMetricSummary {
	return {
		costUsd: metricValueSummary(distributions.costUsd),
		inputTokens: metricValueSummary(distributions.inputTokens),
		outputTokens: metricValueSummary(distributions.outputTokens),
		cacheReadTokens: metricValueSummary(distributions.cacheReadTokens),
		cacheWriteTokens: metricValueSummary(distributions.cacheWriteTokens),
	};
}

function armResources(
	contract: Immutable<ComparisonContract>,
	reps: readonly Immutable<ConfirmationRepRecord>[],
): ArmResources {
	if (reps.length !== contract.reps) {
		throw new Error(
			`Comparison arm has ${reps.length} reps; expected ${contract.reps}`,
		);
	}

	const missingEvidence = reps.flatMap((rep) =>
		rep.metrics.status === "MISSING"
			? [
					{
						repId: rep.repId,
						ordinal: rep.ordinal,
						missing: rep.metrics.missing,
					},
				]
			: [],
	);
	if (missingEvidence.length > 0) {
		return {
			status: "UNAVAILABLE",
			completeReps: reps.length - missingEvidence.length,
			missingMetricReps: missingEvidence.length,
			missingEvidence,
		};
	}

	const resources = buildResourceReport(contract.declaredStages, reps, 0);

	return {
		status: "AVAILABLE",
		completeReps: resources.completeReps,
		missingMetricReps: 0,
		perRole: {
			worker: resourceMetricSummary(resources.perRole.worker),
			"product-owner": resourceMetricSummary(
				resources.perRole["product-owner"],
			),
			"stage-judge": resourceMetricSummary(resources.perRole["stage-judge"]),
			"final-judge": resourceMetricSummary(resources.perRole["final-judge"]),
		},
		total: resourceMetricSummary(resources.total),
		workerTurns: metricValueSummary(resources.workerTurns),
	};
}

function availableResources(
	benchmarkCase: Immutable<ComparisonResourceCase>,
	arm: ComparisonArm,
): AvailableArmResources {
	const resources = benchmarkCase.arms[arm];
	if (resources.status === "UNAVAILABLE") {
		throw new Error(
			`case ${benchmarkCase.caseId} arm ${arm} resource evidence is unavailable`,
		);
	}

	return resources;
}

interface BuildMetricEstimateRequest {
	readonly cases: readonly ComparisonResourceCase[];
	readonly minuend: ComparisonArm;
	readonly subtrahend: ComparisonArm;
	readonly values: (resources: AvailableArmResources) => readonly number[];
}

function buildMetricEstimate(
	request: Readonly<BuildMetricEstimateRequest>,
): PairedEstimate {
	return buildPairedEstimate(
		request.cases.map((benchmarkCase) => ({
			caseId: benchmarkCase.caseId,
			minuend: request.values(
				availableResources(benchmarkCase, request.minuend),
			),
			subtrahend: request.values(
				availableResources(benchmarkCase, request.subtrahend),
			),
		})),
	);
}

interface BuildResourceMetricEstimatesRequest {
	readonly cases: readonly ComparisonResourceCase[];
	readonly minuend: ComparisonArm;
	readonly subtrahend: ComparisonArm;
	readonly metrics: (resources: AvailableArmResources) => ResourceMetricSummary;
}

function buildResourceMetricEstimates(
	request: Readonly<BuildResourceMetricEstimatesRequest>,
): ResourceMetricEstimates {
	const estimate = (
		values: (metrics: ResourceMetricSummary) => readonly number[],
	): PairedEstimate =>
		buildMetricEstimate({
			cases: request.cases,
			minuend: request.minuend,
			subtrahend: request.subtrahend,
			values: (resources) => values(request.metrics(resources)),
		});

	return {
		costUsd: estimate(({ costUsd }) => costUsd.values),
		inputTokens: estimate(({ inputTokens }) => inputTokens.values),
		outputTokens: estimate(({ outputTokens }) => outputTokens.values),
		cacheReadTokens: estimate(({ cacheReadTokens }) => cacheReadTokens.values),
		cacheWriteTokens: estimate(
			({ cacheWriteTokens }) => cacheWriteTokens.values,
		),
	};
}

interface BuildResourceContrastRequest {
	readonly cases: readonly ComparisonResourceCase[];
	readonly minuend: ComparisonArm;
	readonly subtrahend: ComparisonArm;
}

function buildResourceContrast(
	request: Immutable<BuildResourceContrastRequest>,
): ResourceContrastReport {
	const missingEvidence: ContrastMissingResourceEvidence[] = [];
	for (const benchmarkCase of request.cases) {
		for (const arm of [request.minuend, request.subtrahend]) {
			const resources = benchmarkCase.arms[arm];
			if (resources.status === "UNAVAILABLE") {
				missingEvidence.push(
					...resources.missingEvidence.map((evidence) => ({
						caseId: benchmarkCase.caseId,
						arm,
						repId: evidence.repId,
						ordinal: evidence.ordinal,
						missing: evidence.missing,
					})),
				);
			}
		}
	}
	if (missingEvidence.length > 0) {
		return { resources: { status: "UNAVAILABLE", missingEvidence } };
	}

	const metricRequest = {
		cases: request.cases,
		minuend: request.minuend,
		subtrahend: request.subtrahend,
	};

	return {
		resources: {
			status: "AVAILABLE",
			perRole: {
				worker: buildResourceMetricEstimates({
					...metricRequest,
					metrics: ({ perRole }) => perRole.worker,
				}),
				"product-owner": buildResourceMetricEstimates({
					...metricRequest,
					metrics: ({ perRole }) => perRole["product-owner"],
				}),
				"stage-judge": buildResourceMetricEstimates({
					...metricRequest,
					metrics: ({ perRole }) => perRole["stage-judge"],
				}),
				"final-judge": buildResourceMetricEstimates({
					...metricRequest,
					metrics: ({ perRole }) => perRole["final-judge"],
				}),
			},
			total: buildResourceMetricEstimates({
				...metricRequest,
				metrics: ({ total }) => total,
			}),
			workerTurns: buildMetricEstimate({
				...metricRequest,
				values: ({ workerTurns }) => workerTurns.values,
			}),
		},
	};
}

export function buildComparisonResources(
	request: Immutable<BuildComparisonQualityRequest>,
): ComparisonResourcesReport {
	const cases = request.cases.map((benchmarkCase) => ({
		caseId: benchmarkCase.caseId,
		arms: {
			baseline: armResources(request.contract, benchmarkCase.arms.baseline),
			candidate: armResources(request.contract, benchmarkCase.arms.candidate),
			control: armResources(request.contract, benchmarkCase.arms.control),
		},
	}));

	return {
		cases,
		contrasts: {
			candidateMinusBaseline: buildResourceContrast({
				cases,
				minuend: "candidate",
				subtrahend: "baseline",
			}),
			candidateMinusControl: buildResourceContrast({
				cases,
				minuend: "candidate",
				subtrahend: "control",
			}),
			baselineMinusControl: buildResourceContrast({
				cases,
				minuend: "baseline",
				subtrahend: "control",
			}),
		},
	};
}
