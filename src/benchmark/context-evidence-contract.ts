import { z } from "zod";
import type { Immutable } from "./contracts";
import { jsonObjectSchema } from "./json-value";

const rawRecordSchema = jsonObjectSchema;

const captureSchema = z
	.object({
		provider: z.string().min(1),
		cliVersion: z.string().min(1),
		capturedAt: z.iso.datetime(),
		flags: z.array(z.string()),
		telemetry: jsonObjectSchema,
	})
	.loose();

const sourceFilesSchema = z
	.object({
		stream: z.array(rawRecordSchema),
		hooks: z.array(rawRecordSchema),
		otelLogs: z.array(rawRecordSchema),
		otelSpans: z.array(rawRecordSchema),
		transcripts: z.record(z.string().min(1), z.array(rawRecordSchema)),
		rawApiBodies: z.array(rawRecordSchema),
		coverage: z.array(rawRecordSchema),
	})
	.strict();

export const contextEvidenceSourceSchema = z
	.object({
		schemaVersion: z.literal(1),
		kind: z.string().min(1),
		capture: captureSchema,
		files: sourceFilesSchema,
	})
	.strict();

const modelRateSchema = z
	.object({
		model: z.string().min(1),
		inputUsdPerMillion: z.number().nonnegative(),
		outputUsdPerMillion: z.number().nonnegative(),
		cacheReadUsdPerMillion: z.number().nonnegative(),
		cacheWrite5mUsdPerMillion: z.number().nonnegative(),
		cacheWrite1hUsdPerMillion: z.number().nonnegative(),
	})
	.strict();

/**
 * How much weight a rate carries. Only a corpus-measured rate is one the suite
 * re-derives from a provider charge. A tier-inferred one is computed from
 * another category by the published multiplier and has never been checked
 * against a charge, which the ACT-178 probe showed can be wrong.
 */
const rateProvenanceSchema = z.enum([
	"corpus-measured",
	"publication-backed",
	"tier-inferred",
]);

const catalogProvenanceSchema = z
	.object({
		inputUsdPerMillion: rateProvenanceSchema,
		outputUsdPerMillion: rateProvenanceSchema,
		cacheReadUsdPerMillion: rateProvenanceSchema,
		cacheWrite5mUsdPerMillion: rateProvenanceSchema,
		cacheWrite1hUsdPerMillion: rateProvenanceSchema,
	})
	.strict();

export const contextRateCatalogSchema = z
	.object({
		schemaVersion: z.literal(1),
		source: z.string().min(1),
		version: z.string().min(1),
		currency: z.literal("USD"),
		provenance: catalogProvenanceSchema,
		models: z.array(modelRateSchema),
	})
	.strict()
	.superRefine((catalog, context) => {
		const seen = new Set<string>();
		for (const [index, rate] of catalog.models.entries()) {
			if (seen.has(rate.model)) {
				context.addIssue({
					code: "custom",
					message: `duplicate rate for model ${rate.model}`,
					path: ["models", index, "model"],
				});
			}
			seen.add(rate.model);
		}
	});

const tokenUsageSchema = z
	.object({
		inputTokens: z.number().int().nonnegative(),
		outputTokens: z.number().int().nonnegative(),
		cacheReadTokens: z.number().int().nonnegative(),
		cacheWriteTokens: z.number().int().nonnegative(),
		cacheWrite5mTokens: z.number().int().nonnegative().optional(),
		cacheWrite1hTokens: z.number().int().nonnegative().optional(),
	})
	.strict();

const completeRequestPricingSchema = z
	.object({
		state: z.literal("complete"),
		calculatedCostUsd: z.number().nonnegative(),
		rateSource: z.string().min(1),
		rateVersion: z.string().min(1),
		currency: z.literal("USD"),
		selectedRate: modelRateSchema,
	})
	.strict();

/**
 * The preconditions pricing can fail on. Two projections walk them, and a
 * state named in only one would let the same transcript report a different
 * gap depending on which reader asked.
 */
export const UNPRICED_STATES = [
	"usage-missing",
	"usage-conflict",
	"model-missing",
	"model-conflict",
	"ttl-split-missing",
	"ttl-split-conflict",
	"rates-missing",
] as const;

export type UnpricedState = (typeof UNPRICED_STATES)[number];

export const UNPRICED_REASONS = {
	"usage-missing": "the row carries no usage",
	"usage-conflict": "usage is in conflict",
	"model-missing": "the row names no model",
	"model-conflict": "the executing model is in conflict",
	"ttl-split-missing": "the cache-write TTL split is missing",
	"ttl-split-conflict": "the cache-write TTL split is in conflict",
	"rates-missing": "no rate is catalogued for the executing model",
} satisfies Readonly<Record<UnpricedState, string>>;

const incompleteRequestPricingSchema = z
	.object({
		state: z.enum(UNPRICED_STATES),
	})
	.strict();

/**
 * Priced at zero with no rate behind it. Kept apart from "complete", which
 * requires the rate it was priced at, so a reading never claims a rate it
 * never selected.
 */
const zeroUsageRequestPricingSchema = z
	.object({
		state: z.literal("zero-usage"),
		calculatedCostUsd: z.literal(0),
	})
	.strict();

const requestPricingSchema = z.union([
	completeRequestPricingSchema,
	zeroUsageRequestPricingSchema,
	incompleteRequestPricingSchema,
]);

interface RequestUsageEvidence {
	readonly usageState: "complete" | "missing" | "partial" | "conflict";
	readonly usage?: unknown;
	readonly usageRoute?: "otel" | "transcript" | undefined;
	readonly otelOccurrences: number;
	readonly transcriptOccurrences: number;
}

interface RequestRefinementContext {
	readonly addIssue: z.RefinementCtx["addIssue"];
}

function refineRequestUsage(
	request: Readonly<RequestUsageEvidence>,
	context: Readonly<RequestRefinementContext>,
): void {
	if ((request.usageState === "complete") !== (request.usage !== undefined)) {
		context.addIssue({
			code: "custom",
			message: "usage must exist exactly when usageState is complete",
			path: ["usage"],
		});
	}

	if (request.usageRoute === undefined) {
		return;
	}

	if (request.usage === undefined) {
		context.addIssue({
			code: "custom",
			message: "an evidence route requires the usage it supplied",
			path: ["usageRoute"],
		});
	}

	const observed =
		request.usageRoute === "otel"
			? request.otelOccurrences
			: request.transcriptOccurrences;
	if (observed === 0) {
		context.addIssue({
			code: "custom",
			message: "an evidence route names a source the record never observed",
			path: ["usageRoute"],
		});
	}
}

const requestEvidenceSchema = z
	.object({
		sessionId: z.string().min(1).nullable(),
		requestId: z.string().min(1),
		clientRequestIds: z.array(z.string().min(1)),
		identityState: z.enum(["complete", "single-source", "missing", "conflict"]),
		agentId: z.string().min(1).nullable(),
		attributionState: z.enum(["missing", "conflict"]).optional(),
		model: z.string().min(1).nullable(),
		modelState: z.enum(["complete", "single-source", "missing", "conflict"]),
		usageState: z.enum(["complete", "missing", "partial", "conflict"]),
		usage: tokenUsageSchema.optional(),
		usageRoute: z.enum(["otel", "transcript"]).optional(),
		providerCostUsd: z.number().nonnegative().optional(),
		pricing: requestPricingSchema,
		otelOccurrences: z.number().int().nonnegative(),
		uniqueOtelOccurrences: z.number().int().nonnegative(),
		transcriptOccurrences: z.number().int().nonnegative(),
	})
	.strict()
	.superRefine((request, context) => {
		refineRequestUsage(request, context);
		if (
			(request.agentId === null) !==
			(request.attributionState !== undefined)
		) {
			context.addIssue({
				code: "custom",
				message: "agent attribution payload contradicts its state",
				path: ["attributionState"],
			});
		}
		if (
			(request.model === null) !==
			(request.modelState !== "complete" &&
				request.modelState !== "single-source")
		) {
			context.addIssue({
				code: "custom",
				message: "model payload contradicts its state",
				path: ["modelState"],
			});
		}
		if (
			request.pricing.state === "complete" &&
			(request.usage?.cacheWrite5mTokens === undefined ||
				request.usage.cacheWrite1hTokens === undefined)
		) {
			context.addIssue({
				code: "custom",
				message: "complete pricing requires the reconciled cache TTL split",
				path: ["pricing"],
			});
		}
		if (
			request.pricing.state === "complete" &&
			request.usage?.cacheWrite5mTokens !== undefined &&
			request.usage.cacheWrite1hTokens !== undefined &&
			request.usage.cacheWrite5mTokens + request.usage.cacheWrite1hTokens !==
				request.usage.cacheWriteTokens
		) {
			context.addIssue({
				code: "custom",
				message: "reconciled cache TTL split must match cache-write usage",
				path: ["usage"],
			});
		}
		if (
			request.pricing.state === "complete" &&
			request.pricing.selectedRate.model !== request.model
		) {
			context.addIssue({
				code: "custom",
				message: "selected rate must match the normalized request model",
				path: ["pricing", "selectedRate", "model"],
			});
		}
	});

const agentEvidenceSchema = z
	.object({
		agentId: z.string().min(1),
		parentAgentId: z.string().min(1).nullable(),
		lineageState: z.enum(["complete", "single-source", "missing", "conflict"]),
		sources: z.array(z.enum(["stream", "trace"])),
	})
	.strict()
	.superRefine((agent, context) => {
		const expectsParent =
			agent.lineageState === "complete" ||
			agent.lineageState === "single-source";
		if (expectsParent !== (agent.parentAgentId !== null)) {
			context.addIssue({
				code: "custom",
				message: "parent payload contradicts lineage state",
				path: ["parentAgentId"],
			});
		}
		if (agent.lineageState === "complete" && agent.sources.length < 2) {
			context.addIssue({
				code: "custom",
				message: "complete lineage requires corroborating sources",
				path: ["sources"],
			});
		}
	});

const instructionLoadSchema = z
	.object({
		sourceOrdinal: z.number().int().nonnegative(),
		agentId: z.string().min(1).nullable(),
		attributionState: z.literal("missing").optional(),
		promptId: z.string().min(1).nullable(),
		filePath: z.string().min(1),
		memoryType: z.string().min(1),
		loadReason: z.string().min(1),
		triggerFilePath: z.string().min(1).optional(),
		parentFilePath: z.string().min(1).optional(),
		globs: z.array(z.string()).optional(),
	})
	.strict()
	.superRefine((load, context) => {
		if ((load.agentId === null) !== (load.attributionState === "missing")) {
			context.addIssue({
				code: "custom",
				message: "load attribution payload contradicts its state",
				path: ["attributionState"],
			});
		}
	});

const compactionSchema = z
	.object({
		sourceOrdinal: z.number().int().nonnegative(),
		agentId: z.string().min(1).nullable(),
		attributionState: z.literal("missing").optional(),
		promptId: z.string().min(1).nullable(),
		phase: z.enum(["pre", "post"]),
		trigger: z.string().min(1),
		summaryAvailable: z.boolean().optional(),
	})
	.strict()
	.superRefine((compaction, context) => {
		if (
			(compaction.agentId === null) !==
			(compaction.attributionState === "missing")
		) {
			context.addIssue({
				code: "custom",
				message: "compaction attribution payload contradicts its state",
				path: ["attributionState"],
			});
		}
	});

const accountingIssueSchema = z.enum([
	"keyless-request",
	"request-identity",
	"request-model",
	"request-usage",
	"request-attribution",
	"source-coverage",
	"malformed-source-record",
]);

const normalizationIssueSchema = z
	.object({
		stream: z.string().min(1),
		sourceOrdinal: z.number().int().nonnegative().nullable(),
		code: z.literal("malformed-recognized-record"),
		detail: z.string().min(1),
	})
	.strict();

const projectionSchema = z
	.object({
		agents: z.array(agentEvidenceSchema),
		requests: z.array(requestEvidenceSchema),
		keylessRequests: z.array(
			z
				.object({
					occurrenceId: z.string().min(1),
					state: z.literal("identity-missing-no-dedup"),
				})
				.strict(),
		),
		accountingState: z.enum(["complete", "incomplete"]),
		accountingIssues: z.array(accountingIssueSchema),
		normalizationIssues: z.array(normalizationIssueSchema),
		instructionLoads: z.array(instructionLoadSchema),
		compactions: z.array(compactionSchema),
		rawApiBodies: z.array(
			z
				.object({
					sourceOrdinal: z.number().int().nonnegative(),
					bodyRef: z.string().min(1),
					requestId: z.null(),
					state: z.literal("unassigned-no-documented-key"),
				})
				.strict(),
		),
		coverage: z.array(
			z
				.object({
					stream: z.string().min(1),
					state: z.enum(["complete", "partial", "unavailable"]),
					reason: z.string().min(1).optional(),
				})
				.strict(),
		),
	})
	.strict()
	.superRefine((projection, context) => {
		const expectedIssues = new Set<z.infer<typeof accountingIssueSchema>>();
		if (projection.keylessRequests.length > 0) {
			expectedIssues.add("keyless-request");
		}
		if (
			projection.requests.some(
				(request) => request.identityState !== "complete",
			)
		) {
			expectedIssues.add("request-identity");
		}
		if (
			projection.requests.some((request) => request.usageState !== "complete")
		) {
			expectedIssues.add("request-usage");
		}
		if (
			projection.requests.some(
				(request) =>
					request.modelState === "missing" || request.modelState === "conflict",
			)
		) {
			expectedIssues.add("request-model");
		}
		if (
			projection.requests.some(
				(request) => request.attributionState !== undefined,
			)
		) {
			expectedIssues.add("request-attribution");
		}
		if (projection.coverage.some((entry) => entry.state !== "complete")) {
			expectedIssues.add("source-coverage");
		}
		if (projection.normalizationIssues.length > 0) {
			expectedIssues.add("malformed-source-record");
		}
		const actualIssues = new Set(projection.accountingIssues);
		for (const issue of new Set([...expectedIssues, ...actualIssues])) {
			if (expectedIssues.has(issue) !== actualIssues.has(issue)) {
				context.addIssue({
					code: "custom",
					message: `accounting issue ${issue} contradicts the projection`,
					path: ["accountingIssues"],
				});
			}
		}
		if (
			(projection.accountingState === "complete") !==
			(projection.accountingIssues.length === 0)
		) {
			context.addIssue({
				code: "custom",
				message: "accounting state contradicts its issues",
				path: ["accountingState"],
			});
		}
	});

export const contextEvidenceSchema = z
	.object({
		schemaVersion: z.literal(1),
		source: contextEvidenceSourceSchema,
		rateCatalog: contextRateCatalogSchema.optional(),
		projection: projectionSchema,
	})
	.strict()
	.superRefine((evidence, context) => {
		for (const [index, request] of evidence.projection.requests.entries()) {
			if (request.pricing.state !== "complete") {
				continue;
			}
			const catalog = evidence.rateCatalog;
			const selected = request.pricing.selectedRate;
			const catalogRate = catalog?.models.find(
				(rate) => rate.model === selected.model,
			);
			if (
				catalog === undefined ||
				catalog.source !== request.pricing.rateSource ||
				catalog.version !== request.pricing.rateVersion ||
				catalog.currency !== request.pricing.currency ||
				catalogRate === undefined ||
				JSON.stringify(catalogRate) !== JSON.stringify(selected)
			) {
				context.addIssue({
					code: "custom",
					message: "complete pricing must reference its persisted rate catalog",
					path: ["projection", "requests", index, "pricing"],
				});
			}
			const { usage } = request;
			if (
				usage !== undefined &&
				usage.cacheWrite5mTokens !== undefined &&
				usage.cacheWrite1hTokens !== undefined
			) {
				const expectedCost = costFromRate(
					{
						inputTokens: usage.inputTokens,
						outputTokens: usage.outputTokens,
						cacheReadTokens: usage.cacheReadTokens,
						cacheWrite5mTokens: usage.cacheWrite5mTokens,
						cacheWrite1hTokens: usage.cacheWrite1hTokens,
					},
					selected,
				);
				if (
					Math.abs(expectedCost - request.pricing.calculatedCostUsd) > 1e-12
				) {
					context.addIssue({
						code: "custom",
						message: "calculated cost contradicts usage and the selected rate",
						path: ["projection", "requests", index, "pricing"],
					});
				}
			}
		}
	});

export type ContextEvidenceSource = Immutable<
	z.infer<typeof contextEvidenceSourceSchema>
>;
export type ContextEvidence = Immutable<z.infer<typeof contextEvidenceSchema>>;
export type ContextRateCatalog = Immutable<
	z.infer<typeof contextRateCatalogSchema>
>;
export type ModelRate = Immutable<z.infer<typeof modelRateSchema>>;

export interface PricedTokenUsage {
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly cacheReadTokens: number;
	readonly cacheWrite5mTokens: number;
	readonly cacheWrite1hTokens: number;
}

/**
 * One place where a rate category turns into money. Two projections price
 * requests, and a category added to the catalog but to only one of the sums
 * would undercharge silently rather than fail.
 */
/**
 * A request that consumed nothing costs nothing under every rate, since
 * costFromRate is linear with no per-request constant. Pricing it without a
 * catalogued rate assumes no rate; reporting it unpriced would leave an
 * attempt's calculated cost permanently incomplete though nothing is missing
 * from the sum.
 */
export function usageIsZero(usage: Readonly<PricedTokenUsage>): boolean {
	return (
		usage.inputTokens === 0 &&
		usage.outputTokens === 0 &&
		usage.cacheReadTokens === 0 &&
		usage.cacheWrite5mTokens === 0 &&
		usage.cacheWrite1hTokens === 0
	);
}

export function costFromRate(
	usage: Readonly<PricedTokenUsage>,
	rate: ModelRate,
): number {
	return (
		(usage.inputTokens * rate.inputUsdPerMillion +
			usage.outputTokens * rate.outputUsdPerMillion +
			usage.cacheReadTokens * rate.cacheReadUsdPerMillion +
			usage.cacheWrite5mTokens * rate.cacheWrite5mUsdPerMillion +
			usage.cacheWrite1hTokens * rate.cacheWrite1hUsdPerMillion) /
		1_000_000
	);
}
