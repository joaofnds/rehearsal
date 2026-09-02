import type { ReliabilitySummary } from "./confirmation-report";
import type {
	ComparisonArmEvidence,
	ComparisonEvidence,
	ComparisonProjectionInput,
} from "./comparison-evidence";
import { COMPARISON_CONTRASTS } from "./comparison-estimator";
import type { JudgeAgreementReport } from "./judge-agreement";
import type {
	ComparisonQualityCase,
	ComparisonQualityReport,
} from "./comparison-quality";
import { buildComparisonQuality } from "./comparison-quality";
import type { ComparisonArm, ComparisonReport } from "./comparison-record";
import { comparisonReportSchema } from "./comparison-record";
import type {
	ArmResources,
	ComparisonResourceCase,
	ComparisonResourcesReport,
} from "./comparison-resources";
import { buildComparisonResources } from "./comparison-resources";
import type { Immutable } from "./contracts";

function reportQualityCase(
	report: Immutable<ComparisonQualityReport>,
	caseId: string,
): Immutable<ComparisonQualityCase> {
	const benchmarkCase = report.cases.find(
		(candidate) => candidate.caseId === caseId,
	);
	if (benchmarkCase === undefined) {
		throw new Error(`Quality report has no case ${caseId}`);
	}

	return benchmarkCase;
}

function reportResourceCase(
	report: Immutable<ComparisonResourcesReport>,
	caseId: string,
): Immutable<ComparisonResourceCase> {
	const benchmarkCase = report.cases.find(
		(candidate) => candidate.caseId === caseId,
	);
	if (benchmarkCase === undefined) {
		throw new Error(`Resource report has no case ${caseId}`);
	}

	return benchmarkCase;
}

export interface BuildReportArmRequest {
	readonly evidence: ComparisonArmEvidence;
	readonly quality: readonly ReliabilitySummary[];
	readonly resources: ArmResources;
}

export function buildReportArm(
	request: Immutable<BuildReportArmRequest>,
): ComparisonReport["cases"][number]["arms"][ComparisonArm] {
	return {
		role: request.evidence.role,
		source: {
			group: {
				path: request.evidence.group.path,
				sha256: request.evidence.group.sha256,
			},
			reps: request.evidence.reps.map((rep) => ({
				repId: rep.record.repId,
				ordinal: rep.record.ordinal,
				path: rep.path,
				sha256: rep.sha256,
			})),
		},
		executedCorpus: request.evidence.executedCorpus.map(({ path, sha256 }) => ({
			path,
			sha256,
		})),
		quality: request.quality,
		resources: request.resources,
	};
}

export function buildComparisonReport(
	evidence: Immutable<ComparisonEvidence>,
	judgeAgreement: Immutable<JudgeAgreementReport>,
): ComparisonReport {
	const reportInput: ComparisonProjectionInput = {
		contract: evidence.contract,
		cases: evidence.cases.map((benchmarkCase) => ({
			caseId: benchmarkCase.caseId,
			arms: {
				baseline: benchmarkCase.arms.baseline.reps.map(({ record }) => record),
				candidate: benchmarkCase.arms.candidate.reps.map(
					({ record }) => record,
				),
				control: benchmarkCase.arms.control.reps.map(({ record }) => record),
			},
		})),
	};
	const quality = buildComparisonQuality(reportInput);
	const resources = buildComparisonResources(reportInput);
	const contrast = (
		definition: (typeof COMPARISON_CONTRASTS)[number],
	): ComparisonReport["contrasts"]["candidateMinusBaseline"] => ({
		minuend: definition.minuend,
		subtrahend: definition.subtrahend,
		quality: quality.contrasts[definition.name].quality,
		resources: resources.contrasts[definition.name].resources,
	});
	const cases = evidence.cases.map((benchmarkCase) => {
		const caseQuality = reportQualityCase(quality, benchmarkCase.caseId);
		const caseResources = reportResourceCase(resources, benchmarkCase.caseId);

		return {
			caseId: benchmarkCase.caseId,
			arms: {
				baseline: buildReportArm({
					evidence: benchmarkCase.arms.baseline,
					quality: caseQuality.arms.baseline,
					resources: caseResources.arms.baseline,
				}),
				candidate: buildReportArm({
					evidence: benchmarkCase.arms.candidate,
					quality: caseQuality.arms.candidate,
					resources: caseResources.arms.candidate,
				}),
				control: buildReportArm({
					evidence: benchmarkCase.arms.control,
					quality: caseQuality.arms.control,
					resources: caseResources.arms.control,
				}),
			},
		};
	});
	const report = {
		schemaVersion: 2 as const,
		judgeAgreement,
		manifest: { sha256: evidence.manifest.sha256 },
		mode: evidence.contract.mode,
		declaredStages: evidence.contract.declaredStages,
		reps: evidence.contract.reps,
		cases,
		contrasts: {
			candidateMinusBaseline: contrast(COMPARISON_CONTRASTS[0]),
			candidateMinusControl: contrast(COMPARISON_CONTRASTS[1]),
			baselineMinusControl: contrast(COMPARISON_CONTRASTS[2]),
		},
	};

	return comparisonReportSchema.parse(report);
}
