export type AgreementDecision = "PASS" | "FAIL";

export interface JudgeAgreementObservation {
	readonly judgeModel: string;
	readonly stage: string;
	readonly rubricSha256: string;
	readonly rubricId: string;
	readonly judgeDecision: AgreementDecision;
	readonly humanDecision: AgreementDecision;
}

export interface JudgeAgreementCriterion {
	readonly rubricId: string;
	readonly sampleSize: number;
	readonly judgePassHumanPass: number;
	readonly judgeFailHumanFail: number;
	readonly judgePassHumanFail: number;
	readonly judgeFailHumanPass: number;
	readonly observedAgreement: number;
	readonly cohensKappa: number | null;
}

export interface JudgeAgreementBaseline {
	readonly judgeModel: string;
	readonly stage: string;
	readonly rubricSha256: string;
	readonly criteria: readonly JudgeAgreementCriterion[];
}

export interface JudgeAgreementReport {
	readonly skippedCalibrations: number;
	readonly baselines: readonly JudgeAgreementBaseline[];
}

interface MutableCriterionCounts {
	judgePassHumanPass: number;
	judgeFailHumanFail: number;
	judgePassHumanFail: number;
	judgeFailHumanPass: number;
}

interface MutableBaseline {
	readonly judgeModel: string;
	readonly stage: string;
	readonly rubricSha256: string;
	readonly criteria: Map<string, MutableCriterionCounts>;
}

function compareText(left: string, right: string): number {
	if (left < right) {
		return -1;
	}
	if (left > right) {
		return 1;
	}

	return 0;
}

function summarizeCriterion(
	rubricId: string,
	counts: Readonly<MutableCriterionCounts>,
): JudgeAgreementCriterion {
	const sampleSize =
		counts.judgePassHumanPass +
		counts.judgeFailHumanFail +
		counts.judgePassHumanFail +
		counts.judgeFailHumanPass;
	const observedAgreement =
		(counts.judgePassHumanPass + counts.judgeFailHumanFail) / sampleSize;
	const kappaDenominator =
		(counts.judgePassHumanPass + counts.judgePassHumanFail) *
			(counts.judgePassHumanFail + counts.judgeFailHumanFail) +
		(counts.judgeFailHumanPass + counts.judgeFailHumanFail) *
			(counts.judgePassHumanPass + counts.judgeFailHumanPass);
	const cohensKappa =
		kappaDenominator === 0
			? null
			: (2 *
					(counts.judgePassHumanPass * counts.judgeFailHumanFail -
						counts.judgePassHumanFail * counts.judgeFailHumanPass)) /
				kappaDenominator;

	return {
		rubricId,
		sampleSize,
		...counts,
		observedAgreement,
		cohensKappa,
	};
}

function baselineKey(observation: Readonly<JudgeAgreementObservation>): string {
	return JSON.stringify([
		observation.judgeModel,
		observation.stage,
		observation.rubricSha256,
	]);
}

function incrementCounts(
	counts: MutableCriterionCounts,
	observation: Readonly<JudgeAgreementObservation>,
): void {
	if (observation.judgeDecision === "PASS") {
		if (observation.humanDecision === "PASS") {
			counts.judgePassHumanPass += 1;
		} else {
			counts.judgePassHumanFail += 1;
		}
	} else if (observation.humanDecision === "PASS") {
		counts.judgeFailHumanPass += 1;
	} else {
		counts.judgeFailHumanFail += 1;
	}
}

export function buildJudgeAgreementReport(
	observations: readonly Readonly<JudgeAgreementObservation>[],
	skippedCalibrations: number,
): JudgeAgreementReport {
	const baselines = new Map<string, MutableBaseline>();
	for (const observation of observations) {
		const key = baselineKey(observation);
		let baseline = baselines.get(key);
		if (baseline === undefined) {
			baseline = {
				judgeModel: observation.judgeModel,
				stage: observation.stage,
				rubricSha256: observation.rubricSha256,
				criteria: new Map(),
			};
			baselines.set(key, baseline);
		}

		let counts = baseline.criteria.get(observation.rubricId);
		if (counts === undefined) {
			counts = {
				judgePassHumanPass: 0,
				judgeFailHumanFail: 0,
				judgePassHumanFail: 0,
				judgeFailHumanPass: 0,
			};
			baseline.criteria.set(observation.rubricId, counts);
		}
		incrementCounts(counts, observation);
	}

	return {
		skippedCalibrations,
		baselines: [...baselines.values()]
			.toSorted(
				(left, right) =>
					compareText(left.judgeModel, right.judgeModel) ||
					compareText(left.stage, right.stage) ||
					compareText(left.rubricSha256, right.rubricSha256),
			)
			.map((baseline) => ({
				judgeModel: baseline.judgeModel,
				stage: baseline.stage,
				rubricSha256: baseline.rubricSha256,
				criteria: [...baseline.criteria.entries()]
					.toSorted(([left], [right]) => compareText(left, right))
					.map(([rubricId, counts]) => summarizeCriterion(rubricId, counts)),
			})),
	};
}
