import { describe, expect, it } from "bun:test";
import { buildComparisonReport } from "./comparison-report";
import { comparisonEvidenceFixture } from "./comparison-test-fixtures";
import { confirmationGroupRecordSchema } from "./confirmation-record";
import type {
	GroupReportSummaryRecord,
	RunSummaryRecord,
} from "./record-summary";
import {
	comparisonSummary,
	groupSummary,
	parseGroupReportSummaryRecord,
	parseRunSummaryRecord,
	runSummary,
} from "./record-summary";

const RUN_RECORD: RunSummaryRecord = parseRunSummaryRecord(
	JSON.stringify({
		caseId: "audit-log",
		timestamp: "2026-09-03T00-00-00.000Z",
		status: "COMPLETE",
		grade: { verdict: "PASS", summary: "the final judge's summary" },
		productOwnerCostUsd: 0.25,
		judgeCostUsd: 1.5,
		stageScorecards: [
			{
				stage: "discuss",
				costUsd: 1,
				grade: { grade: "A", verdict: "CONTINUE" },
			},
			{
				stage: "build",
				costUsd: 2,
				grade: { grade: "B", verdict: "CONTINUE" },
			},
		],
	}),
);

const GROUP_RECORD = confirmationGroupRecordSchema.parse({
	schemaVersion: 1,
	caseId: "audit-log",
	groupId: "group-1",
	mode: "stage",
	reps: 2,
	declaredStages: ["build"],
	inputs: {
		lineage: {
			kind: "CHECKPOINT",
			lineage: "lineage-build",
			targetSha: "2".repeat(40),
		},
		files: [
			{
				kind: "corpus",
				path: "inputs/corpus/build/SKILL.md",
				sha256: "a".repeat(64),
			},
		],
		model: "sonnet",
		judgeModel: "opus",
		sessionBudgetUsd: 5,
		pipelinePath: "cases/audit-log/pipelines/default.json",
	},
	projectedCost: { reps: 2, perRepMaximumUsd: 20, totalMaximumUsd: 40 },
	approval: { method: "yes", approved: true },
	repRecords: [1, 2].map((ordinal) => ({
		repId: `group-1-rep-${ordinal}`,
		ordinal,
		path: `reps/group-1-rep-${ordinal}/rep.json`,
	})),
	reportFile: "report.json",
	makespanMs: 200,
});

const GROUP_REPORT: GroupReportSummaryRecord = parseGroupReportSummaryRecord(
	JSON.stringify({
		reliability: [
			{
				name: "build",
				requested: 2,
				successful: 1,
				successRate: 0.5,
				standardError: 0.35355339059327373,
				passK: 0.25,
			},
		],
		resources: { total: { costUsd: [1.25, 2.75] } },
	}),
);

describe(runSummary.name, () => {
	it("renders the stages, their grades, the verdict, and the total cost", () => {
		expect(runSummary("2026-09-03T00-00-00.000Z", RUN_RECORD)).toBe(
			`## run:2026-09-03T00-00-00.000Z

Case audit-log, status COMPLETE.

| stage | grade | verdict | cost |
| --- | --- | --- | --- |
| discuss | A | CONTINUE | $1.00 |
| build | B | CONTINUE | $2.00 |

Final verdict PASS.
Total cost $4.75.
`,
		);
	});
});

describe(groupSummary.name, () => {
	it("renders the reliability summary and the group's cost", () => {
		expect(groupSummary(GROUP_RECORD, GROUP_REPORT)).toBe(
			`## group:group-1

Case audit-log, stage mode, 2 reps.

| outcome | successful | success rate | standard error | pass^k |
| --- | --- | --- | --- | --- |
| build | 1/2 | 0.500 | 0.354 | 0.250 |

Cost $4.00 over 2 reps.
`,
		);
	});
});

describe(comparisonSummary.name, () => {
	it("renders every paired delta beside the contrast against the control arm", () => {
		const report = buildComparisonReport(comparisonEvidenceFixture(), {
			skippedCalibrations: 0,
			baselines: [],
		});

		expect(comparisonSummary("c".repeat(64), report)).toBe(
			`## comparison:${"c".repeat(64)}

2 cases, pipeline mode, 4 reps.

| contrast | outcome | success rate Δ | standard error | pass^k Δ |
| --- | --- | --- | --- | --- |
| candidate − baseline | discuss | +0.500 | 0.000 | +0.938 |
| candidate − baseline | build | +0.500 | 0.000 | +0.938 |
| candidate − baseline | final | +0.500 | 0.000 | +0.938 |
| candidate − control | discuss | +1.000 | 0.000 | +1.000 |
| candidate − control | build | +1.000 | 0.000 | +1.000 |
| candidate − control | final | +1.000 | 0.000 | +1.000 |
| baseline − control | discuss | +0.500 | 0.000 | +0.063 |
| baseline − control | build | +0.500 | 0.000 | +0.063 |
| baseline − control | final | +0.500 | 0.000 | +0.063 |
`,
		);
	});
});
