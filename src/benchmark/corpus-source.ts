import { homedir } from "node:os";
import { join } from "node:path";

export class CorpusSourceError extends Error {
	public override name = "CorpusSourceError";
}

/**
 * Where an attempt's corpus bytes come from, parsed once so nothing downstream
 * learns whether they were rendered, copied, or read from the live install:
 * `root` is the only thing hashing and installing ever see.
 */
export interface ResolvedCorpusSource {
	readonly kind: "live" | "directory";
	readonly root: string;
}

export function liveCorpusRoot(): string {
	return join(homedir(), ".claude");
}

export function resolveCorpusSource(
	source: string | undefined,
): Promise<ResolvedCorpusSource> {
	if (source === undefined) {
		return Promise.resolve({ kind: "live", root: liveCorpusRoot() });
	}

	return Promise.resolve({ kind: "directory", root: source });
}
