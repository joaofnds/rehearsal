import { mkdir } from "node:fs/promises";
import type { z } from "zod";
import { buildComparisonReport } from "./comparison-report";
import { serializeComparisonReport } from "./comparison-record";
import { comparisonEvidenceFixture } from "./comparison-test-fixtures";
import type { CheckpointRecord, HashedFile } from "./checkpoint";
import {
	captureStageCorpus,
	INITIAL_CHECKPOINT_STAGE,
	parseCheckpointRecord,
	stageCorpusRoots,
} from "./checkpoint";
import type { CorpusRoot } from "./corpus-file";
import { hashCorpusFiles, resolveCorpusFile } from "./corpus-file";
import type { Immutable } from "./contracts";
import { confirmationGroupRecordSchema } from "./confirmation-record";
import type { ConfirmationGroupRecord } from "./confirmation-record";
import type { RunManifest } from "./manifest";
import { writeRunManifest } from "./manifest";
import { openRunEventStore } from "./run-events";
import type {
	GroupReportSummaryRecord,
	RunSummaryRecord,
} from "./record-summary";
import { groupReportSummarySchema, runSummarySchema } from "./record-summary";
import type { SessionAttemptRecord } from "./session-record";
import { sessionAttemptRecordSchema } from "./session-record";
import { replayRecordSchema } from "./replay";
import { CONTROL_DIR } from "./config";
import {
	DEFAULT_STAGE_SETTINGS_FILE,
	loadStageSettings,
} from "./stage-settings";
import { join } from "node:path";
import type { SessionAttemptId, StageAttemptId } from "./run-layout";
import {
	benchmarkRunPaths,
	checkpointRecordFile,
	comparisonReportPaths,
	confirmationGroupPaths,
	replayRecordFile,
	runEventsDatabaseFile,
	sessionAttemptPaths,
} from "./run-layout";

const CASE_ID = "audit-log";
const SOURCE_ROOT = "/sources/template";
const CORPUS_DIGEST = "a".repeat(64);
const COMPARISON_DIGEST = "c".repeat(64);

type ParsedReplayRecord = z.infer<typeof replayRecordSchema>;

type LegacyGroupRecord = Omit<ConfirmationGroupRecord, "caseId">;

/**
 * Every shape this fixture writes: the parsed records, and the group record as
 * it was written before it named a case, which the parser still reads by
 * filling that field with the legacy default.
 */
type WrittenRecord =
	| CheckpointRecord
	| ParsedReplayRecord
	| ConfirmationGroupRecord
	| LegacyGroupRecord
	| GroupReportSummaryRecord
	| RunSummaryRecord
	| SessionAttemptRecord;

function serialize(record: Immutable<WrittenRecord>): string {
	return `${JSON.stringify(record, null, 2)}\n`;
}

function manifest(timestamp: string, sourceRoot: string): RunManifest {
	return {
		caseId: CASE_ID,
		timestamp,
		controlSha: "1".repeat(40),
		sourceRoot,
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

/**
 * A directory in corpus layout, named the way `resolveCorpusSource` names one,
 * so a test can hand a fixture or a staleness report the same value the
 * command would have resolved.
 */
export function directorySource(root: string): CorpusRoot {
	return { kind: "directory", root };
}

export function corpusPath(stage: string): string {
	return `skills/${stage}/SKILL.md`;
}

function checkpoint(
	stage: string,
	layoutPath: string,
	settingsFile?: HashedFile,
): CheckpointRecord {
	return {
		stage,
		targetSha: "2".repeat(40),
		lineage: `lineage-${stage}`,
		upstream: stage === "discuss" ? "root-lineage" : "lineage-discuss",
		model: "sonnet",
		corpusFiles: [{ path: layoutPath, sha256: CORPUS_DIGEST }],
		artifacts: [],
		workflowState: [],
		settingsFile,
	};
}

async function currentSettingsFile(): Promise<HashedFile> {
	return (
		await loadStageSettings(join(CONTROL_DIR, DEFAULT_STAGE_SETTINGS_FILE))
	).hashed;
}

function initialCheckpoint(settingsFile: HashedFile): CheckpointRecord {
	return {
		stage: INITIAL_CHECKPOINT_STAGE,
		targetSha: "2".repeat(40),
		lineage: "lineage-initial",
		upstream: "root-lineage",
		model: "sonnet",
		corpusFiles: [],
		artifacts: [],
		workflowState: [],
		settingsFile,
	};
}

/**
 * Every field a group record carries except the case it names. The legacy
 * shape written before that field existed is this literal, so it is built by
 * never adding the field rather than by adding it and taking it back off, and
 * the parsed record is this literal plus the field.
 */
function groupFieldsWithoutCaseId(groupId: string): LegacyGroupRecord {
	return {
		schemaVersion: 1,
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
	};
}

function group(groupId: string): ConfirmationGroupRecord {
	return confirmationGroupRecordSchema.parse({
		...groupFieldsWithoutCaseId(groupId),
		caseId: CASE_ID,
	});
}

/**
 * The reliability and resource halves of the report a group writes beside its
 * record: `--json` prints the group record, and the summary reads this.
 */
function groupReport(): GroupReportSummaryRecord {
	return groupReportSummarySchema.parse({
		reliability: [
			{
				name: "build",
				requested: 2,
				attempted: 2,
				notReached: 0,
				failed: 1,
				successful: 1,
				successRate: 0.5,
				standardError: 0.35355339059327373,
				passK: 0.25,
			},
		],
		resources: { total: { costUsd: [1.25, 2.75] } },
	});
}

function replayRecord(runName: string, timestamp: string): ParsedReplayRecord {
	return replayRecordSchema.parse({
		replay: true,
		timestamp,
		runName,
		stage: "build",
		consumed: {
			stage: "discuss",
			lineage: "lineage-discuss",
			targetSha: "2".repeat(40),
		},
		baseSha: "2".repeat(40),
		lineage: "lineage-build",
		corpusFiles: [{ path: corpusPath("build"), sha256: CORPUS_DIGEST }],
		model: "sonnet",
		judgeModel: "opus",
		sessionBudgetUsd: 5,
		controlSha: "1".repeat(40),
		stageCostUsd: 1,
		productOwnerCostUsd: 0.25,
		judgeCostUsd: 0.5,
		stale: false,
		staleness: [],
		scorecard: {
			stage: "build",
			costUsd: 1,
			grade: { grade: "A", verdict: "CONTINUE", dimensions: [] },
		},
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
	public readonly stageAttempt: StageAttemptId = {
		lineage: "lineage-build",
		timestamp: "2026-09-03T01-00-00.000Z",
	};
	public readonly stoppedRun = "2026-09-04T00-00-00.000Z";
	public readonly noRecordRun = "2026-09-05T00-00-00.000Z";
	public readonly interruptedRun = "2026-09-06T00-00-00.000Z";

	public constructor(
		public readonly runsDirectory: string,
		private readonly sourceRoot: string = SOURCE_ROOT,
	) {}

	public get stageAttemptFile(): string {
		return replayRecordFile(
			this.runsDirectory,
			this.stageAttempt.lineage,
			this.stageAttempt.timestamp,
		);
	}

	public get sessionAttemptFile(): string {
		return sessionAttemptPaths(this.runsDirectory, this.sessionAttempt)
			.recordFile;
	}

	/**
	 * Re-records every checkpoint's corpus files by hashing a real corpus
	 * through the same resolver and roots `stale` reads it by, so a staleness
	 * observation compares what the harness records against what it would
	 * record today rather than against a digest this fixture made up. Taking a
	 * corpus root rather than a directory path is what lets the live install be
	 * recorded against too.
	 */
	public async recordCorpusFrom(source: CorpusRoot): Promise<void> {
		const paths = benchmarkRunPaths(this.runsDirectory, this.replayableRun);
		const instructions = await Bun.file(
			resolveCorpusFile(source, "CLAUDE.md"),
		).text();
		const roots = stageCorpusRoots(source, this.sourceRoot);
		const settingsFile = await currentSettingsFile();

		for (const stage of this.stages) {
			const corpusFiles = await captureStageCorpus(stage, instructions, roots);
			const directory = paths.checkpointDirectory(stage);
			await Bun.write(
				checkpointRecordFile(directory),
				serialize({
					...checkpoint(stage, corpusPath(stage), settingsFile),
					corpusFiles,
				}),
			);
		}
	}

	public async writeInitialCheckpoint(): Promise<void> {
		const paths = benchmarkRunPaths(this.runsDirectory, this.replayableRun);
		const directory = paths.checkpointDirectory(INITIAL_CHECKPOINT_STAGE);
		await mkdir(directory, { recursive: true });
		await Bun.write(
			checkpointRecordFile(directory),
			serialize(initialCheckpoint(await currentSettingsFile())),
		);
	}

	public async recordSettingsFile(
		settingsFile: HashedFile | undefined,
	): Promise<void> {
		const paths = benchmarkRunPaths(this.runsDirectory, this.replayableRun);
		for (const stage of [INITIAL_CHECKPOINT_STAGE, ...this.stages]) {
			const file = Bun.file(
				checkpointRecordFile(paths.checkpointDirectory(stage)),
			);
			if (!(await file.exists())) {
				continue;
			}
			const record = parseCheckpointRecord(await file.text());
			await Bun.write(file, serialize({ ...record, settingsFile }));
		}
	}

	/**
	 * One session attempt for a case, recording the digests a corpus directory
	 * holds right now, so a later comparison against an edited corpus is a
	 * comparison of real bytes rather than of a digest this fixture invented.
	 */
	public async writeAttemptReading(
		corpusRoot: string,
		caseId: string,
		layoutPaths: readonly string[],
	): Promise<void> {
		await this.writeAttemptAt(
			this.sessionAttempt.uuid,
			corpusRoot,
			caseId,
			layoutPaths,
		);
	}

	/**
	 * One attempt under a uuid the caller names, so a test can put two attempts
	 * for one case on disk and set their modification times itself. Recency is
	 * decided by mtime today, and without two records nothing observes that.
	 */
	public async writeAttemptAt(
		uuid: string,
		corpusRoot: string,
		caseId: string,
		layoutPaths: readonly string[],
	): Promise<string> {
		const corpusFiles = await hashCorpusFiles(
			directorySource(corpusRoot),
			layoutPaths,
		);
		const { recordFile } = sessionAttemptPaths(this.runsDirectory, {
			caseId,
			uuid,
		});
		await Bun.write(
			recordFile,
			serialize(
				sessionAttemptRecordSchema.parse({
					...sessionAttempt(caseId),
					corpusFiles,
				}),
			),
		);

		return recordFile;
	}

	public async writeGroupReport(groupId: string): Promise<void> {
		const paths = confirmationGroupPaths(this.runsDirectory, groupId);
		await mkdir(paths.directory, { recursive: true });
		await Bun.write(paths.reportFile, serialize(groupReport()));
	}

	public async write(): Promise<void> {
		await this.writeReplayableRun();
		await this.writeUnreplayableRun();
		await this.writeGroup();
		await this.writeGroupReport(this.groupId);
		await this.writeComparison();
		await this.writeSessionAttempt();
		await this.writeStageAttempt();
	}

	/**
	 * A group whose record declares no case: the parser fills the legacy default,
	 * and a reader can watch that default reach the summary without any file on
	 * this machine having been written before the field existed.
	 */
	public async writeGroupWithoutCaseId(groupId: string): Promise<void> {
		const paths = confirmationGroupPaths(this.runsDirectory, groupId);
		await mkdir(paths.directory, { recursive: true });
		await Bun.write(
			paths.groupFile,
			serialize(groupFieldsWithoutCaseId(groupId)),
		);
	}

	/**
	 * An attempt directory whose record is half-written, which is how a run that
	 * died mid-write leaves one behind.
	 */
	public async writeUnreadableAttempt(
		caseId: string,
		uuid: string,
	): Promise<void> {
		await Bun.write(
			sessionAttemptPaths(this.runsDirectory, { caseId, uuid }).recordFile,
			"{ not json\n",
		);
	}

	/**
	 * An attempt directory a run created and died before writing anything into,
	 * which is what three of this repository's own session directories are.
	 */
	public async writeEmptyAttemptDirectory(
		caseId: string,
		uuid: string,
	): Promise<void> {
		await mkdir(
			sessionAttemptPaths(this.runsDirectory, { caseId, uuid }).directory,
			{ recursive: true },
		);
	}

	/**
	 * A checkpoint stage directory a run created and died before writing a
	 * checkpoint.json into, so its lister reports it as incomplete rather
	 * than reading it.
	 */
	public async writeEmptyCheckpointDirectory(stage: string): Promise<void> {
		const paths = benchmarkRunPaths(this.runsDirectory, this.replayableRun);
		await mkdir(paths.checkpointDirectory(stage), { recursive: true });
	}

	/**
	 * A run that stopped at a stage: its checkpoints directory and manifest
	 * exist, an earlier stage's file holds a judged scorecard, and the stopping
	 * stage's file holds a stop record instead of a scorecard. No artifact file
	 * is ever written for a run that stops.
	 */
	public async writeStoppedRun(): Promise<void> {
		const paths = benchmarkRunPaths(this.runsDirectory, this.stoppedRun);
		await mkdir(paths.checkpointsDirectory, { recursive: true });
		await writeRunManifest(
			paths.manifestFile,
			manifest(this.stoppedRun, this.sourceRoot),
		);
		await Bun.write(
			paths.stageFile("discuss"),
			`${JSON.stringify(
				{
					stage: "discuss",
					costUsd: 1,
					grade: { grade: "A", verdict: "CONTINUE", dimensions: [] },
					input: {},
				},
				null,
				2,
			)}\n`,
		);
		await Bun.write(
			paths.stageFile("build"),
			`${JSON.stringify(
				{
					status: "STAGE_JUDGE_FAILED",
					stage: "build",
					error: "build stage graded F; minimum grade is B",
				},
				null,
				2,
			)}\n`,
		);
	}

	/**
	 * A stopped run whose manifest never got written, so loading it to report
	 * the stopping stage throws an error naming the missing manifest's path.
	 */
	public async writeStoppedRunWithoutManifest(): Promise<void> {
		const paths = benchmarkRunPaths(this.runsDirectory, this.stoppedRun);
		await mkdir(paths.checkpointsDirectory, { recursive: true });
		await Bun.write(
			paths.stageFile("build"),
			`${JSON.stringify(
				{
					status: "STAGE_JUDGE_FAILED",
					stage: "build",
					error: "build stage graded F; minimum grade is B",
				},
				null,
				2,
			)}\n`,
		);
	}

	/**
	 * A run that died before any stage finished: only its checkpoints directory
	 * and manifest exist, which is what three of this repository's own runs are.
	 */
	public async writeNoRecordRun(): Promise<void> {
		const paths = benchmarkRunPaths(this.runsDirectory, this.noRecordRun);
		await mkdir(paths.checkpointsDirectory, { recursive: true });
		await writeRunManifest(
			paths.manifestFile,
			manifest(this.noRecordRun, this.sourceRoot),
		);
	}

	/**
	 * A run a kill -9 ended: no terminal artifact, no STAGE_JUDGE_FAILED file
	 * (nothing runs to write one), only its checkpoints directory, manifest,
	 * and a run-interrupted event a reconciliation pass appended.
	 */
	public async writeInterruptedRun(): Promise<void> {
		const paths = benchmarkRunPaths(this.runsDirectory, this.interruptedRun);
		await mkdir(paths.checkpointsDirectory, { recursive: true });
		await writeRunManifest(
			paths.manifestFile,
			manifest(this.interruptedRun, this.sourceRoot),
		);
		const store = await openRunEventStore(
			runEventsDatabaseFile(this.runsDirectory),
		);
		store.append({
			runId: this.interruptedRun,
			kind: "run-interrupted",
			stage: "build",
			spentUsd: 1,
			elapsedMs: 5000,
		});
		store.close();
	}

	/**
	 * An interrupted run whose manifest never got written, so loading it to
	 * report its case ID throws an error naming the missing manifest's path.
	 */
	public async writeInterruptedRunWithoutManifest(): Promise<void> {
		const paths = benchmarkRunPaths(this.runsDirectory, this.interruptedRun);
		await mkdir(paths.checkpointsDirectory, { recursive: true });
		const store = await openRunEventStore(
			runEventsDatabaseFile(this.runsDirectory),
		);
		store.append({
			runId: this.interruptedRun,
			kind: "run-interrupted",
			stage: "build",
			spentUsd: 1,
			elapsedMs: 5000,
		});
		store.close();
	}

	public async writeUnreadableGroup(groupId: string): Promise<void> {
		const paths = confirmationGroupPaths(this.runsDirectory, groupId);
		await mkdir(paths.directory, { recursive: true });
		await Bun.write(paths.groupFile, "{ not json\n");
	}

	private async writeReplayableRun(): Promise<void> {
		const paths = benchmarkRunPaths(this.runsDirectory, this.replayableRun);
		await mkdir(paths.checkpointsDirectory, { recursive: true });
		await writeRunManifest(
			paths.manifestFile,
			manifest(this.replayableRun, this.sourceRoot),
		);

		const settingsFile = await currentSettingsFile();
		for (const stage of this.stages) {
			const directory = paths.checkpointDirectory(stage);
			await mkdir(directory, { recursive: true });
			await Bun.write(
				checkpointRecordFile(directory),
				serialize(checkpoint(stage, corpusPath(stage), settingsFile)),
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
			workflow: this.stages.map((stage, index) => ({
				stage,
				costUsd: index + 1,
			})),
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

	private async writeStageAttempt(): Promise<void> {
		await Bun.write(
			this.stageAttemptFile,
			serialize(replayRecord(this.replayableRun, this.stageAttempt.timestamp)),
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
