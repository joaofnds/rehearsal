import type { ContextRateCatalog } from "./context-evidence-contract";

/**
 * A synthetic catalog's provenance says nothing, but the schema requires it.
 * Tests that care about provenance state it themselves; the rest take this.
 */
export const syntheticRateProvenance: ContextRateCatalog["provenance"] = {
	inputUsdPerMillion: "publication-backed",
	outputUsdPerMillion: "publication-backed",
	cacheReadUsdPerMillion: "publication-backed",
	cacheWrite5mUsdPerMillion: "publication-backed",
	cacheWrite1hUsdPerMillion: "publication-backed",
};
