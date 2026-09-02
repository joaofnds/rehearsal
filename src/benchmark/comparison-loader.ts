import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { buildComparableComparison } from "./comparison-comparability";
import type {
	ConfirmationGroupRecord,
	ConfirmationRepRecord,
} from "./confirmation-record";
import {
	parseConfirmationGroupRecord,
	parseConfirmationRepRecord,
} from "./confirmation-record";
import type { Immutable } from "./contracts";
import type {
	ComparisonEvidence,
	DigestedRecord,
	FrozenFile,
	LoadedComparisonArmEvidence,
	LoadedComparisonCaseEvidence,
	LoadedFrozenFile,
} from "./comparison-evidence";
import { ComparisonEvidenceError } from "./comparison-evidence";
import type { ComparisonArm, ComparisonManifest } from "./comparison-record";
import { COMPARISON_ARMS, parseComparisonManifest } from "./comparison-record";

export const REQUIRED_FROZEN_INPUT_KINDS = [
	"checkpoint",
	"corpus",
	"rubric",
	"pipeline",
	"instructions",
	"task",
	"product-brief",
] as const;

interface EvidenceLocation {
	readonly caseId: string;
	readonly arm: ComparisonArm | "all";
	readonly field: string;
}

interface ReadEvidenceFileRequest extends EvidenceLocation {
	readonly path: string;
}

interface EvidenceFile {
	readonly canonicalPath: string;
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

function sameValue<Value>(left: Value, right: Value): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
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
		canonicalPath: await realpath(request.path),
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

interface VerifiedFrozenFiles {
	readonly files: readonly LoadedFrozenFile[];
	readonly sourcePaths: readonly string[];
}

async function assertFrozenFiles(
	request: Readonly<LoadArmRequest>,
	groupPath: string,
	group: Immutable<ConfirmationGroupRecord>,
): Promise<VerifiedFrozenFiles> {
	const identities = new Set<string>();
	const kinds = new Set<FrozenFile["kind"]>();
	const files: LoadedFrozenFile[] = [];
	const sourcePaths: string[] = [];
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

		files.push({ record: frozen, text: source.text });
		sourcePaths.push(source.canonicalPath);
	}

	for (const kind of REQUIRED_FROZEN_INPUT_KINDS) {
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

	return { files, sourcePaths };
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
			canonicalPath: source.canonicalPath,
		});
	}

	return reps;
}

async function loadArm(
	request: Readonly<LoadArmRequest>,
): Promise<LoadedComparisonArmEvidence> {
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

	const frozen = await assertFrozenFiles(request, groupPath, group);
	const reps = await loadRepRecords(request, groupPath, group);

	return {
		role: request.role,
		group: {
			path: relative(request.manifestDirectory, groupPath),
			sha256: source.sha256,
			record: group,
			canonicalPath: source.canonicalPath,
		},
		reps,
		frozenFiles: frozen.files,
		sourcePaths: [
			source.canonicalPath,
			...reps.map(
				({ canonicalPath, path }) =>
					canonicalPath ?? resolve(request.manifestDirectory, path),
			),
			...frozen.sourcePaths,
		],
	};
}

async function loadCase(
	manifestDirectory: string,
	benchmarkCase: ComparisonManifest["cases"][number],
): Promise<LoadedComparisonCaseEvidence> {
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
	const loadedCases: LoadedComparisonCaseEvidence[] = [];
	for (const benchmarkCase of manifest.cases) {
		loadedCases.push(await loadCase(manifestDirectory, benchmarkCase));
	}

	const { cases, contract } = buildComparableComparison(loadedCases);

	return {
		manifest: { path: absoluteManifestPath, sha256: source.sha256 },
		cases,
		contract,
		sourcePaths: [
			source.canonicalPath,
			...loadedCases.flatMap(({ arms }) =>
				COMPARISON_ARMS.flatMap((role) => arms[role].sourcePaths),
			),
		],
	};
}
