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

interface CalibrationContext {
	readonly rl: Questioner;
	readonly reviewFile: string;
	readonly targetDir: string;
	readonly originalInstructions: string;
	readonly originalRubric: string;
	readonly originalGrade?: JudgeGrade;
	readonly stageScorecards: readonly StageScorecard[];
	readonly judgeModel: string;
	readonly judgeEffort?: Effort;
	readonly sessionBudgetUsd: number;
	readonly baselineContext?: readonly ContextFile[];
	readonly diff?: string;
	readonly changedPaths?: readonly string[];
	readonly checkIntegrity?: LocalCheckResult;
	readonly localChecks?: LocalCheckResult;
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
				finding,
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

		if (finding.judgeAssessment === "CAUGHT") {
			if (originalRequirement?.status !== "FAIL") {
				throw new Error(`Original Judge did not catch ${rubricId}`);
			}

			continue;
		}

		if (!revisedGrade) {
			throw new Error(`${finding.judgeAssessment} requires a revised grade`);
		}

		if (
			finding.judgeAssessment === "MISSED" &&
			originalRequirement?.status === "FAIL"
		) {
			throw new Error(`Original Judge already caught ${rubricId}`);
		}

		const revisedRequirement = revisedGrade.requirements.find(
			({ id }) => id === rubricId,
		);
		if (
			finding.judgeAssessment === "MISSED" &&
			revisedRequirement?.status !== "FAIL"
		) {
			throw new Error(`Revised rubric does not catch ${rubricId}`);
		}

		if (
			finding.judgeAssessment === "FALSE_POSITIVE" &&
			(originalRequirement?.status !== "FAIL" ||
				revisedRequirement?.status !== "PASS")
		) {
			throw new Error(`Revised rubric does not correct ${rubricId}`);
		}
	}
}

function validateStageFinding(
	finding: HumanReview["findings"][number],
	rubricId: string,
	originalScorecards: readonly StageScorecard[],
	revisedScorecards: readonly StageScorecard[],
) {
	const original = originalScorecards.find(
		({ stage }) => stage === finding.stage,
	);
	if (!original) throw new Error(`No ${finding.stage} scorecard was recorded`);

	const originalFailure = stageItemFailure(original, rubricId);
	if (finding.judgeAssessment === "CAUGHT") {
		if (originalFailure !== true) {
			throw new Error(
				`Original ${finding.stage} Judge did not catch ${rubricId}`,
			);
		}
		return;
	}

	const revised = revisedScorecards.find(
		({ stage }) => stage === finding.stage,
	);
	if (!revised) {
		throw new Error(`${finding.judgeAssessment} requires a revised grade`);
	}
	const revisedFailure = stageItemFailure(revised, rubricId);

	if (finding.judgeAssessment === "MISSED" && originalFailure) {
		throw new Error(
			`Original ${finding.stage} Judge already caught ${rubricId}`,
		);
	}
	if (finding.judgeAssessment === "MISSED" && revisedFailure !== true) {
		throw new Error(
			`Revised ${finding.stage} rubric does not catch ${rubricId}`,
		);
	}
	if (
		finding.judgeAssessment === "FALSE_POSITIVE" &&
		(originalFailure !== true || revisedFailure !== false)
	) {
		throw new Error(
			`Revised ${finding.stage} rubric does not correct ${rubricId}`,
		);
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

	while (true) {
		await context.rl.question(
			`Review the completed stages in ${context.targetDir}. Record every finding with its stage in ${context.reviewFile}. Update ${join(CONTROL_DIR, "CLAUDE.md")}, ${join(CONTROL_DIR, "rubric.md")}, and/or the relevant file under ${join(CONTROL_DIR, "rubrics")} where justified, then press Enter to validate the calibration.`,
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
			if (rubricChanged) {
				if (
					!context.originalGrade ||
					!context.baselineContext ||
					context.diff === undefined ||
					!context.changedPaths ||
					!context.checkIntegrity ||
					!context.localChecks
				) {
					throw new Error(
						"Final rubric cannot be calibrated before final grading",
					);
				}
				revisedRubricIds = validateRubricDefinition(updatedRubric);
				console.log("\nRejudging the same candidate with the revised rubric");
				const revisedJudge = await runJudge(
					context.judgeModel,
					context.judgeEffort,
					context.sessionBudgetUsd,
					updatedRubric,
					context.baselineContext,
					context.diff,
					context.changedPaths,
					context.checkIntegrity,
					context.localChecks,
				);
				revisedJudgePrompt = revisedJudge.prompt;
				revisedGrade = revisedJudge.grade;
				console.log(JSON.stringify(revisedGrade, null, 2));
			}

			validateCalibration(
				humanReview,
				context.originalGrade,
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

			console.error(
				`Calibration incomplete: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
