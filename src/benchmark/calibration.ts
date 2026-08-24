import { join } from "node:path";
import { CommandError } from "./command";
import { CONTROL_DIR, type Effort } from "./config";
import {
	type CalibrationResult,
	type ContextFile,
	type HumanReview,
	humanReviewSchema,
	type JudgeGrade,
	type LocalCheckResult,
} from "./contracts";
import { runJudge, validateRubricDefinition } from "./judge";

export interface Questioner {
	question(prompt: string): Promise<string>;
}

interface CalibrationContext {
	readonly rl: Questioner;
	readonly reviewFile: string;
	readonly targetDir: string;
	readonly originalInstructions: string;
	readonly originalRubric: string;
	readonly originalGrade: JudgeGrade;
	readonly judgeModel: string;
	readonly judgeEffort?: Effort;
	readonly sessionBudgetUsd: number;
	readonly baselineContext: readonly ContextFile[];
	readonly diff: string;
	readonly changedPaths: readonly string[];
	readonly checkIntegrity: LocalCheckResult;
	readonly localChecks: LocalCheckResult;
}

export function parseHumanReview(review: string): HumanReview {
	return humanReviewSchema.parse(JSON.parse(review));
}

export function validateCalibration(
	review: HumanReview,
	originalGrade: JudgeGrade,
	revisedGrade?: JudgeGrade,
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
			`Review the implementation in ${context.targetDir}. Record your verdict and findings in ${context.reviewFile}. Update ${join(CONTROL_DIR, "CLAUDE.md")} and/or ${join(CONTROL_DIR, "rubric.md")} where justified, then press Enter to validate the calibration.`,
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
			const requiresRevisedRubric = humanReview.findings.some(
				({ judgeAssessment }) =>
					["MISSED", "FALSE_POSITIVE"].includes(judgeAssessment),
			);

			if (requiresRevisedRubric && !rubricChanged) {
				throw new Error(
					"MISSED and FALSE_POSITIVE findings require a rubric change",
				);
			}

			let revisedRubricIds: readonly string[] | undefined;
			let revisedJudgePrompt: string | undefined;
			let revisedGrade: JudgeGrade | undefined;
			if (rubricChanged) {
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

			validateCalibration(humanReview, context.originalGrade, revisedGrade);
			let rejudgeConfirmedByHuman: boolean | undefined;
			if (revisedGrade) {
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
			};
		} catch (error) {
			if (error instanceof CommandError) throw error;

			console.error(
				`Calibration incomplete: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
