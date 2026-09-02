import type {
	ConfirmationGroupRecord,
	ConfirmationRepRecord,
} from "./confirmation-record";
import type { Immutable } from "./contracts";
import type { ComparisonArm } from "./comparison-record";

export type FrozenFile = ConfirmationGroupRecord["inputs"]["files"][number];

export interface DigestedRecord<Record> {
	readonly path: string;
	readonly sha256: string;
	readonly record: Record;
	readonly canonicalPath?: string;
}

export interface LoadedFrozenFile {
	readonly record: FrozenFile;
	readonly text: string;
}

export interface LoadedComparisonArmEvidence {
	readonly role: ComparisonArm;
	readonly group: DigestedRecord<Immutable<ConfirmationGroupRecord>>;
	readonly reps: readonly DigestedRecord<Immutable<ConfirmationRepRecord>>[];
	readonly frozenFiles: readonly LoadedFrozenFile[];
	readonly sourcePaths: readonly string[];
}

export interface LoadedComparisonCaseEvidence {
	readonly caseId: string;
	readonly arms: Readonly<Record<ComparisonArm, LoadedComparisonArmEvidence>>;
}

export interface ComparisonArmEvidence {
	readonly role: ComparisonArm;
	readonly group: DigestedRecord<Immutable<ConfirmationGroupRecord>>;
	readonly reps: readonly DigestedRecord<Immutable<ConfirmationRepRecord>>[];
	readonly executedCorpus: readonly FrozenFile[];
	readonly controlledFiles: readonly FrozenFile[];
	readonly sourcePaths: readonly string[];
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

export interface ComparisonRepCaseInput {
	readonly caseId: string;
	readonly arms: Readonly<
		Record<ComparisonArm, readonly Immutable<ConfirmationRepRecord>[]>
	>;
}

export interface ComparisonProjectionInput {
	readonly contract: ComparisonContract;
	readonly cases: readonly ComparisonRepCaseInput[];
}

export interface ComparisonEvidence {
	readonly manifest: {
		readonly path: string;
		readonly sha256: string;
	};
	readonly cases: readonly ComparisonCaseEvidence[];
	readonly contract: ComparisonContract;
	readonly sourcePaths: readonly string[];
}

export class ComparisonEvidenceError extends Error {
	public override name = "ComparisonEvidenceError";
}
