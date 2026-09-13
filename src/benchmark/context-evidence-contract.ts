import { z } from "zod";
import type { Immutable } from "./contracts";
import { jsonObjectSchema } from "./json-value";

const rawRecordSchema = jsonObjectSchema;

const captureSchema = z
	.object({
		provider: z.string().min(1),
		cliVersion: z.string().min(1),
		capturedAt: z.string().datetime(),
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

export const contextRateCatalogSchema = z
	.object({
		schemaVersion: z.literal(1),
		source: z.string().min(1),
		version: z.string().min(1),
		currency: z.string().min(1),
		models: z.array(modelRateSchema),
	})
	.strict();

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

const requestPricingSchema = z
	.object({
		state: z.enum([
			"complete",
			"usage-missing",
			"usage-conflict",
			"ttl-split-missing",
			"ttl-split-conflict",
			"rates-missing",
		]),
		calculatedCostUsd: z.number().nonnegative().optional(),
		rateSource: z.string().min(1).optional(),
		rateVersion: z.string().min(1).optional(),
		currency: z.string().min(1).optional(),
	})
	.strict();

const requestEvidenceSchema = z
	.object({
		requestId: z.string().min(1),
		agentId: z.string().min(1).nullable(),
		attributionState: z.enum(["missing", "conflict"]).optional(),
		model: z.string().min(1).nullable(),
		usageState: z.enum(["complete", "missing", "partial", "conflict"]),
		usage: tokenUsageSchema.optional(),
		providerCostUsd: z.number().nonnegative().optional(),
		pricing: requestPricingSchema,
		otelOccurrences: z.number().int().nonnegative(),
		uniqueOtelOccurrences: z.number().int().nonnegative(),
		transcriptOccurrences: z.number().int().nonnegative(),
	})
	.strict();

const agentEvidenceSchema = z
	.object({
		agentId: z.string().min(1),
		parentAgentId: z.string().min(1).nullable(),
		lineageState: z.enum(["complete", "single-source", "missing", "conflict"]),
		sources: z.array(z.enum(["stream", "trace"])),
	})
	.strict();

const instructionLoadSchema = z
	.object({
		sourceOrdinal: z.number().int().nonnegative(),
		agentId: z.string().min(1),
		promptId: z.string().min(1).nullable(),
		filePath: z.string().min(1),
		memoryType: z.string().min(1),
		loadReason: z.string().min(1),
		triggerFilePath: z.string().min(1).optional(),
		parentFilePath: z.string().min(1).optional(),
		globs: z.array(z.string()).optional(),
	})
	.strict();

const compactionSchema = z
	.object({
		sourceOrdinal: z.number().int().nonnegative(),
		agentId: z.string().min(1),
		promptId: z.string().min(1).nullable(),
		phase: z.enum(["pre", "post"]),
		trigger: z.string().min(1),
		summaryAvailable: z.boolean().optional(),
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
		accountingState: z.enum(["complete", "incomplete-keyless-occurrences"]),
		instructionLoads: z.array(instructionLoadSchema),
		compactions: z.array(compactionSchema),
		rawApiBodies: z.array(
			z
				.object({
					sourceOrdinal: z.number().int().nonnegative(),
					bodyRef: z.string().min(1),
					requestId: z.string().min(1).nullable(),
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
	.strict();

export const contextEvidenceSchema = z
	.object({
		schemaVersion: z.literal(1),
		source: contextEvidenceSourceSchema,
		projection: projectionSchema,
	})
	.strict();

export type ContextEvidenceSource = Immutable<
	z.infer<typeof contextEvidenceSourceSchema>
>;
export type ContextEvidence = Immutable<z.infer<typeof contextEvidenceSchema>>;
export type ContextRateCatalog = Immutable<
	z.infer<typeof contextRateCatalogSchema>
>;
