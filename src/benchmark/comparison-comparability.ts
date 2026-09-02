import { createHash } from "node:crypto";
import { parseCheckpointRecord } from "./checkpoint";
import type { ConfirmationGroupRecord } from "./confirmation-record";
import type { Immutable } from "./contracts";
import type {
	ComparisonArmEvidence,
	ComparisonCaseEvidence,
	ComparisonContract,
	FrozenFile,
	LoadedComparisonArmEvidence,
	LoadedComparisonCaseEvidence,
} from "./comparison-evidence";
import { ComparisonEvidenceError } from "./comparison-evidence";
import type { ComparisonArm } from "./comparison-record";
import { COMPARISON_ARMS } from "./comparison-record";

function sha256(bytes: Readonly<Uint8Array>): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function executedCorpusFiles(
	group: Immutable<ConfirmationGroupRecord>,
): readonly FrozenFile[] {
	const corpus = group.inputs.files.filter(({ kind }) => kind === "corpus");
	if (group.mode === "pipeline") {
		return corpus;
	}

	const [selectedStage] = group.declaredStages;

	return corpus.filter((file) => {
		const segments = file.path.replaceAll("\\", "/").split("/");
		const corpusIndex = segments.lastIndexOf("corpus");

		return segments[corpusIndex + 1] === selectedStage;
	});
}

function controlledCheckpointDigest(text: string): string {
	const checkpoint = parseCheckpointRecord(text);

	return sha256(
		new TextEncoder().encode(
			JSON.stringify({
				stage: checkpoint.stage,
				model: checkpoint.model,
				effort: checkpoint.effort,
				corpusFiles: checkpoint.corpusFiles,
				artifacts: checkpoint.artifacts,
				workflowState: checkpoint.workflowState,
			}),
		),
	);
}

function projectArm(
	caseId: string,
	arm: Immutable<LoadedComparisonArmEvidence>,
): ComparisonArmEvidence {
	const controlledFiles = arm.frozenFiles.flatMap(({ record, text }) => {
		if (record.kind === "corpus" || record.kind === "instructions") {
			return [];
		}

		let normalizedDigest = record.sha256;
		if (
			arm.group.record.mode === "pipeline" &&
			record.kind === "checkpoint" &&
			record.path.replaceAll("\\", "/").endsWith("/checkpoint.json")
		) {
			try {
				normalizedDigest = controlledCheckpointDigest(text);
			} catch {
				throw new ComparisonEvidenceError(
					`case ${caseId} arm ${arm.role} field inputs.files[${record.kind}:${record.path}]: invalid pipeline checkpoint record`,
				);
			}
		}

		return [{ ...record, sha256: normalizedDigest }];
	});
	const executedCorpus = executedCorpusFiles(arm.group.record);
	if (executedCorpus.length === 0) {
		throw new ComparisonEvidenceError(
			`case ${caseId} arm ${arm.role} field inputs.files.corpus: source group records no executed corpus`,
		);
	}

	return {
		role: arm.role,
		declaredCaseId: arm.declaredCaseId,
		group: arm.group,
		reps: arm.reps,
		executedCorpus,
		controlledFiles,
		sourcePaths: arm.sourcePaths,
	};
}

function sameValue<Value>(left: Value, right: Value): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function sortedFiles(files: readonly FrozenFile[]): readonly FrozenFile[] {
	return files.toSorted((left, right) => {
		const leftIdentity = `${left.kind}:${left.path}`;
		const rightIdentity = `${right.kind}:${right.path}`;

		return leftIdentity.localeCompare(rightIdentity);
	});
}

function controlledFileDifference(
	left: readonly FrozenFile[],
	right: readonly FrozenFile[],
): string | undefined {
	const leftFiles = sortedFiles(left);
	const rightFiles = sortedFiles(right);
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

	const fileDifference = controlledFileDifference(
		comparison.reference.controlledFiles,
		comparison.other.controlledFiles,
	);
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

/**
 * The manifest names which declared case each triple of arms ran. A group that
 * recorded a different case answers a different question, so pairing it as an
 * arm of this case would contrast two tasks and call the difference a corpus
 * effect. A group written before cases were declared recorded no case at all,
 * which claims nothing and so contradicts nothing.
 */
function assertArmRanTheCase(
	caseId: string,
	arm: Immutable<ComparisonArmEvidence>,
): void {
	const recorded = arm.declaredCaseId;
	if (recorded === undefined || recorded === caseId) {
		return;
	}

	throw new ComparisonEvidenceError(
		`case ${caseId} arm ${arm.role} field caseId recorded ${recorded}; expected ${caseId}`,
	);
}

function assertExpectedRepCount(
	caseId: string,
	arm: Immutable<ComparisonArmEvidence>,
): void {
	const actual = arm.group.record.repRecords.length;
	const expected = arm.group.record.reps;
	if (actual !== expected) {
		throw new ComparisonEvidenceError(
			`case ${caseId} arm ${arm.role} field repRecords has ${actual} reps; expected ${expected}`,
		);
	}
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
		for (const role of COMPARISON_ARMS) {
			const arm = benchmarkCase.arms[role];
			assertContract({
				caseId: benchmarkCase.caseId,
				arm,
				referenceCaseId: firstCase.caseId,
				referenceArm,
			});
			assertArmRanTheCase(benchmarkCase.caseId, arm);
			assertExpectedRepCount(benchmarkCase.caseId, arm);
		}
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

export interface ComparableComparison {
	readonly cases: readonly ComparisonCaseEvidence[];
	readonly contract: ComparisonContract;
}

export function buildComparableComparison(
	loadedCases: readonly Immutable<LoadedComparisonCaseEvidence>[],
): ComparableComparison {
	const cases = loadedCases.map((benchmarkCase) => ({
		caseId: benchmarkCase.caseId,
		arms: {
			baseline: projectArm(benchmarkCase.caseId, benchmarkCase.arms.baseline),
			candidate: projectArm(benchmarkCase.caseId, benchmarkCase.arms.candidate),
			control: projectArm(benchmarkCase.caseId, benchmarkCase.arms.control),
		},
	}));

	return { cases, contract: assertComparableComparison(cases) };
}
