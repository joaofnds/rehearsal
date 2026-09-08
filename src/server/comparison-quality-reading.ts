import { STAGE_LETTER_GRADES } from "#benchmark/config";
import type { ReliabilitySummary } from "#benchmark/confirmation-report";
import type { ComparisonArm } from "#benchmark/comparison-record";

const FINAL_VERDICT_SCALE = ["PASS", "FAIL"] as const;

export interface QualityInterval {
	readonly low: string;
	readonly high: string;
}

export type QualityVerdict =
	| { readonly kind: "insideRerunNoise" }
	| { readonly kind: "unchangedAlreadyClear" }
	| { readonly kind: "separated"; readonly arm: ComparisonArm };

export interface QualityReading {
	readonly interval: {
		readonly minuend: QualityInterval | undefined;
		readonly subtrahend: QualityInterval | undefined;
	};
	readonly verdict: QualityVerdict;
}

interface QualityReadingRequest {
	readonly minuend: ReliabilitySummary;
	readonly subtrahend: ReliabilitySummary;
	readonly minuendArm: ComparisonArm;
	readonly subtrahendArm: ComparisonArm;
}

function scaleFor(summary: ReliabilitySummary): readonly string[] {
	return summary.name === "final" ? FINAL_VERDICT_SCALE : STAGE_LETTER_GRADES;
}

function spanOf(
	summary: ReliabilitySummary,
	scale: readonly string[],
): QualityInterval | undefined {
	const observed = scale.filter(
		(grade) => (summary.gradeDistribution[grade] ?? 0) > 0,
	);
	const [low] = observed;
	const high = observed.at(-1);

	return low === undefined || high === undefined ? undefined : { low, high };
}

function spansOverlap(
	scale: readonly string[],
	left: QualityInterval | undefined,
	right: QualityInterval | undefined,
): boolean {
	if (left === undefined || right === undefined) {
		return true;
	}

	const leftLow = scale.indexOf(left.low);
	const leftHigh = scale.indexOf(left.high);
	const rightLow = scale.indexOf(right.low);
	const rightHigh = scale.indexOf(right.high);

	return leftLow <= rightHigh && rightLow <= leftHigh;
}

function atCeiling(summary: ReliabilitySummary): boolean {
	return summary.successful === summary.requested;
}

function higherSucceedingArm(
	request: QualityReadingRequest,
): ComparisonArm | undefined {
	const minuendRate = request.minuend.successful / request.minuend.requested;
	const subtrahendRate =
		request.subtrahend.successful / request.subtrahend.requested;

	if (minuendRate === subtrahendRate) {
		return undefined;
	}

	return minuendRate > subtrahendRate
		? request.minuendArm
		: request.subtrahendArm;
}

function verdictFor(
	request: QualityReadingRequest,
	scale: readonly string[],
	minuendSpan: QualityInterval | undefined,
	subtrahendSpan: QualityInterval | undefined,
): QualityVerdict {
	if (atCeiling(request.minuend) && atCeiling(request.subtrahend)) {
		return { kind: "unchangedAlreadyClear" };
	}
	if (spansOverlap(scale, minuendSpan, subtrahendSpan)) {
		return { kind: "insideRerunNoise" };
	}

	const arm = higherSucceedingArm(request);

	return arm === undefined
		? { kind: "insideRerunNoise" }
		: { kind: "separated", arm };
}

export function qualityReading(request: QualityReadingRequest): QualityReading {
	const scale = scaleFor(request.minuend);
	const minuendSpan = spanOf(request.minuend, scale);
	const subtrahendSpan = spanOf(request.subtrahend, scale);

	return {
		interval: { minuend: minuendSpan, subtrahend: subtrahendSpan },
		verdict: verdictFor(request, scale, minuendSpan, subtrahendSpan),
	};
}
