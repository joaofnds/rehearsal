import { z } from "zod";
import type { Immutable } from "./contracts";
import { judgeAgreementReportSchema } from "./judge-agreement";

export const COMPARISON_ARMS = ["baseline", "candidate", "control"] as const;
export type ComparisonArm = (typeof COMPARISON_ARMS)[number];
const comparisonArmSchema = z.enum(COMPARISON_ARMS);
const comparisonModeSchema = z.enum(["stage", "pipeline"]);

const identitySchema = z
	.string()
	.regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u, "Invalid comparison identity");

export const comparisonManifestSchema = z
	.object({
		schemaVersion: z.literal(1),
		cases: z
			.array(
				z
					.object({
						caseId: identitySchema,
						arms: z
							.object({
								baseline: z.string().min(1),
								candidate: z.string().min(1),
								control: z.string().min(1),
							})
							.strict(),
					})
					.strict(),
			)
			.min(2),
	})
	.strict()
	.superRefine((manifest, context) => {
		const seen = new Set<string>();
		for (const [index, benchmarkCase] of manifest.cases.entries()) {
			if (seen.has(benchmarkCase.caseId)) {
				context.addIssue({
					code: "custom",
					message: "duplicate case ID",
					path: ["cases", index, "caseId"],
				});
			}

			seen.add(benchmarkCase.caseId);
		}
	});

export type ComparisonManifest = Immutable<
	z.infer<typeof comparisonManifestSchema>
>;

const manifestContextSchema = z
	.object({
		cases: z
			.array(z.object({ caseId: z.string().optional() }).loose())
			.optional(),
	})
	.loose();
type ManifestContext = Immutable<z.infer<typeof manifestContextSchema>>;

const caseIssuePathSchema = z
	.tuple([z.literal("cases"), z.number().int().nonnegative()])
	.rest(z.union([z.string(), z.number()]));

interface IssueContextInput {
	readonly context: ManifestContext;
	readonly issue: {
		readonly path: readonly PropertyKey[];
	};
}

interface ManifestIssueContext {
	readonly caseId: string;
	readonly arm: string;
	readonly field: string;
}

function issueContext(
	input: Immutable<IssueContextInput>,
): ManifestIssueContext {
	const parsedPath = caseIssuePathSchema.safeParse(input.issue.path);
	const caseIndex = parsedPath.data?.[1];
	const caseId =
		caseIndex === undefined
			? "manifest"
			: (input.context.cases?.[caseIndex]?.caseId ?? `case-${caseIndex + 1}`);
	const arm = input.issue.path
		.map((value) => comparisonArmSchema.safeParse(value))
		.find((result) => result.success)?.data;
	const fieldPath =
		caseIndex === undefined ? input.issue.path : input.issue.path.slice(2);
	const field = fieldPath.map(String).join(".") || "manifest";

	return { caseId, arm: arm ?? "all", field };
}

export class ComparisonManifestError extends Error {
	public override name = "ComparisonManifestError";
}

export function parseComparisonManifest(text: string): ComparisonManifest {
	let candidate: unknown;
	try {
		candidate = JSON.parse(text);
	} catch {
		throw new ComparisonManifestError(
			"case manifest arm all field json: invalid JSON",
		);
	}

	const result = comparisonManifestSchema.safeParse(candidate);
	if (result.success) {
		return result.data;
	}

	const [issue] = result.error.issues;
	if (issue === undefined) {
		throw new ComparisonManifestError(
			"case manifest arm all field manifest: invalid comparison manifest",
		);
	}

	const parsedContext = manifestContextSchema.safeParse(candidate);
	const context = issueContext({
		context: parsedContext.success ? parsedContext.data : {},
		issue,
	});

	throw new ComparisonManifestError(
		`case ${context.caseId} arm ${context.arm} field ${context.field}: ${issue.message}`,
	);
}

const sha256Schema = z
	.string()
	.regex(/^[0-9a-f]{64}$/u, "Invalid SHA-256 digest");
const digestedPathSchema = z
	.object({ path: z.string().min(1), sha256: sha256Schema })
	.strict();
const sourceRepSchema = digestedPathSchema
	.extend({
		repId: identitySchema,
		ordinal: z.number().int().positive(),
		attempt: digestedPathSchema.optional(),
	})
	.strict();
const sessionSourceRepSchema = digestedPathSchema
	.extend({
		repId: identitySchema,
		ordinal: z.number().int().positive(),
		attempt: digestedPathSchema,
	})
	.strict();
const reliabilitySummarySchema = z
	.object({
		name: z.string().min(1),
		requested: z.number().int().positive(),
		attempted: z.number().int().nonnegative(),
		notReached: z.number().int().nonnegative(),
		failed: z.number().int().nonnegative(),
		successful: z.number().int().nonnegative(),
		gradeDistribution: z.record(
			z.string().min(1),
			z.number().int().nonnegative(),
		),
		successRate: z.number().min(0).max(1),
		standardError: z.number().nonnegative(),
		passK: z.number().min(0).max(1),
	})
	.strict();
const caseDeltaSchema = z
	.object({ caseId: identitySchema, value: z.number() })
	.strict();
const pairedEstimateSchema = z
	.object({
		caseDeltas: z.array(caseDeltaSchema).min(2),
		meanDelta: z.number(),
		standardError: z.number().nonnegative(),
	})
	.strict();
const metricValueSummarySchema = z
	.object({
		values: z.array(z.number().nonnegative()).min(1),
		mean: z.number().nonnegative(),
	})
	.strict();
const resourceMetricSummarySchema = z
	.object({
		costUsd: metricValueSummarySchema,
		inputTokens: metricValueSummarySchema,
		outputTokens: metricValueSummarySchema,
		cacheReadTokens: metricValueSummarySchema,
		cacheWriteTokens: metricValueSummarySchema,
	})
	.strict();
const resourceRolesSummarySchema = z
	.object({
		worker: resourceMetricSummarySchema,
		"product-owner": resourceMetricSummarySchema,
		"stage-judge": resourceMetricSummarySchema,
		"final-judge": resourceMetricSummarySchema,
	})
	.strict();
const missingResourceEvidenceSchema = z
	.object({
		repId: identitySchema,
		ordinal: z.number().int().positive(),
		missing: z.array(z.string().min(1)).min(1),
	})
	.strict();
const armResourcesSchema = z.discriminatedUnion("status", [
	z
		.object({
			status: z.literal("AVAILABLE"),
			completeReps: z.number().int().positive(),
			missingMetricReps: z.literal(0),
			perRole: resourceRolesSummarySchema,
			total: resourceMetricSummarySchema,
			workerTurns: metricValueSummarySchema,
		})
		.strict(),
	z
		.object({
			status: z.literal("UNAVAILABLE"),
			completeReps: z.number().int().nonnegative(),
			missingMetricReps: z.number().int().positive(),
			missingEvidence: z.array(missingResourceEvidenceSchema).min(1),
		})
		.strict(),
]);
const reportArmSchema = z
	.object({
		role: comparisonArmSchema,
		source: z
			.object({
				group: digestedPathSchema,
				reps: z.array(sourceRepSchema).min(1),
			})
			.strict(),
		executedCorpus: z.array(digestedPathSchema).min(1),
		quality: z.array(reliabilitySummarySchema).min(1),
		resources: armResourcesSchema,
	})
	.strict();
const sessionReportArmSchema = z
	.object({
		role: comparisonArmSchema,
		source: z
			.object({
				group: digestedPathSchema,
				reps: z.array(sessionSourceRepSchema).min(1),
			})
			.strict(),
		executedCorpus: z.array(digestedPathSchema),
		quality: z.array(reliabilitySummarySchema).min(1),
		resources: armResourcesSchema,
	})
	.strict();
const reportCaseSchema = z
	.object({
		caseId: identitySchema,
		arms: z
			.object({
				baseline: reportArmSchema,
				candidate: reportArmSchema,
				control: reportArmSchema,
			})
			.strict(),
	})
	.strict();
const sessionReportCaseSchema = z
	.object({
		caseId: identitySchema,
		arms: z
			.object({
				baseline: sessionReportArmSchema,
				candidate: sessionReportArmSchema,
				control: sessionReportArmSchema,
			})
			.strict(),
	})
	.strict();
const qualityContrastSchema = z
	.object({
		name: z.string().min(1),
		successRate: pairedEstimateSchema,
		passK: pairedEstimateSchema,
	})
	.strict();
const resourceMetricEstimatesSchema = z
	.object({
		costUsd: pairedEstimateSchema,
		inputTokens: pairedEstimateSchema,
		outputTokens: pairedEstimateSchema,
		cacheReadTokens: pairedEstimateSchema,
		cacheWriteTokens: pairedEstimateSchema,
	})
	.strict();
const resourceRolesEstimatesSchema = z
	.object({
		worker: resourceMetricEstimatesSchema,
		"product-owner": resourceMetricEstimatesSchema,
		"stage-judge": resourceMetricEstimatesSchema,
		"final-judge": resourceMetricEstimatesSchema,
	})
	.strict();
const contrastResourcesSchema = z.discriminatedUnion("status", [
	z
		.object({
			status: z.literal("AVAILABLE"),
			perRole: resourceRolesEstimatesSchema,
			total: resourceMetricEstimatesSchema,
			workerTurns: pairedEstimateSchema,
		})
		.strict(),
	z
		.object({
			status: z.literal("UNAVAILABLE"),
			missingEvidence: z
				.array(
					missingResourceEvidenceSchema
						.extend({ caseId: identitySchema, arm: comparisonArmSchema })
						.strict(),
				)
				.min(1),
		})
		.strict(),
]);
const reportContrastSchema = z
	.object({
		minuend: comparisonArmSchema,
		subtrahend: comparisonArmSchema,
		quality: z.array(qualityContrastSchema).min(1),
		resources: contrastResourcesSchema,
	})
	.strict();

const comparisonReportFields = {
	manifest: z.object({ sha256: sha256Schema }).strict(),
	mode: comparisonModeSchema,
	declaredStages: z.array(z.string().min(1)).min(1),
	reps: z.number().int().min(2),
	cases: z.array(reportCaseSchema).min(2),
	contrasts: z
		.object({
			candidateMinusBaseline: reportContrastSchema,
			candidateMinusControl: reportContrastSchema,
			baselineMinusControl: reportContrastSchema,
		})
		.strict(),
};
const legacyComparisonReportSchema = z
	.object({ schemaVersion: z.literal(1), ...comparisonReportFields })
	.strict();
export const comparisonReportSchema = z
	.object({
		schemaVersion: z.literal(2),
		judgeAgreement: judgeAgreementReportSchema,
		...comparisonReportFields,
	})
	.strict();

/**
 * Session comparisons carry the attempt artifact beside each rep and have no
 * judge calibration. Keeping that distinction in the report version prevents
 * consumers from mistaking a worker check for a pipeline judge outcome.
 */
export const sessionComparisonReportSchema = z
	.object({
		schemaVersion: z.literal(3),
		judgeAgreement: judgeAgreementReportSchema.extend({
			baselines: z.array(z.never()).length(0),
		}),
		...comparisonReportFields,
		mode: z.literal("session"),
		declaredStages: z.tuple([z.literal("checks")]),
		cases: z.array(sessionReportCaseSchema).min(2),
	})
	.strict();

export type ComparisonReport = Immutable<
	| z.infer<typeof comparisonReportSchema>
	| z.infer<typeof sessionComparisonReportSchema>
>;
export type LegacyComparisonReport = Immutable<
	z.infer<typeof legacyComparisonReportSchema>
>;

export function parseComparisonReport(
	text: string,
): ComparisonReport | LegacyComparisonReport {
	return z
		.discriminatedUnion("schemaVersion", [
			legacyComparisonReportSchema,
			comparisonReportSchema,
			sessionComparisonReportSchema,
		])
		.parse(JSON.parse(text));
}

export function serializeComparisonReport(
	report: Immutable<ComparisonReport>,
): string {
	const parsed =
		report.schemaVersion === 3
			? sessionComparisonReportSchema.parse(report)
			: comparisonReportSchema.parse(report);

	return `${JSON.stringify(parsed, null, 2)}\n`;
}
