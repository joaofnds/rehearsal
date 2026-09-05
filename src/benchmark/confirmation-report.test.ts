import { describe, expect, it } from "bun:test";
import {
	buildReliabilityReport,
	buildResourceReport,
} from "./confirmation-report";
import type { ClaudeCallMetrics } from "./contracts";

describe(buildReliabilityReport.name, () => {
	it("reports reliability for every stage and the final outcome", () => {
		const report = buildReliabilityReport(
			["shape", "build"],
			[
				{
					metricsComplete: true,
					stages: [
						{
							stage: "shape",
							status: "JUDGED",
							grade: "A",
							verdict: "CONTINUE",
						},
						{
							stage: "build",
							status: "JUDGED",
							grade: "B",
							verdict: "CONTINUE",
						},
					],
					finalOutcome: { status: "JUDGED", verdict: "PASS" },
				},
				{
					metricsComplete: true,
					stages: [
						{
							stage: "shape",
							status: "JUDGED",
							grade: "B",
							verdict: "CONTINUE",
						},
						{
							stage: "build",
							status: "JUDGED",
							grade: "C",
							verdict: "STOP",
						},
					],
					finalOutcome: { status: "JUDGED", verdict: "FAIL" },
				},
				{
					metricsComplete: true,
					stages: [
						{
							stage: "shape",
							status: "JUDGED",
							grade: "D",
							verdict: "STOP",
						},
						{ stage: "build", status: "NOT_REACHED" },
					],
					finalOutcome: { status: "NOT_REACHED" },
				},
				{
					metricsComplete: true,
					stages: [
						{ stage: "shape", status: "EXECUTION_FAILED" },
						{ stage: "build", status: "NOT_REACHED" },
					],
					finalOutcome: { status: "NOT_REACHED" },
				},
				{
					metricsComplete: true,
					stages: [
						{ stage: "shape", status: "METRICS_MISSING" },
						{ stage: "build", status: "NOT_REACHED" },
					],
					finalOutcome: { status: "NOT_REACHED" },
				},
			],
		);

		expect(report).toEqual([
			{
				name: "shape",
				requested: 5,
				attempted: 5,
				notReached: 0,
				failed: 3,
				successful: 2,
				gradeDistribution: Object.fromEntries([
					["A", 1],
					["B", 1],
					["D", 1],
				]),
				successRate: 0.4,
				standardError: Math.sqrt((0.4 * 0.6) / 5),
				passK: 0.4 ** 5,
			},
			{
				name: "build",
				requested: 5,
				attempted: 2,
				notReached: 3,
				failed: 1,
				successful: 1,
				gradeDistribution: Object.fromEntries([
					["B", 1],
					["C", 1],
				]),
				successRate: 0.2,
				standardError: Math.sqrt((0.2 * 0.8) / 5),
				passK: 0.2 ** 5,
			},
			{
				name: "final",
				requested: 5,
				attempted: 2,
				notReached: 3,
				failed: 1,
				successful: 1,
				gradeDistribution: { PASS: 1, FAIL: 1 },
				successRate: 0.2,
				standardError: Math.sqrt((0.2 * 0.8) / 5),
				passK: 0.2 ** 5,
			},
		]);
	});

	it("retains grades without counting passing outcomes with missing metrics", () => {
		const report = buildReliabilityReport(
			["build"],
			[
				{
					metricsComplete: false,
					stages: [
						{
							stage: "build",
							status: "JUDGED",
							grade: "A",
							verdict: "CONTINUE",
						},
					],
					finalOutcome: { status: "JUDGED", verdict: "PASS" },
				},
			],
		);

		expect(report.map(({ successful }) => successful)).toEqual([0, 0]);
		expect(report.map(({ gradeDistribution }) => gradeDistribution)).toEqual([
			Object.fromEntries([["A", 1]]),
			{ PASS: 1 },
		]);
	});
});

describe(buildResourceReport.name, () => {
	it("distributes complete role evidence without zero-filling missing reps", () => {
		const metric = (
			costUsd: number,
			tokens: number,
			turns: number,
		): ClaudeCallMetrics => ({
			costUsd,
			inputTokens: tokens,
			outputTokens: tokens + 1,
			cacheReadTokens: tokens + 2,
			cacheWriteTokens: tokens + 3,
			turns,
		});
		const report = buildResourceReport(
			["shape", "build"],
			[
				{
					metrics: {
						status: "COMPLETE",
						calls: [
							{ role: "worker", metrics: metric(1, 10, 2) },
							{ role: "stage-judge", metrics: metric(0.5, 5, 1) },
							{ role: "product-owner", metrics: metric(0.25, 3, 1) },
						],
					},
					workerTrajectorySteps: 2,
					elapsedMs: 40,
					stages: [
						{ stage: "shape", elapsedMs: 10 },
						{ stage: "build", elapsedMs: 20 },
					],
				},
				{
					metrics: {
						status: "COMPLETE",
						calls: [
							{ role: "worker", metrics: metric(2, 20, 4) },
							{ role: "stage-judge", metrics: metric(1, 10, 1) },
							{ role: "final-judge", metrics: metric(1.5, 15, 1) },
						],
					},
					workerTrajectorySteps: 4,
					elapsedMs: 50,
					stages: [{ stage: "shape", elapsedMs: 12 }],
				},
				{
					metrics: {
						status: "MISSING",
						calls: [],
						missing: ["worker.inputTokens"],
					},
					workerTrajectorySteps: 0,
					elapsedMs: 5,
					stages: [],
				},
			],
			75,
		);

		expect(report.completeReps).toBe(2);
		expect(report.missingMetricReps).toBe(1);
		expect(report.perRole.worker).toEqual({
			costUsd: [1, 2],
			inputTokens: [10, 20],
			outputTokens: [11, 21],
			cacheReadTokens: [12, 22],
			cacheWriteTokens: [13, 23],
		});
		expect(report.total.costUsd).toEqual([1.75, 4.5]);
		expect(report.workerTurns).toEqual([2, 4]);
		expect(report.stageElapsedMs).toEqual(
			Object.fromEntries([
				["shape", [10, 12]],
				["build", [20]],
			]),
		);
		expect(report.repElapsedMs).toEqual([40, 50]);
		expect(report.makespanMs).toBe(75);
	});
});
