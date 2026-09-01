import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";
import type {
	ConfirmationGroupRecord,
	ConfirmationRepRecord,
} from "./confirmation-record";
import {
	parseConfirmationGroupRecord,
	parseConfirmationRepRecord,
} from "./confirmation-record";
import type { Immutable } from "./contracts";
import type { ComparisonArm, ComparisonManifest } from "./comparison-record";
import { COMPARISON_ARMS, parseComparisonManifest } from "./comparison-record";

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

export interface ComparisonEvidence {
	readonly manifest: {
		readonly path: string;
		readonly sha256: string;
	};
	readonly cases: readonly ComparisonCaseEvidence[];
	readonly contract: ComparisonContract;
}

export class ComparisonEvidenceError extends Error {
	public override name = "ComparisonEvidenceError";
}

interface EvidenceLocation {
	readonly caseId: string;
	readonly arm: ComparisonArm | "all";
	readonly field: string;
}

interface ReadEvidenceFileRequest extends EvidenceLocation {
	readonly path: string;
}

interface EvidenceFile {
	readonly sha256: string;
	readonly text: string;
}

function evidenceError(
	location: Readonly<EvidenceLocation>,
	message: string,
): ComparisonEvidenceError {
	return new ComparisonEvidenceError(
		`case ${location.caseId} arm ${location.arm} field ${location.field}: ${message}`,
	);
}

function sha256(bytes: Readonly<Uint8Array>): string {
	return createHash("sha256").update(bytes).digest("hex");
}

async function readEvidenceFile(
	request: Readonly<ReadEvidenceFileRequest>,
): Promise<EvidenceFile> {
	const file = Bun.file(request.path);
	if (!(await file.exists())) {
		throw evidenceError(request, `no file at ${request.path}`);
	}

	const bytes = await file.bytes();

	return {
		sha256: sha256(bytes),
		text: new TextDecoder().decode(bytes),
	};
}

interface LoadArmRequest {
	readonly manifestDirectory: string;
	readonly caseId: string;
	readonly role: ComparisonArm;
	readonly groupReference: string;
}

function assertRepMatchesGroup(
	location: Readonly<EvidenceLocation>,
	reference: ConfirmationGroupRecord["repRecords"][number],
	record: Immutable<ConfirmationRepRecord>,
	group: Immutable<ConfirmationGroupRecord>,
): void {
	if (record.groupId !== group.groupId) {
		throw evidenceError(
			{ ...location, field: `${location.field}.groupId` },
			"rep group ID disagrees with its source group",
		);
	}
	if (record.repId !== reference.repId) {
		throw evidenceError(
			{ ...location, field: `${location.field}.repId` },
			"rep ID disagrees with its source group reference",
		);
	}
	if (record.ordinal !== reference.ordinal) {
		throw evidenceError(
			{ ...location, field: `${location.field}.ordinal` },
			"rep ordinal disagrees with its source group reference",
		);
	}
	if (record.mode !== group.mode) {
		throw evidenceError(
			{ ...location, field: `${location.field}.mode` },
			"rep mode disagrees with its source group",
		);
	}
	if (!sameValue(record.lineage, group.inputs.lineage)) {
		throw evidenceError(
			{ ...location, field: `${location.field}.lineage` },
			"rep lineage disagrees with its source group",
		);
	}

	const repStages = record.stages.map(({ stage }) => stage);
	if (!sameValue(repStages, group.declaredStages)) {
		throw evidenceError(
			{ ...location, field: `${location.field}.stages` },
			"rep stages disagree with its source group",
		);
	}
	if (
		group.mode === "stage" &&
		record.finalOutcome.status !== "NOT_APPLICABLE"
	) {
		throw evidenceError(
			{ ...location, field: `${location.field}.finalOutcome` },
			"stage rep final outcome must be not applicable",
		);
	}
	if (
		group.mode === "pipeline" &&
		record.finalOutcome.status === "NOT_APPLICABLE"
	) {
		throw evidenceError(
			{ ...location, field: `${location.field}.finalOutcome` },
			"pipeline rep final outcome cannot be not applicable",
		);
	}
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

async function assertFrozenFiles(
	request: Readonly<LoadArmRequest>,
	groupPath: string,
	group: Immutable<ConfirmationGroupRecord>,
): Promise<void> {
	const identities = new Set<string>();
	const kinds = new Set<FrozenFile["kind"]>();
	for (const frozen of group.inputs.files) {
		const identity = `${frozen.kind}:${frozen.path}`;
		const field = `inputs.files[${identity}]`;
		if (identities.has(identity)) {
			throw evidenceError(
				{ caseId: request.caseId, arm: request.role, field },
				"duplicate frozen input path",
			);
		}

		identities.add(identity);
		kinds.add(frozen.kind);
		const source = await readEvidenceFile({
			caseId: request.caseId,
			arm: request.role,
			field: `${field}.path`,
			path: resolve(dirname(groupPath), frozen.path),
		});
		if (source.sha256 !== frozen.sha256) {
			throw evidenceError(
				{ caseId: request.caseId, arm: request.role, field: `${field}.sha256` },
				`recorded ${frozen.sha256} but found ${source.sha256}`,
			);
		}
	}

	for (const kind of [
		"checkpoint",
		"corpus",
		"rubric",
		"pipeline",
		"instructions",
		"task",
		"product-brief",
	] as const) {
		if (!kinds.has(kind)) {
			throw evidenceError(
				{
					caseId: request.caseId,
					arm: request.role,
					field: `inputs.files.${kind}`,
				},
				`source group records no ${kind} input`,
			);
		}
	}
	if (executedCorpusFiles(group).length === 0) {
		throw evidenceError(
			{
				caseId: request.caseId,
				arm: request.role,
				field: "inputs.files.corpus",
			},
			"source group records no executed corpus",
		);
	}
}

async function loadRepRecords(
	request: Readonly<LoadArmRequest>,
	groupPath: string,
	group: Immutable<ConfirmationGroupRecord>,
): Promise<readonly DigestedRecord<Immutable<ConfirmationRepRecord>>[]> {
	const reps: DigestedRecord<Immutable<ConfirmationRepRecord>>[] = [];
	for (const [index, reference] of group.repRecords.entries()) {
		const field = `repRecords[${index}]`;
		const path = resolve(dirname(groupPath), reference.path);
		const source = await readEvidenceFile({
			caseId: request.caseId,
			arm: request.role,
			field: `${field}.path`,
			path,
		});
		let record: ConfirmationRepRecord;
		try {
			record = parseConfirmationRepRecord(source.text);
		} catch {
			throw evidenceError(
				{ caseId: request.caseId, arm: request.role, field: `${field}.record` },
				"invalid confirmation rep record",
			);
		}

		assertRepMatchesGroup(
			{ caseId: request.caseId, arm: request.role, field },
			reference,
			record,
			group,
		);
		reps.push({
			path: relative(request.manifestDirectory, path),
			sha256: source.sha256,
			record,
		});
	}

	return reps;
}

async function loadArm(
	request: Readonly<LoadArmRequest>,
): Promise<ComparisonArmEvidence> {
	const groupPath = resolve(request.manifestDirectory, request.groupReference);
	const source = await readEvidenceFile({
		caseId: request.caseId,
		arm: request.role,
		field: "group.path",
		path: groupPath,
	});
	let group: ConfirmationGroupRecord;
	try {
		group = parseConfirmationGroupRecord(source.text);
	} catch {
		throw evidenceError(
			{ caseId: request.caseId, arm: request.role, field: "group.record" },
			"invalid confirmation group record",
		);
	}

	await assertFrozenFiles(request, groupPath, group);
	const reps = await loadRepRecords(request, groupPath, group);

	return {
		role: request.role,
		group: {
			path: relative(request.manifestDirectory, groupPath),
			sha256: source.sha256,
			record: group,
		},
		reps,
		executedCorpus: executedCorpusFiles(group),
	};
}

async function loadCase(
	manifestDirectory: string,
	benchmarkCase: ComparisonManifest["cases"][number],
): Promise<ComparisonCaseEvidence> {
	const baseline = await loadArm({
		manifestDirectory,
		caseId: benchmarkCase.caseId,
		role: "baseline",
		groupReference: benchmarkCase.arms.baseline,
	});
	const candidate = await loadArm({
		manifestDirectory,
		caseId: benchmarkCase.caseId,
		role: "candidate",
		groupReference: benchmarkCase.arms.candidate,
	});
	const control = await loadArm({
		manifestDirectory,
		caseId: benchmarkCase.caseId,
		role: "control",
		groupReference: benchmarkCase.arms.control,
	});

	return {
		caseId: benchmarkCase.caseId,
		arms: { baseline, candidate, control },
	};
}

export async function loadComparisonEvidence(
	manifestPath: string,
): Promise<ComparisonEvidence> {
	const absoluteManifestPath = resolve(manifestPath);
	const source = await readEvidenceFile({
		caseId: "manifest",
		arm: "all",
		field: "manifest.path",
		path: absoluteManifestPath,
	});
	const manifest = parseComparisonManifest(source.text);
	const manifestDirectory = dirname(absoluteManifestPath);
	const cases: ComparisonCaseEvidence[] = [];
	for (const benchmarkCase of manifest.cases) {
		cases.push(await loadCase(manifestDirectory, benchmarkCase));
	}

	return {
		manifest: { path: absoluteManifestPath, sha256: source.sha256 },
		cases,
		contract: assertComparableComparison(cases),
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
	const leftFiles = sortedFiles(
		left.filter(({ kind }) => kind !== "corpus" && kind !== "instructions"),
	);
	const rightFiles = sortedFiles(
		right.filter(({ kind }) => kind !== "corpus" && kind !== "instructions"),
	);
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
