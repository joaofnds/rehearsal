import { join } from "node:path";
import { CommandError } from "./command";
import { CONTROL_DIR, type Effort, type WorkflowStage } from "./config";
import {
	type CalibrationResult,
	type ContextFile,
	type HumanReview,
	humanReviewSchema,
	type JudgeGrade,
	type LocalCheckResult,
	type StageScorecard,
} from "./contracts";
import { runJudge, validateRubricDefinition } from "./judge";
import { parseStageRubric, runStageJudge } from "./stage-grading";

export interface Questioner {
	question(prompt: string): Promise<string>;
}

export interface FinalCandidate {
	readonly originalGrade: JudgeGrade;
	readonly baselineContext: readonly ContextFile[];
	readonly diff: string;
	readonly changedPaths: readonly string[];
	readonly checkIntegrity: LocalCheckResult;
	readonly localChecks: LocalCheckResult;
}

interface CalibrationContext {
	readonly rl: Questioner;
	readonly reviewFile: string;
	readonly targetDir: string;
	readonly originalInstructions: string;
	readonly originalRubric: string;
	readonly finalCandidate?: FinalCandidate;
	readonly stageScorecards: readonly StageScorecard[];
	readonly judgeModel: string;
	readonly judgeEffort?: Effort;
	readonly sessionBudgetUsd: number;
}

export function parseHumanReview(review: string): HumanReview {
	return humanReviewSchema.parse(JSON.parse(review));
}

export function validateCalibration(
	review: HumanReview,
	originalGrade?: JudgeGrade,
	revisedGrade?: JudgeGrade,
	originalStageScorecards: readonly StageScorecard[] = [],
	revisedStageScorecards: readonly StageScorecard[] = [],
) {
	const realDefects = review.findings.filter(({ judgeAssessment }) =>
		["CAUGHT", "MISSED"].includes(judgeAssessment),
	);

	if (review.verdict === "ACCEPT" && realDefects.length > 0) {
		throw new Error("Human review cannot accept a candidate with real defects");
	}

	for (const finding of review.findings) {
		if (finding.judgeAssessment === "NOT_PROMOTED") continue;

		const rubricId = finding.rubricId ?? "";
		if (finding.stage !== "final") {
			validateStageFinding(
				finding.stage,
				finding.judgeAssessment,
				rubricId,
				originalStageScorecards,
				revisedStageScorecards,
			);
			continue;
		}

		if (!originalGrade) {
			throw new Error("Final-stage findings require a final Judge grade");
		}

		const originalRequirement = originalGrade.requirements.find(
			({ id }) => id === rubricId,
		);
		const revisedRequirement = revisedGrade?.requirements.find(
			({ id }) => id === rubricId,
		);
		assertFindingMatchesGrades(
			finding.judgeAssessment,
			rubricId,
			"",
			originalRequirement && originalRequirement.status === "FAIL",
			revisedGrade !== undefined,
			revisedRequirement && revisedRequirement.status === "FAIL",
		);
	}
}

type ConfirmedAssessment = Exclude<
	HumanReview["findings"][number]["judgeAssessment"],
	"NOT_PROMOTED"
>;

function validateStageFinding(
	stage: WorkflowStage,
	assessment: ConfirmedAssessment,
	rubricId: string,
	originalScorecards: readonly StageScorecard[],
	revisedScorecards: readonly StageScorecard[],
) {
	const original = originalScorecards.find(
		(scorecard) => scorecard.stage === stage,
	);
	if (!original) throw new Error(`No ${stage} scorecard was recorded`);

	const revised = revisedScorecards.find(
		(scorecard) => scorecard.stage === stage,
	);
	assertFindingMatchesGrades(
		assessment,
		rubricId,
		`${stage} `,
		stageItemFailure(original, rubricId),
		revised !== undefined,
		revised && stageItemFailure(revised, rubricId),
	);
}

function assertFindingMatchesGrades(
	assessment: ConfirmedAssessment,
	rubricId: string,
	label: string,
	originalFailure: boolean | undefined,
	revisedAvailable: boolean,
	revisedFailure: boolean | undefined,
) {
	if (assessment === "CAUGHT") {
		if (originalFailure !== true) {
			throw new Error(`Original ${label}Judge did not catch ${rubricId}`);
		}
		return;
	}

	if (!revisedAvailable) {
		throw new Error(`${assessment} requires a revised grade`);
	}

	if (assessment === "MISSED" && originalFailure) {
		throw new Error(`Original ${label}Judge already caught ${rubricId}`);
	}
	if (assessment === "MISSED" && revisedFailure !== true) {
		throw new Error(`Revised ${label}rubric does not catch ${rubricId}`);
	}
	if (
		assessment === "FALSE_POSITIVE" &&
		(originalFailure !== true || revisedFailure !== false)
	) {
		throw new Error(`Revised ${label}rubric does not correct ${rubricId}`);
	}
}

function stageItemFailure(scorecard: StageScorecard, rubricId: string) {
	const blocker = scorecard.grade.hardBlockers.find(
		({ id }) => id === rubricId,
	);
	if (blocker) return blocker.status === "FAIL";
	const requirement = scorecard.grade.requirements.find(
		({ id }) => id === rubricId,
	);
	if (requirement) return requirement.status === "FAIL";
	const dimension = scorecard.grade.dimensions.find(
		({ id }) => id === rubricId,
	);
	if (dimension) return ["C", "D", "F"].includes(dimension.grade);

	return undefined;
}

async function writeHumanReviewTemplate(path: string) {
	await Bun.write(
		path,
		`${JSON.stringify(
			{
				verdict: "REPLACE_WITH_ACCEPT_OR_REJECT",
				summary: "",
				findings: [],
			},
			null,
			2,
		)}\n`,
	);
}

export async function collectCalibration(
	context: CalibrationContext,
): Promise<CalibrationResult> {
	await writeHumanReviewTemplate(context.reviewFile);
	const editTargets = context.finalCandidate
		? `${join(CONTROL_DIR, "CLAUDE.md")}, ${join(CONTROL_DIR, "rubric.md")}, and/or the relevant file under ${join(CONTROL_DIR, "rubrics")}`
		: `${join(CONTROL_DIR, "CLAUDE.md")} and/or the relevant file under ${join(CONTROL_DIR, "rubrics")}`;

	while (true) {
		await context.rl.question(
			`Review the completed stages in ${context.targetDir}. Record every finding with its stage in ${context.reviewFile}. Update ${editTargets} where justified, then press Enter to validate the calibration.`,
		);

		try {
			const humanReview = parseHumanReview(
				await Bun.file(context.reviewFile).text(),
			);
			const [updatedInstructions, updatedRubric] = await Promise.all([
				Bun.file(join(CONTROL_DIR, "CLAUDE.md")).text(),
				Bun.file(join(CONTROL_DIR, "rubric.md")).text(),
			]);
			const instructionsChanged =
				updatedInstructions !== context.originalInstructions;
			const rubricChanged = updatedRubric !== context.originalRubric;
			const revisedStageScorecards: StageScorecard[] = [];
			const stageRubricsChanged: WorkflowStage[] = [];
			for (const scorecard of context.stageScorecards) {
				const updatedContent = await Bun.file(scorecard.rubricPath).text();
				const updatedStageRubric = parseStageRubric(
					updatedContent,
					scorecard.stage,
				);
				if (
					JSON.stringify(updatedStageRubric) ===
					JSON.stringify(scorecard.rubric)
				) {
					continue;
				}

				stageRubricsChanged.push(scorecard.stage);
				console.log(`\nRejudging the same ${scorecard.stage} stage`);
				const revisedScorecard = await runStageJudge(
					context.judgeModel,
					context.judgeEffort,
					context.sessionBudgetUsd,
					scorecard.input,
					{
						rubricPath: scorecard.rubricPath,
						content: updatedContent,
						rubric: updatedStageRubric,
					},
				);
				revisedStageScorecards.push(revisedScorecard);
				console.log(JSON.stringify(revisedScorecard.grade, null, 2));
			}

			let revisedRubricIds: readonly string[] | undefined;
			let revisedJudgePrompt: string | undefined;
			let revisedGrade: JudgeGrade | undefined;
			if (rubricChanged && context.finalCandidate) {
				revisedRubricIds = validateRubricDefinition(updatedRubric);
				console.log("\nRejudging the same candidate with the revised rubric");
				const revisedJudge = await runJudge(
					context.judgeModel,
					context.judgeEffort,
					context.sessionBudgetUsd,
					updatedRubric,
					context.finalCandidate.baselineContext,
					context.finalCandidate.diff,
					context.finalCandidate.changedPaths,
					context.finalCandidate.checkIntegrity,
					context.finalCandidate.localChecks,
				);
				revisedJudgePrompt = revisedJudge.prompt;
				revisedGrade = revisedJudge.grade;
				console.log(JSON.stringify(revisedGrade, null, 2));
			}

			validateCalibration(
				humanReview,
				context.finalCandidate?.originalGrade,
				revisedGrade,
				context.stageScorecards,
				revisedStageScorecards,
			);
			let rejudgeConfirmedByHuman: boolean | undefined;
			if (revisedGrade || revisedStageScorecards.length > 0) {
				const confirmation = await context.rl.question(
					"Confirm that the revised Judge result catches or corrects each finding for the right reason. Type yes to finalize, or anything else to revise the rubric: ",
				);
				rejudgeConfirmedByHuman = confirmation.trim().toLowerCase() === "yes";
				if (!rejudgeConfirmedByHuman) {
					throw new Error("Revised Judge result was not confirmed");
				}
			}

			return {
				humanReview,
				instructionsChanged,
				updatedInstructions: instructionsChanged
					? updatedInstructions
					: undefined,
				rubricChanged,
				updatedRubric: rubricChanged ? updatedRubric : undefined,
				revisedRubricIds,
				revisedJudgePrompt,
				revisedGrade,
				rejudgeConfirmedByHuman,
				stageRubricsChanged,
				revisedStageScorecards:
					revisedStageScorecards.length > 0
						? revisedStageScorecards
						: undefined,
			};
		} catch (error) {
			if (error instanceof CommandError) throw error;
			if (
				error instanceof TypeError ||
				error instanceof ReferenceError ||
				error instanceof RangeError
			) {
				throw error;
			}

			console.error(
				`Calibration incomplete: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
