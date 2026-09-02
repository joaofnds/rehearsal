import type {
	ConfirmationGroupRecord,
	ConfirmationRepRecord,
} from "./confirmation-record";
import {
	confirmationGroupRecordSchema,
	confirmationRepRecordSchema,
} from "./confirmation-record";
import type {
	ComparisonArmEvidence,
	ComparisonEvidence,
} from "./comparison-evidence";
import type { ComparisonArm } from "./comparison-record";
import type { Immutable } from "./contracts";

type StageFixtureOutcome = "pass" | "fail" | "error" | "not-reached";
type FinalFixtureOutcome = "pass" | "fail" | "not-reached";

export interface RepFixtureOutcomes {
	readonly discussion: StageFixtureOutcome;
	readonly build: StageFixtureOutcome;
	readonly final: FinalFixtureOutcome;
}

function stageOutcome(
	stage: string,
	outcome: StageFixtureOutcome,
): ConfirmationRepRecord["stages"][number] {
	if (outcome === "not-reached") {
		return { stage, status: "NOT_REACHED", reason: "upstream stopped" };
	}
	if (outcome === "error") {
		return { stage, status: "EXECUTION_FAILED", error: "execution failed" };
	}

	return {
		stage,
		status: "JUDGED",
		grade: outcome === "pass" ? "A" : "D",
		verdict: outcome === "pass" ? "CONTINUE" : "STOP",
		elapsedMs: 10,
		evidence: {
			resultSha: "e".repeat(40),
			recordFile: `stages/${stage}.json`,
		},
	};
}

function finalOutcome(
	outcome: FinalFixtureOutcome,
): ConfirmationRepRecord["finalOutcome"] {
	if (outcome === "not-reached") {
		return { status: "NOT_REACHED", reason: "upstream stopped" };
	}

	return {
		status: "JUDGED",
		verdict: outcome === "pass" ? "PASS" : "FAIL",
		evidence: {
			resultSha: "e".repeat(40),
			recordFile: "final.json",
		},
	};
}

export function comparisonRep(
	groupId: string,
	ordinal: number,
	outcomes: Readonly<RepFixtureOutcomes>,
	metricScale = 1,
): ConfirmationRepRecord {
	const successful =
		outcomes.discussion === "pass" &&
		outcomes.build === "pass" &&
		outcomes.final === "pass";

	return confirmationRepRecordSchema.parse({
		schemaVersion: 1,
		groupId,
		repId: `${groupId}-rep-${ordinal}`,
		ordinal,
		mode: "pipeline",
		worktreePath: `/worktrees/${groupId}-rep-${ordinal}`,
		lineage: { kind: "SOURCE", sha: "a".repeat(40) },
		outcome: successful ? "SUCCESSFUL" : "UNSUCCESSFUL",
		stages: [
			stageOutcome("discuss", outcomes.discussion),
			stageOutcome("build", outcomes.build),
		],
		finalOutcome: finalOutcome(outcomes.final),
		metrics: {
			status: "COMPLETE",
			calls: [
				{
					role: "worker",
					metrics: {
						costUsd: ordinal * metricScale,
						inputTokens: ordinal * 10 * metricScale,
						outputTokens: ordinal * 2 * metricScale,
						cacheReadTokens: ordinal * 3 * metricScale,
						cacheWriteTokens: ordinal * 4 * metricScale,
						turns: ordinal * metricScale,
					},
				},
			],
		},
		workerTrajectorySteps: ordinal * metricScale,
		elapsedMs: ordinal * 100,
	});
}

export const PASS: RepFixtureOutcomes = {
	discussion: "pass",
	build: "pass",
	final: "pass",
};

export const FAIL: RepFixtureOutcomes = {
	discussion: "fail",
	build: "fail",
	final: "fail",
};

export function comparisonReps(
	caseId: string,
	role: ComparisonArm,
	outcomes: readonly RepFixtureOutcomes[],
	metricScale = 1,
): readonly ConfirmationRepRecord[] {
	return outcomes.map((outcome, index) =>
		comparisonRep(`${caseId}-${role}`, index + 1, outcome, metricScale),
	);
}

export function withMissingMetrics(
	record: Immutable<ConfirmationRepRecord>,
	missing: string,
): ConfirmationRepRecord {
	return confirmationRepRecordSchema.parse({
		...record,
		outcome: "UNSUCCESSFUL",
		metrics: { status: "MISSING", calls: [], missing: [missing] },
		workerTrajectorySteps: 0,
	});
}

function reportArmEvidence(
	caseId: string,
	role: ComparisonArm,
	reps: readonly Immutable<ConfirmationRepRecord>[],
): ComparisonArmEvidence {
	const groupId = `${caseId}-${role}`;
	const corpus = {
		kind: "corpus" as const,
		path: "inputs/corpus/SKILL.md",
		sha256: { baseline: "1", candidate: "2", control: "3" }[role].repeat(64),
	};
	const record: ConfirmationGroupRecord = confirmationGroupRecordSchema.parse({
		schemaVersion: 1,
		caseId,
		groupId,
		mode: "pipeline",
		reps: 4,
		declaredStages: ["discuss", "build"],
		inputs: {
			lineage: { kind: "SOURCE", sha: "a".repeat(40) },
			files: [
				corpus,
				{
					kind: "task",
					path: "inputs/task.md",
					sha256: (caseId === "case-1" ? "4" : "5").repeat(64),
				},
			],
			model: "sonnet",
			judgeModel: "opus",
			sessionBudgetUsd: 5,
			pipelinePath: "pipelines/default.json",
		},
		projectedCost: {
			reps: 4,
			perRepMaximumUsd: 30,
			totalMaximumUsd: 120,
		},
		approval: { method: "yes", approved: true },
		repRecords: reps.map((rep) => ({
			repId: rep.repId,
			ordinal: rep.ordinal,
			path: `reps/${rep.repId}/rep.json`,
		})),
		reportFile: "report.json",
		makespanMs: 400,
	});

	return {
		role,
		group: {
			path: `groups/${groupId}/group.json`,
			sha256: "6".repeat(64),
			record,
		},
		reps: reps.map((rep) => ({
			path: `groups/${groupId}/reps/${rep.repId}/rep.json`,
			sha256: "7".repeat(64),
			record: rep,
		})),
		executedCorpus: [corpus],
		controlledFiles: record.inputs.files.filter(
			({ kind }) => kind !== "corpus" && kind !== "instructions",
		),
		sourcePaths: [],
	};
}

export function comparisonEvidenceFixture(): ComparisonEvidence {
	const cases = ["case-1", "case-2"].map((caseId) => {
		const baseline = comparisonReps(caseId, "baseline", [
			PASS,
			PASS,
			FAIL,
			FAIL,
		]);
		const candidate = comparisonReps(caseId, "candidate", [
			PASS,
			PASS,
			PASS,
			PASS,
		]);
		const control = comparisonReps(caseId, "control", [FAIL, FAIL, FAIL, FAIL]);

		return {
			caseId,
			arms: {
				baseline: reportArmEvidence(caseId, "baseline", baseline),
				candidate: reportArmEvidence(caseId, "candidate", candidate),
				control: reportArmEvidence(caseId, "control", control),
			},
		};
	});

	return {
		manifest: { path: "/tmp/comparison.json", sha256: "8".repeat(64) },
		cases,
		contract: {
			mode: "pipeline",
			declaredStages: ["discuss", "build"],
			reps: 4,
		},
		sourcePaths: [],
	};
}
