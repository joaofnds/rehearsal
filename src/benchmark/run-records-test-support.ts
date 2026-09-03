import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { buildComparisonReport } from "./comparison-report";
import { serializeComparisonReport } from "./comparison-record";
import { comparisonEvidenceFixture } from "./comparison-test-fixtures";
import type { CheckpointRecord } from "./checkpoint";
import type { Immutable } from "./contracts";
import { confirmationGroupRecordSchema } from "./confirmation-record";
import type { ConfirmationGroupRecord } from "./confirmation-record";
import type { RunManifest } from "./manifest";
import { writeRunManifest } from "./manifest";
import type { RunSummaryRecord } from "./record-summary";
import { runSummarySchema } from "./record-summary";
import type { SessionAttemptRecord } from "./session-record";
import { sessionAttemptRecordSchema } from "./session-record";
import type { SessionAttemptId } from "./run-layout";
import {
	benchmarkRunPaths,
	comparisonReportPaths,
	confirmationGroupPaths,
} from "./run-layout";

const CASE_ID = "audit-log";
const CHECKPOINT_FILE = "checkpoint.json";
const CORPUS_DIGEST = "a".repeat(64);
const COMPARISON_DIGEST = "c".repeat(64);

type WrittenRecord =
	| CheckpointRecord
	| ConfirmationGroupRecord
	| Omit<ConfirmationGroupRecord, "caseId">
	| RunSummaryRecord
	| SessionAttemptRecord;

function serialize(record: Immutable<WrittenRecord>): string {
	return `${JSON.stringify(record, null, 2)}\n`;
}

function manifest(timestamp: string): RunManifest {
	return {
		caseId: CASE_ID,
		timestamp,
		controlSha: "1".repeat(40),
		sourceRoot: "/sources/template",
		sourceSha: "2".repeat(40),
		taskId: "ACT-1",
		taskSha: "3".repeat(40),
		task: "add an audit log module",
		productBrief: "the brief",
		model: "sonnet",
		judgeModel: "opus",
		sessionBudgetUsd: 5,
		pipelinePath: "cases/audit-log/pipelines/default.json",
		pipeline: {
			statuses: ["To Do", "Build", "Done"],
			target: {
				checks: [{ command: ["bun", "run", "typecheck"] }],
				integrityFiles: ["package.json"],
			},
			stages: [
				{
					name: "discuss",
					kind: "planning",
					skill: "discuss",
					rubric: "discuss.json",
					requiresAcceptanceCriteria: false,
				},
				{
					name: "build",
					kind: "delivery",
					skill: "build",
					rubric: "build.json",
				},
			],
		},
	};
}

export function corpusPath(stage: string): string {
	return `skills/${stage}/SKILL.md`;
}

function checkpoint(stage: string, layoutPath: string): CheckpointRecord {
	return {
		stage,
		targetSha: "2".repeat(40),
		lineage: `lineage-${stage}`,
		upstream: stage === "discuss" ? "root-lineage" : "lineage-discuss",
		model: "sonnet",
		corpusFiles: [{ path: layoutPath, sha256: CORPUS_DIGEST }],
		artifacts: [],
		workflowState: [],
	};
}

function group(groupId: string): ConfirmationGroupRecord {
	return confirmationGroupRecordSchema.parse({
		schemaVersion: 1,
		caseId: CASE_ID,
		groupId,
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
					sha256: CORPUS_DIGEST,
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
			repId: `${groupId}-rep-${ordinal}`,
			ordinal,
			path: `reps/${groupId}-rep-${ordinal}/rep.json`,
		})),
		reportFile: "report.json",
		makespanMs: 200,
	});
}

function sessionAttempt(caseId: string): SessionAttemptRecord {
	return sessionAttemptRecordSchema.parse({
		schemaVersion: 1,
		caseId,
		lineage: "session-lineage",
		model: "sonnet",
		sessionBudgetUsd: 2,
		corpusFiles: [
			{
				path: "output-styles/brief.md",
				resolvedPath: "/corpus/output-styles/brief.md",
				sha256: CORPUS_DIGEST,
			},
		],
		prompt: "write the reply",
		reply: "the reply",
		transcriptFile: "transcript.jsonl",
		metrics: {
			costUsd: 0.5,
			inputTokens: 10,
			outputTokens: 20,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			turns: 1,
		},
		outcome: "SUCCESSFUL",
		checks: [{ kind: "word-band", status: "PASS", detail: "120 words" }],
		elapsedMs: 1000,
	});
}

/**
 * Every record kind `list` and `show` read, written at the paths `run-layout`
 * builds, under a root the caller owns. Nothing on this machine has recorded a
 * pipeline run, a checkpoint, a group, or a comparison, so this is the only
 * way those listings are observable; writing at the real layout paths is what
 * keeps the observation about the harness rather than about the fixture.
 */
export class RecordedRunsFixture {
	public readonly replayableRun = "2026-09-03T00-00-00.000Z";
	public readonly unreplayableRun = "2026-09-02T00-00-00.000Z";
	public readonly groupId = "group-1";
	public readonly comparisonDigest = COMPARISON_DIGEST;
	public readonly stages: readonly string[] = ["discuss", "build"];
	public readonly sessionAttempt: SessionAttemptId = {
		caseId: "smoke",
		uuid: "0f6b6f2a-0000-4000-8000-000000000001",
	};

	public constructor(public readonly runsDirectory: string) {}

	public get sessionAttemptFile(): string {
		return join(
			this.runsDirectory,
			"sessions",
			this.sessionAttempt.caseId,
			this.sessionAttempt.uuid,
			"attempt.json",
		);
	}

	public async write(): Promise<void> {
		await this.writeReplayableRun();
		await this.writeUnreplayableRun();
		await this.writeGroup();
		await this.writeComparison();
		await this.writeSessionAttempt();
	}

	/**
	 * A group whose record declares no case: the parser fills the legacy default,
	 * and a reader can watch that default reach the summary without any file on
	 * this machine having been written before the field existed.
	 */
	public async writeGroupWithoutCaseId(groupId: string): Promise<void> {
		const { caseId, ...withoutCaseId } = group(groupId);
		void caseId;
		const paths = confirmationGroupPaths(this.runsDirectory, groupId);
		await mkdir(paths.directory, { recursive: true });
		await Bun.write(paths.groupFile, serialize(withoutCaseId));
	}

	public async writeUnreadableGroup(groupId: string): Promise<void> {
		const paths = confirmationGroupPaths(this.runsDirectory, groupId);
		await mkdir(paths.directory, { recursive: true });
		await Bun.write(paths.groupFile, "{ not json\n");
	}

	private async writeReplayableRun(): Promise<void> {
		const paths = benchmarkRunPaths(this.runsDirectory, this.replayableRun);
		await mkdir(paths.checkpointsDirectory, { recursive: true });
		await writeRunManifest(paths.manifestFile, manifest(this.replayableRun));

		for (const stage of this.stages) {
			const directory = paths.checkpointDirectory(stage);
			await mkdir(directory, { recursive: true });
			await Bun.write(
				join(directory, CHECKPOINT_FILE),
				serialize(checkpoint(stage, corpusPath(stage))),
			);
		}

		await Bun.write(
			paths.artifactFile,
			serialize(this.artifact(this.replayableRun, "COMPLETE")),
		);
	}

	private async writeUnreplayableRun(): Promise<void> {
		const paths = benchmarkRunPaths(this.runsDirectory, this.unreplayableRun);
		await mkdir(paths.checkpointsDirectory, { recursive: true });
		await Bun.write(
			paths.artifactFile,
			serialize(this.artifact(this.unreplayableRun, "FAILED")),
		);
	}

	private artifact(timestamp: string, status: string): RunSummaryRecord {
		return runSummarySchema.parse({
			caseId: CASE_ID,
			timestamp,
			status,
			grade: {
				verdict: status === "COMPLETE" ? "PASS" : "FAIL",
				summary: "the final judge's summary",
				requirements: [],
			},
			productOwnerCostUsd: 0.25,
			judgeCostUsd: 1.5,
			stageScorecards: this.stages.map((stage, index) => ({
				stage,
				costUsd: index + 1,
				grade: {
					grade: index === 0 ? "A" : "B",
					verdict: "CONTINUE",
					dimensions: [],
				},
			})),
		});
	}

	private async writeGroup(): Promise<void> {
		const paths = confirmationGroupPaths(this.runsDirectory, this.groupId);
		await mkdir(paths.directory, { recursive: true });
		await Bun.write(paths.groupFile, serialize(group(this.groupId)));
	}

	private async writeComparison(): Promise<void> {
		const paths = comparisonReportPaths(
			this.runsDirectory,
			this.comparisonDigest,
		);
		await mkdir(paths.directory, { recursive: true });
		await Bun.write(
			paths.reportFile,
			serializeComparisonReport(
				buildComparisonReport(comparisonEvidenceFixture(), {
					skippedCalibrations: 0,
					baselines: [],
				}),
			),
		);
	}

	private async writeSessionAttempt(): Promise<void> {
		const file = this.sessionAttemptFile;
		await Bun.write(
			file,
			serialize(sessionAttempt(this.sessionAttempt.caseId)),
		);
	}
}
