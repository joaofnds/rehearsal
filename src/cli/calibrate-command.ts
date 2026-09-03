import { readdir } from "node:fs/promises";
import {
	calibrate,
	CalibrationIncompleteError,
	readStageRubrics,
} from "#benchmark/calibration";
import type {
	CalibrationJudges,
	CurrentCalibrationSources,
	FrozenCalibrationEvidence,
} from "#benchmark/calibration";
import type {
	CalibratableArtifact,
	CalibratableStageRecord,
} from "#benchmark/calibration-record";
import {
	calibratableArtifactSchema,
	calibratableStageRecordSchema,
} from "#benchmark/calibration-record";
import { caseRelative, readCaseDeclaration } from "#benchmark/case";
import { displayPath, readProjectInstructions } from "#benchmark/config";
import type { Effort } from "#benchmark/config";
import type {
	CalibrationResult,
	HumanReview,
	StageScorecard,
} from "#benchmark/contracts";
import { humanReviewSchema } from "#benchmark/contracts";
import type { JudgeAgreementCalibration } from "#benchmark/judge-agreement";
import { loadJudgeAgreementReport } from "#benchmark/judge-agreement";
import { runJudge } from "#benchmark/judge";
import { runStageJudge } from "#benchmark/stage-grading";
import { benchmarkRunPaths } from "#benchmark/run-layout";
import { UsageError } from "#cli/commands";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import type { CommandOutput } from "#cli/output";
import { writeRecord } from "#cli/output";
import { parseRunRecordId } from "#cli/record-id";

export interface CurrentControlSources {
	readonly instructions: string;
	readonly finalRubric: string;
}

export interface CalibrateRequest {
	readonly id: string | undefined;
	readonly runsDirectory: string;
	readonly json: boolean;
	readonly confirmRejudge: boolean;
	readonly readCurrentSources?:
		| ((caseId: string | undefined) => Promise<CurrentControlSources>)
		| undefined;
}

/**
 * The two records a run may leave for calibration: the artifact a graded run
 * writes, and the stage file a run stopped at a stage writes. The command
 * reads what is on disk rather than taking a flag naming which case it is in,
 * because the run already decided that and a second answer could disagree.
 */
type CalibratableRecord =
	| {
			readonly kind: "final";
			readonly file: string;
			readonly record: CalibratableArtifact;
	  }
	| {
			readonly kind: "stage";
			readonly file: string;
			readonly record: CalibratableStageRecord;
	  };

async function loadRecord(
	runsDirectory: string,
	run: string,
): Promise<CalibratableRecord> {
	const paths = benchmarkRunPaths(runsDirectory, run);
	if (await Bun.file(paths.artifactFile).exists()) {
		const record = calibratableArtifactSchema.parse(
			JSON.parse(await Bun.file(paths.artifactFile).text()),
		);
		if (record.status !== "AWAITING_HUMAN_REVIEW") {
			throw new RefusedPreconditionError(
				`Run ${run} is ${record.status}; only a run awaiting human review is calibrated`,
			);
		}

		return { kind: "final", file: paths.artifactFile, record };
	}

	return loadStoppedStage(runsDirectory, run);
}

/**
 * A stopped run's stage file is named for the stage it stopped at, which the
 * command does not know until it looks. Exactly one stage may stop, so the one
 * record carrying a STOP verdict and no calibration is the one to complete.
 */
async function loadStoppedStage(
	runsDirectory: string,
	run: string,
): Promise<CalibratableRecord> {
	const paths = benchmarkRunPaths(runsDirectory, run);
	for (const stage of await stageNamesOf(runsDirectory, run)) {
		const file = paths.stageFile(stage);
		const parsed = calibratableStageRecordSchema.safeParse(
			JSON.parse(await Bun.file(file).text()),
		);
		if (
			parsed.success &&
			parsed.data.grade.verdict === "STOP" &&
			parsed.data.calibration === undefined
		) {
			return { kind: "stage", file, record: parsed.data };
		}
	}

	throw new RefusedPreconditionError(
		`No run ${run} awaiting calibration at ${displayPath(paths.artifactFile)}`,
	);
}

const STAGE_FILE_SUFFIX = ".json";

async function stageNamesOf(
	runsDirectory: string,
	run: string,
): Promise<readonly string[]> {
	const entries = await readdir(runsDirectory).catch(() => []);

	return entries
		.filter(
			(entry) =>
				entry.startsWith(`${run}.`) && entry.endsWith(STAGE_FILE_SUFFIX),
		)
		.map((entry) => entry.slice(run.length + 1, -STAGE_FILE_SUFFIX.length))
		.filter((stage) => stage !== "" && stage !== "review")
		.toSorted((left, right) => (left < right ? -1 : 1));
}

async function readReview(reviewFile: string): Promise<HumanReview> {
	if (!(await Bun.file(reviewFile).exists())) {
		throw new RefusedPreconditionError(
			`No review for this run at ${displayPath(reviewFile)}; record one with rehearsal review first`,
		);
	}

	const parsed = humanReviewSchema.safeParse(
		JSON.parse(await Bun.file(reviewFile).text()),
	);
	if (!parsed.success) {
		throw new UsageError(parsed.error.message);
	}

	return parsed.data;
}

function frozenEvidence(
	record: Readonly<CalibratableRecord>,
): FrozenCalibrationEvidence {
	if (record.kind === "stage") {
		const { record: stage } = record;

		return {
			instructions: stage.input.instructions,
			finalRubric: "",
			stageScorecards: [asScorecard(stage)],
		};
	}

	const { record: artifact } = record;

	return {
		instructions: artifact.instructions,
		finalRubric: artifact.rubric,
		finalCandidate: {
			originalGrade: artifact.grade,
			baselineContext: artifact.baselineContext,
			diff: artifact.diff,
			changedPaths: artifact.changedPaths,
			checkIntegrity: artifact.checkIntegrity,
			localChecks: artifact.localChecks,
		},
		stageScorecards: artifact.stageScorecards,
	};
}

function asScorecard(stage: Readonly<CalibratableStageRecord>): StageScorecard {
	return {
		stage: stage.stage,
		rubricPath: stage.rubricPath,
		rubric: stage.rubric,
		input: stage.input,
		prompt: stage.prompt,
		attempts: stage.attempts,
		costUsd: stage.costUsd,
		grade: stage.grade,
	};
}

/**
 * The rubric text a stage is rejudged against is read from the path the
 * scorecard recorded, not one recomputed from the case: an edit lands in the
 * file the run graded from, and that is the file this reads back. A rubric
 * that has since been deleted is simply unchanged, so the stage is not
 * rejudged.
 */
async function currentSources(
	request: Readonly<CalibrateRequest>,
	frozen: Readonly<FrozenCalibrationEvidence>,
	caseId: string | undefined,
): Promise<CurrentCalibrationSources> {
	const read =
		request.readCurrentSources ??
		((id: string | undefined) => readControlSources(id, frozen.finalRubric));
	const { instructions, finalRubric } = await read(caseId);
	const stageRubrics = await readStageRubrics(frozen.stageScorecards, (path) =>
		Bun.file(path)
			.text()
			.catch(() => undefined),
	);

	return { instructions, finalRubric, stageRubrics };
}

/**
 * The final rubric a run is rejudged against is the one its case declares, read
 * through the case id the artifact recorded. Only the declaration is read, not
 * the loaded case: calibration touches no target repository, and a case whose
 * target has moved must still calibrate. A run whose case is gone is rejudged
 * against the rubric it froze, which is a rubric that did not change.
 */
async function readControlSources(
	caseId: string | undefined,
	frozenRubric: string,
): Promise<CurrentControlSources> {
	const instructions = await readProjectInstructions();
	if (caseId === undefined) {
		return { instructions, finalRubric: frozenRubric };
	}

	const finalRubric = await readCaseFinalRubric(caseId).catch(
		() => frozenRubric,
	);

	return { instructions, finalRubric };
}

async function readCaseFinalRubric(caseId: string): Promise<string> {
	const declaration = await readCaseDeclaration(caseId);
	if (declaration.kind !== "pipeline") {
		throw new Error(`Case ${caseId} declares no final rubric`);
	}

	return Bun.file(caseRelative(declaration, declaration.finalRubric)).text();
}

function rejudged(calibration: Readonly<CalibrationResult>): boolean {
	return (
		calibration.revisedGrade !== undefined ||
		(calibration.revisedStageScorecards?.length ?? 0) > 0
	);
}

function revisedGrades(calibration: Readonly<CalibrationResult>): string {
	return JSON.stringify(
		{
			revisedGrade: calibration.revisedGrade,
			revisedStageGrades: calibration.revisedStageScorecards?.map(
				({ stage, grade }) => ({ stage, grade }),
			),
		},
		null,
		2,
	);
}

export interface JudgeKnobs {
	readonly judgeModel: string;
	readonly judgeEffort?: Effort | undefined;
	readonly sessionBudgetUsd: number;
}

export interface CalibrateJudges {
	readonly stageJudge: CalibrationJudges["stageJudge"];
	readonly finalJudge: NonNullable<CalibrationJudges["finalJudge"]>;
}

/**
 * A rejudge runs under the model, effort, and budget the original Judge ran
 * under, which the record carries. The agreement baseline is keyed on the exact
 * Judge model, so a rejudge under a different one would start a new baseline
 * instead of adding to the run's.
 */
export function judgesFor(knobs: Readonly<JudgeKnobs>): CalibrateJudges {
	return {
		stageJudge: (scorecard, source) =>
			runStageJudge(
				knobs.judgeModel,
				knobs.judgeEffort,
				knobs.sessionBudgetUsd,
				scorecard.input,
				source,
			),
		finalJudge: (rubric, candidate) =>
			runJudge(
				knobs.judgeModel,
				knobs.judgeEffort,
				knobs.sessionBudgetUsd,
				rubric,
				candidate.baselineContext,
				candidate.diff,
				candidate.changedPaths,
				candidate.checkIntegrity,
				candidate.localChecks,
			),
	};
}

/**
 * The `calibrate` command: it rejudges the frozen evidence with the rubrics and
 * instructions as they stand now, validates the findings, and records the
 * result. It asks nothing. `--confirm-rejudge` stands in for the typed yes the
 * paused loop asks for, and is required exactly where that question was asked:
 * when a rejudge produced a revised result the caller has not seen.
 */
export async function runCalibrate(
	request: Readonly<CalibrateRequest>,
	buildJudges: (knobs: Readonly<JudgeKnobs>) => CalibrateJudges,
	output: CommandOutput,
): Promise<void> {
	if (request.id === undefined) {
		throw new UsageError(
			"Provide the run: rehearsal calibrate <run:name|name>",
		);
	}

	const { run } = parseRunRecordId(request.id);
	const record = await loadRecord(request.runsDirectory, run);
	const paths = benchmarkRunPaths(request.runsDirectory, run);
	const review = await readReview(paths.reviewFile);
	const frozen = frozenEvidence(record);
	const current = await currentSources(request, frozen, recordedCaseId(record));

	const judges = buildJudges(record.record);
	const calibration = await reportIncomplete(output, () =>
		calibrate(frozen, current, review, {
			stageJudge: judges.stageJudge,
			finalJudge: judges.finalJudge,
		}),
	);
	if (rejudged(calibration) && !request.confirmRejudge) {
		output.stderr(`${revisedGrades(calibration)}\n`);

		throw new RefusedPreconditionError(
			`The rejudge revised the grades above; re-run with --confirm-rejudge to record them for run ${run}`,
		);
	}

	const judgeAgreement = await loadJudgeAgreementReport(request.runsDirectory, [
		agreementInput(record, calibration),
	]);
	const completed =
		record.kind === "final"
			? { ...record.record, status: "COMPLETE", calibration, judgeAgreement }
			: { ...record.record, calibration, judgeAgreement };
	await Bun.write(record.file, `${JSON.stringify(completed, null, 2)}\n`);

	await writeRecord(output, record.file, request.json);
}

function recordedCaseId(
	record: Readonly<CalibratableRecord>,
): string | undefined {
	return record.kind === "final" ? record.record.caseId : undefined;
}

function agreementInput(
	record: Readonly<CalibratableRecord>,
	calibration: Readonly<CalibrationResult>,
): JudgeAgreementCalibration {
	if (record.kind === "stage") {
		return {
			judgeModel: record.record.judgeModel,
			humanReview: calibration.humanReview,
			stages: [asScorecard(record.record)],
		};
	}

	return {
		judgeModel: record.record.judgeModel,
		humanReview: calibration.humanReview,
		stages: record.record.stageScorecards,
		final: { rubric: record.record.rubric, grade: record.record.grade },
	};
}

/**
 * A calibration that does not hold is the caller's answer, not a stack trace:
 * the message says which finding the evidence contradicts, and the artifact
 * stays where it was so the next review can correct it.
 */
async function reportIncomplete(
	output: CommandOutput,
	work: () => Promise<CalibrationResult>,
): Promise<CalibrationResult> {
	try {
		return await work();
	} catch (error) {
		if (error instanceof CalibrationIncompleteError) {
			output.stderr(`Calibration incomplete: ${error.message}\n`);
		}

		throw error;
	}
}
