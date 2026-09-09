import { z } from "zod";
import type {
	ComparisonReport,
	LegacyComparisonReport,
} from "./comparison-record";
import type { ParsedConfirmationGroupRecord } from "./confirmation-record";
import type { Immutable } from "./contracts";

/**
 * The short markdown a session pastes onto a card. Each summary is a pure
 * function of one parsed record: no file is read and no clock is consulted, so
 * the same record renders the same bytes on every machine and a committed
 * expected string is a meaningful assertion.
 */
function table(
	header: readonly string[],
	rows: readonly (readonly string[])[],
): string[] {
	return [
		`| ${header.join(" | ")} |`,
		`| ${header.map(() => "---").join(" | ")} |`,
		...rows.map((row) => `| ${row.join(" | ")} |`),
	];
}

function usd(amount: number): string {
	return `$${amount.toFixed(2)}`;
}

function ratio(value: number): string {
	return value.toFixed(3);
}

function delta(value: number): string {
	return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

/**
 * The run artifact carries no schema of its own, so the summary parses exactly
 * the fields it renders and fails loudly on a record that cannot supply them.
 * This is not a second record shape: `--json` still prints the artifact's own
 * bytes.
 */
export const runSummarySchema = z
	.object({
		caseId: z.string().min(1),
		timestamp: z.string().min(1),
		status: z.string().min(1),
		grade: z
			.object({ verdict: z.string().min(1), summary: z.string().min(1) })
			.loose()
			.optional(),
		failure: z.string().min(1).optional(),
		productOwnerCostUsd: z.number(),
		judgeCostUsd: z.number(),
		workflow: z.array(z.object({ costUsd: z.number() }).loose()),
		stageScorecards: z.array(
			z
				.object({
					stage: z.string().min(1),
					costUsd: z.number(),
					grade: z
						.object({
							grade: z.string().min(1),
							verdict: z.string().min(1),
						})
						.loose(),
				})
				.loose(),
		),
	})
	.loose();

export type RunSummaryRecord = Immutable<z.infer<typeof runSummarySchema>>;

export function parseRunSummaryRecord(text: string): RunSummaryRecord {
	return runSummarySchema.parse(JSON.parse(text));
}

export function runSummary(runName: string, record: RunSummaryRecord): string {
	const stageCost = record.stageScorecards.reduce(
		(total, scorecard) => total + scorecard.costUsd,
		0,
	);
	const workflowCost = record.workflow.reduce(
		(total, transcript) => total + transcript.costUsd,
		0,
	);
	const totalCost =
		stageCost + workflowCost + record.productOwnerCostUsd + record.judgeCostUsd;

	return [
		`## run:${runName}`,
		"",
		`Case ${record.caseId}, status ${record.status}.`,
		"",
		...table(
			["stage", "grade", "verdict", "cost"],
			record.stageScorecards.map((scorecard) => [
				scorecard.stage,
				scorecard.grade.grade,
				scorecard.grade.verdict,
				usd(scorecard.costUsd),
			]),
		),
		"",
		`Final verdict ${record.grade?.verdict ?? record.failure ?? "none"}.`,
		`Total cost ${usd(totalCost)}.`,
		"",
	].join("\n");
}

const reliabilitySummarySchema = z
	.object({
		name: z.string().min(1),
		requested: z.number(),
		successful: z.number(),
		successRate: z.number(),
		standardError: z.number(),
		passK: z.number(),
	})
	.loose();

export const groupReportSummarySchema = z
	.object({
		reliability: z.array(reliabilitySummarySchema),
		resources: z
			.object({
				total: z.object({ costUsd: z.array(z.number()) }).loose(),
				commandTotal: z
					.discriminatedUnion("status", [
						z.object({
							status: z.literal("COMPLETE"),
							metrics: z.object({ costUsd: z.number() }).loose(),
						}),
						z.object({
							status: z.literal("MISSING"),
							missing: z.array(z.string().min(1)),
						}),
					])
					.optional(),
			})
			.loose(),
	})
	.loose();

export type GroupReportSummaryRecord = Immutable<
	z.infer<typeof groupReportSummarySchema>
>;

export function parseGroupReportSummaryRecord(
	text: string,
): GroupReportSummaryRecord {
	return groupReportSummarySchema.parse(JSON.parse(text));
}

export function groupSummary(
	record: Immutable<ParsedConfirmationGroupRecord>,
	report: GroupReportSummaryRecord,
): string {
	const costs = report.resources.total.costUsd;
	const total = costs.reduce((sum, cost) => sum + cost, 0);
	const { commandTotal } = report.resources;
	let costLine = `Cost ${usd(total)} over ${String(costs.length)} reps.`;
	if (commandTotal?.status === "MISSING") {
		costLine = `Cost unavailable: ${commandTotal.missing.join(", ")}.`;
	} else if (commandTotal?.status === "COMPLETE") {
		costLine = `Cost ${usd(commandTotal.metrics.costUsd)} for the confirmed command.`;
	}

	return [
		`## group:${record.groupId}`,
		"",
		`Case ${record.caseId}, ${record.mode} mode, ${String(record.reps)} reps.`,
		"",
		...table(
			["outcome", "successful", "success rate", "standard error", "pass^k"],
			report.reliability.map((summary) => [
				summary.name,
				`${String(summary.successful)}/${String(summary.requested)}`,
				ratio(summary.successRate),
				ratio(summary.standardError),
				ratio(summary.passK),
			]),
		),
		"",
		costLine,
		"",
	].join("\n");
}

/**
 * Every paired delta the report carries, each beside the contrast against the
 * control arm, because a candidate that beats the baseline while both sit at
 * the control's rate has moved nothing.
 */
export function comparisonSummary(
	digest: string,
	report: Immutable<ComparisonReport | LegacyComparisonReport>,
): string {
	const rows = Object.values(report.contrasts).flatMap((contrast) =>
		contrast.quality.map((quality) => [
			`${contrast.minuend} − ${contrast.subtrahend}`,
			quality.name,
			delta(quality.successRate.meanDelta),
			ratio(quality.successRate.standardError),
			delta(quality.passK.meanDelta),
		]),
	);

	return [
		`## comparison:${digest}`,
		"",
		`${String(report.cases.length)} cases, ${report.mode} mode, ${String(report.reps)} reps.`,
		"",
		...table(
			["contrast", "outcome", "success rate Δ", "standard error", "pass^k Δ"],
			rows,
		),
		"",
	].join("\n");
}
