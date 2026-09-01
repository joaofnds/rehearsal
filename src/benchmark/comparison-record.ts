import { z } from "zod";
import type { Immutable } from "./contracts";

export const COMPARISON_ARMS = ["baseline", "candidate", "control"] as const;
export type ComparisonArm = (typeof COMPARISON_ARMS)[number];
const comparisonArmSchema = z.enum(COMPARISON_ARMS);

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
