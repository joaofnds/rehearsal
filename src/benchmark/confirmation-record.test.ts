import { describe, expect, it } from "bun:test";
import type {
	ConfirmationGroupRecord,
	ConfirmationRepRecord,
} from "./confirmation-record";
import {
	parseConfirmationGroupRecord,
	parseConfirmationRepRecord,
} from "./confirmation-record";

describe(parseConfirmationRepRecord.name, () => {
	function completeRepRecord(): ConfirmationRepRecord {
		const resultSha = "a".repeat(40);
		const metrics = {
			costUsd: 0.5,
			inputTokens: 100,
			outputTokens: 20,
			cacheReadTokens: 30,
			cacheWriteTokens: 40,
			turns: 3,
		};

		return {
			schemaVersion: 1,
			groupId: "group-1",
			repId: "group-1-rep-1",
			ordinal: 1,
			mode: "pipeline",
			worktreePath: "/worktrees/group-1-rep-1",
			lineage: { kind: "SOURCE", sha: resultSha },
			outcome: "SUCCESSFUL",
			stages: [
				{
					stage: "shape",
					status: "JUDGED",
					grade: "A",
					verdict: "CONTINUE",
					elapsedMs: 120,
					evidence: {
						resultSha,
						recordFile: "stages/shape.json",
					},
				},
			],
			finalOutcome: {
				status: "JUDGED",
				verdict: "PASS",
				evidence: {
					resultSha,
					recordFile: "rep.json",
				},
			},
			metrics: {
				status: "COMPLETE",
				calls: [
					{ role: "worker", metrics },
					{ role: "product-owner", metrics: { ...metrics, turns: 1 } },
					{ role: "stage-judge", metrics: { ...metrics, turns: 2 } },
					{ role: "final-judge", metrics: { ...metrics, turns: 2 } },
				],
			},
			workerTrajectorySteps: 3,
			elapsedMs: 500,
		};
	}

	it("accepts complete role-attributed evidence", () => {
		const record = completeRepRecord();

		expect(parseConfirmationRepRecord(JSON.stringify(record))).toEqual(record);
	});

	it("rejects unknown fields", () => {
		const record = { ...completeRepRecord(), extra: true };

		expect(() => parseConfirmationRepRecord(JSON.stringify(record))).toThrow();
	});

	it("accepts retained evidence for a failed final Judge", () => {
		const record = {
			...completeRepRecord(),
			outcome: "UNSUCCESSFUL" as const,
			finalOutcome: {
				status: "EXECUTION_FAILED" as const,
				error: "Judge rejected both attempts",
				evidence: {
					resultSha: "a".repeat(40),
					recordFile: "final.json",
				},
			},
		};

		expect(parseConfirmationRepRecord(JSON.stringify(record))).toEqual(record);
	});

	it("rejects success when required provider metrics are missing", () => {
		const record = {
			...completeRepRecord(),
			metrics: {
				status: "MISSING",
				calls: [],
				missing: ["worker.inputTokens"],
			},
		};

		expect(() => parseConfirmationRepRecord(JSON.stringify(record))).toThrow(
			"Missing provider metrics cannot produce a successful rep",
		);
	});

	it("rejects a trajectory count that differs from worker turns", () => {
		const record = {
			...completeRepRecord(),
			workerTrajectorySteps: 4,
		};

		expect(() => parseConfirmationRepRecord(JSON.stringify(record))).toThrow(
			"Worker trajectory steps must equal provider-reported worker turns",
		);
	});
});

describe(parseConfirmationGroupRecord.name, () => {
	function groupRecord(): ConfirmationGroupRecord {
		return {
			schemaVersion: 1,
			groupId: "group-1",
			mode: "stage",
			reps: 2,
			declaredStages: ["build"],
			inputs: {
				lineage: {
					kind: "CHECKPOINT",
					lineage: "checkpoint-1",
					targetSha: "a".repeat(40),
				},
				files: [
					{
						kind: "corpus",
						path: "inputs/corpus/build/SKILL.md",
						sha256: "b".repeat(64),
					},
					{
						kind: "rubric",
						path: "inputs/rubrics/build.json",
						sha256: "c".repeat(64),
					},
				],
				model: "sonnet",
				effort: "high",
				judgeModel: "opus",
				judgeEffort: "high",
				sessionBudgetUsd: 5,
				pipelinePath: "pipelines/default.json",
			},
			projectedCost: {
				reps: 2,
				perRepMaximumUsd: 20,
				totalMaximumUsd: 40,
			},
			approval: { method: "yes", approved: true },
			repRecords: [
				{
					repId: "group-1-rep-1",
					ordinal: 1,
					path: "reps/group-1-rep-1/rep.json",
				},
				{
					repId: "group-1-rep-2",
					ordinal: 2,
					path: "reps/group-1-rep-2/rep.json",
				},
			],
			reportFile: "report.json",
			makespanMs: 300,
		};
	}

	it("accepts one frozen group envelope with every rep reference", () => {
		const record = groupRecord();

		expect(parseConfirmationGroupRecord(JSON.stringify(record))).toEqual(
			record,
		);
	});

	it("rejects a group missing a requested rep record", () => {
		const record = {
			...groupRecord(),
			repRecords: groupRecord().repRecords.slice(1),
		};

		expect(() => parseConfirmationGroupRecord(JSON.stringify(record))).toThrow(
			"Group must reference every requested rep exactly once",
		);
	});
});
