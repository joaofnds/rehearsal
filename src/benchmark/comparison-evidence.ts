import type {
	ConfirmationGroupRecord,
	ConfirmationRepRecord,
} from "./confirmation-record";
import type { Immutable } from "./contracts";
import { COMPARISON_ARMS } from "./comparison-record";
import type { ComparisonArm } from "./comparison-record";

type FrozenFile = ConfirmationGroupRecord["inputs"]["files"][number];

export interface DigestedRecord<Record> {
	readonly path: string;
	readonly sha256: string;
	readonly record: Record;
}

export interface ComparisonArmEvidence {
	readonly role: ComparisonArm;
	readonly group: DigestedRecord<Immutable<ConfirmationGroupRecord>>;
	readonly reps: readonly DigestedRecord<Immutable<ConfirmationRepRecord>>[];
	readonly executedCorpus: readonly FrozenFile[];
}

export interface ComparisonCaseEvidence {
	readonly caseId: string;
	readonly arms: Readonly<Record<ComparisonArm, ComparisonArmEvidence>>;
}

export interface ComparisonContract {
	readonly mode: "stage" | "pipeline";
	readonly declaredStages: readonly string[];
	readonly reps: number;
}

export class ComparisonEvidenceError extends Error {
	public override name = "ComparisonEvidenceError";
}

function sameValue<Value>(left: Value, right: Value): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function sortedFiles(files: readonly FrozenFile[]): readonly FrozenFile[] {
	return files.toSorted((left, right) => {
		const leftIdentity = `${left.kind}:${left.path}:${left.sha256}`;
		const rightIdentity = `${right.kind}:${right.path}:${right.sha256}`;

		return leftIdentity.localeCompare(rightIdentity);
	});
}

function controlledFileDifference(
	left: readonly FrozenFile[],
	right: readonly FrozenFile[],
): string | undefined {
	const leftFiles = sortedFiles(left.filter(({ kind }) => kind !== "corpus"));
	const rightFiles = sortedFiles(right.filter(({ kind }) => kind !== "corpus"));
	const maximum = Math.max(leftFiles.length, rightFiles.length);
	for (let index = 0; index < maximum; index += 1) {
		const leftFile = leftFiles[index];
		const rightFile = rightFiles[index];
		if (sameValue(leftFile, rightFile)) {
			continue;
		}

		const file = leftFile ?? rightFile;

		return file === undefined
			? "inputs.files"
			: `inputs.files.${file.kind}:${file.path}`;
	}

	return undefined;
}

interface ControlledInputComparison {
	readonly caseId: string;
	readonly reference: ComparisonArmEvidence;
	readonly other: ComparisonArmEvidence;
}

function controlledInputDifference(
	comparison: Immutable<ControlledInputComparison>,
): string | undefined {
	const reference = comparison.reference.group.record.inputs;
	const other = comparison.other.group.record.inputs;
	if (!sameValue(reference.lineage, other.lineage)) {
		return "inputs.lineage";
	}

	const fileDifference = controlledFileDifference(reference.files, other.files);
	if (fileDifference !== undefined) {
		return fileDifference;
	}
	if (reference.model !== other.model) {
		return "inputs.model";
	}
	if (reference.effort !== other.effort) {
		return "inputs.effort";
	}
	if (reference.judgeModel !== other.judgeModel) {
		return "inputs.judgeModel";
	}
	if (reference.judgeEffort !== other.judgeEffort) {
		return "inputs.judgeEffort";
	}
	if (reference.sessionBudgetUsd !== other.sessionBudgetUsd) {
		return "inputs.sessionBudgetUsd";
	}
	if (reference.pipelinePath !== other.pipelinePath) {
		return "inputs.pipelinePath";
	}

	return undefined;
}

function assertControlledInputs(
	comparison: Immutable<ControlledInputComparison>,
): void {
	const field = controlledInputDifference(comparison);
	if (field === undefined) {
		return;
	}

	throw new ComparisonEvidenceError(
		`case ${comparison.caseId} arms ${comparison.reference.role} and ${comparison.other.role} field ${field} differs`,
	);
}

interface ContractComparison {
	readonly caseId: string;
	readonly arm: ComparisonArmEvidence;
	readonly referenceCaseId: string;
	readonly referenceArm: ComparisonArmEvidence;
}

function contractDifference(
	comparison: Immutable<ContractComparison>,
): string | undefined {
	const reference = comparison.referenceArm.group.record;
	const other = comparison.arm.group.record;
	if (reference.mode !== other.mode) {
		return "mode";
	}
	if (!sameValue(reference.declaredStages, other.declaredStages)) {
		return "declaredStages";
	}
	if (reference.reps !== other.reps) {
		return "reps";
	}

	return undefined;
}

function assertContract(comparison: Immutable<ContractComparison>): void {
	const field = contractDifference(comparison);
	if (field === undefined) {
		return;
	}

	throw new ComparisonEvidenceError(
		`case ${comparison.caseId} arm ${comparison.arm.role} field ${field} differs from case ${comparison.referenceCaseId} arm ${comparison.referenceArm.role}`,
	);
}

function assertArmCorpusSnapshot(
	cases: readonly Immutable<ComparisonCaseEvidence>[],
	role: ComparisonArm,
): void {
	const [reference, ...others] = cases;
	if (reference === undefined) {
		return;
	}

	const referenceSnapshot = sortedFiles(reference.arms[role].executedCorpus);
	for (const benchmarkCase of others) {
		const snapshot = sortedFiles(benchmarkCase.arms[role].executedCorpus);
		if (!sameValue(referenceSnapshot, snapshot)) {
			throw new ComparisonEvidenceError(
				`case ${benchmarkCase.caseId} arm ${role} field inputs.files.corpus differs from case ${reference.caseId}`,
			);
		}
	}
}

export function assertComparableComparison(
	cases: readonly Immutable<ComparisonCaseEvidence>[],
): ComparisonContract {
	const [firstCase] = cases;
	if (firstCase === undefined || cases.length < 2) {
		throw new ComparisonEvidenceError(
			"case manifest arm all field cases requires at least two cases",
		);
	}

	const referenceArm = firstCase.arms.baseline;
	for (const benchmarkCase of cases) {
		assertControlledInputs({
			caseId: benchmarkCase.caseId,
			reference: benchmarkCase.arms.baseline,
			other: benchmarkCase.arms.candidate,
		});
		assertControlledInputs({
			caseId: benchmarkCase.caseId,
			reference: benchmarkCase.arms.baseline,
			other: benchmarkCase.arms.control,
		});
		for (const role of COMPARISON_ARMS) {
			assertContract({
				caseId: benchmarkCase.caseId,
				arm: benchmarkCase.arms[role],
				referenceCaseId: firstCase.caseId,
				referenceArm,
			});
		}
	}

	for (const role of COMPARISON_ARMS) {
		assertArmCorpusSnapshot(cases, role);
	}

	return {
		mode: referenceArm.group.record.mode,
		declaredStages: referenceArm.group.record.declaredStages,
		reps: referenceArm.group.record.reps,
	};
}
