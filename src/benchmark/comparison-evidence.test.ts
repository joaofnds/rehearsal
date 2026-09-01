import { describe, expect, it } from "bun:test";
import type { ConfirmationGroupRecord } from "./confirmation-record";
import type { Immutable } from "./contracts";
import type {
	ComparisonArmEvidence,
	ComparisonCaseEvidence,
} from "./comparison-evidence";
import { assertComparableComparison } from "./comparison-evidence";
import type { ComparisonArm } from "./comparison-record";

interface GroupFixtureOptions {
	readonly groupId: string;
	readonly corpusDigest: string;
	readonly model?: string | undefined;
	readonly mode?: "stage" | "pipeline" | undefined;
	readonly stages?: string[] | undefined;
	readonly reps?: number | undefined;
}

function groupRecord(
	options: Immutable<GroupFixtureOptions>,
): Immutable<ConfirmationGroupRecord> {
	const reps = options.reps ?? 2;

	return {
		schemaVersion: 1,
		groupId: options.groupId,
		mode: options.mode ?? "stage",
		reps,
		declaredStages: options.stages ?? ["build"],
		inputs: {
			lineage: {
				kind: "CHECKPOINT",
				lineage: "checkpoint-1",
				targetSha: "a".repeat(40),
			},
			files: [
				{
					kind: "checkpoint",
					path: "inputs/checkpoint/state.json",
					sha256: "b".repeat(64),
				},
				{
					kind: "corpus",
					path: "inputs/corpus/build/SKILL.md",
					sha256: options.corpusDigest,
				},
				{
					kind: "task",
					path: "inputs/task.md",
					sha256: "c".repeat(64),
				},
			],
			model: options.model ?? "sonnet",
			judgeModel: "opus",
			sessionBudgetUsd: 5,
			pipelinePath: "pipelines/default.json",
		},
		projectedCost: {
			reps,
			perRepMaximumUsd: 20,
			totalMaximumUsd: 20 * reps,
		},
		approval: { method: "yes", approved: true },
		repRecords: Array.from({ length: reps }, (_value, index) => ({
			repId: `${options.groupId}-rep-${index + 1}`,
			ordinal: index + 1,
			path: `reps/${options.groupId}-rep-${index + 1}/rep.json`,
		})),
		reportFile: "report.json",
		makespanMs: 100,
	};
}

function arm(
	role: ComparisonArm,
	record: Immutable<ConfirmationGroupRecord>,
): ComparisonArmEvidence {
	return {
		role,
		group: {
			path: `${record.groupId}/group.json`,
			sha256: "d".repeat(64),
			record,
		},
		reps: [],
		executedCorpus: record.inputs.files.filter(({ kind }) => kind === "corpus"),
	};
}

function benchmarkCase(
	caseId: string,
	corpusDigests: Readonly<Record<ComparisonArm, string>>,
): ComparisonCaseEvidence {
	return {
		caseId,
		arms: {
			baseline: arm(
				"baseline",
				groupRecord({
					groupId: `${caseId}-baseline`,
					corpusDigest: corpusDigests.baseline,
				}),
			),
			candidate: arm(
				"candidate",
				groupRecord({
					groupId: `${caseId}-candidate`,
					corpusDigest: corpusDigests.candidate,
				}),
			),
			control: arm(
				"control",
				groupRecord({
					groupId: `${caseId}-control`,
					corpusDigest: corpusDigests.control,
				}),
			),
		},
	};
}

const CORPUS_DIGESTS = {
	baseline: "1".repeat(64),
	candidate: "2".repeat(64),
	control: "3".repeat(64),
} as const;

describe(assertComparableComparison.name, () => {
	it("accepts corpus treatment differences with matched controlled inputs", () => {
		const cases = [
			benchmarkCase("case-1", CORPUS_DIGESTS),
			benchmarkCase("case-2", CORPUS_DIGESTS),
		];

		const contract = assertComparableComparison(cases);

		expect(contract).toEqual({
			mode: "stage",
			declaredStages: ["build"],
			reps: 2,
		});
	});

	it("rejects a changed non-corpus input with both arms named", () => {
		const first = benchmarkCase("case-1", CORPUS_DIGESTS);
		const changedCandidate = arm(
			"candidate",
			groupRecord({
				groupId: "case-1-candidate",
				corpusDigest: CORPUS_DIGESTS.candidate,
				model: "haiku",
			}),
		);
		const cases = [
			{
				caseId: first.caseId,
				arms: {
					baseline: first.arms.baseline,
					candidate: changedCandidate,
					control: first.arms.control,
				},
			},
			benchmarkCase("case-2", CORPUS_DIGESTS),
		];

		expect(() => assertComparableComparison(cases)).toThrow(
			"case case-1 arms baseline and candidate field inputs.model",
		);
	});

	it("rejects a changed corpus snapshot within one arm across cases", () => {
		const cases = [
			benchmarkCase("case-1", CORPUS_DIGESTS),
			benchmarkCase("case-2", {
				baseline: CORPUS_DIGESTS.baseline,
				candidate: "4".repeat(64),
				control: CORPUS_DIGESTS.control,
			}),
		];

		expect(() => assertComparableComparison(cases)).toThrow(
			"case case-2 arm candidate field inputs.files.corpus differs from case case-1",
		);
	});

	it("rejects a changed reportable group contract", () => {
		const first = benchmarkCase("case-1", CORPUS_DIGESTS);
		const changedControl = arm(
			"control",
			groupRecord({
				groupId: "case-1-control",
				corpusDigest: CORPUS_DIGESTS.control,
				stages: ["shape", "build"],
			}),
		);
		const cases = [
			{
				caseId: first.caseId,
				arms: {
					baseline: first.arms.baseline,
					candidate: first.arms.candidate,
					control: changedControl,
				},
			},
			benchmarkCase("case-2", CORPUS_DIGESTS),
		];

		expect(() => assertComparableComparison(cases)).toThrow(
			"case case-1 arm control field declaredStages differs from case case-1 arm baseline",
		);
	});
});
