import type { ContextRateCatalog } from "./context-evidence-contract";
import { contextRateCatalogSchema } from "./context-evidence-contract";

/**
 * Removing a rate here silently unprices every request that used it, and the
 * suite defends the four corpus-measured categories against drift. The 5m
 * cache-write figure is the exception: no saved attempt writes a 5m cache
 * entry, so it is computed as 1.25x the input rate, the published tier
 * multiplier, and no charge has ever confirmed it.
 */
export const committedRateCatalog: ContextRateCatalog =
	contextRateCatalogSchema.parse({
		schemaVersion: 1,
		source: "anthropic-list-prices",
		version: "2026-09-15",
		currency: "USD",
		provenance: {
			inputUsdPerMillion: "corpus-measured",
			outputUsdPerMillion: "corpus-measured",
			cacheReadUsdPerMillion: "corpus-measured",
			cacheWrite1hUsdPerMillion: "corpus-measured",
			cacheWrite5mUsdPerMillion: "tier-inferred",
		},
		models: [
			{
				model: "claude-sonnet-5",
				inputUsdPerMillion: 2,
				outputUsdPerMillion: 10,
				cacheReadUsdPerMillion: 0.2,
				cacheWrite5mUsdPerMillion: 2.5,
				cacheWrite1hUsdPerMillion: 4,
			},
			{
				model: "claude-opus-5",
				inputUsdPerMillion: 5,
				outputUsdPerMillion: 25,
				cacheReadUsdPerMillion: 0.5,
				cacheWrite5mUsdPerMillion: 6.25,
				cacheWrite1hUsdPerMillion: 10,
			},
		],
	});

export function rateFor(
	catalog: ContextRateCatalog,
	model: string,
): ContextRateCatalog["models"][number] | undefined {
	return catalog.models.find((rate) => rate.model === model);
}
