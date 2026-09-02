import { homedir } from "node:os";
import { join } from "node:path";
import { PROJECT_INSTRUCTIONS_PATH } from "./config";

export class CorpusFileError extends Error {
	public override name = "CorpusFileError";
}

/**
 * The one place that knows where the corpus is installed. A case names a file
 * in corpus layout paths, and this maps that layout onto the live install;
 * ACT-26.6 replaces the body with a corpus source and nothing else moves.
 */
export function resolveCorpusFile(layoutPath: string): string {
	if (layoutPath === "CLAUDE.md") {
		return PROJECT_INSTRUCTIONS_PATH;
	}

	const claudeHome = join(homedir(), ".claude");
	for (const prefix of ["output-styles/", "agents/", "skills/"]) {
		if (layoutPath.startsWith(prefix)) {
			return join(claudeHome, layoutPath);
		}
	}

	throw new CorpusFileError(
		`Corpus file ${layoutPath} names no corpus layout path: use CLAUDE.md, output-styles/<name>.md, agents/<name>.md, or skills/<name>/...`,
	);
}

export interface ResolvedCorpusFile {
	readonly path: string;
	readonly resolvedPath: string;
	readonly sha256: string;
}

/**
 * A declared corpus file that does not resolve is refused here, before any
 * provider call: discovering a missing style after paying for a session is the
 * failure this ordering prevents.
 */
export async function hashCorpusFiles(
	layoutPaths: readonly string[],
): Promise<readonly ResolvedCorpusFile[]> {
	const hashed: ResolvedCorpusFile[] = [];
	for (const layoutPath of layoutPaths) {
		const resolvedPath = resolveCorpusFile(layoutPath);
		const file = Bun.file(resolvedPath);
		if (!(await file.exists())) {
			throw new CorpusFileError(
				`Corpus file ${layoutPath} does not exist at ${resolvedPath}`,
			);
		}

		hashed.push({
			path: layoutPath,
			resolvedPath,
			sha256: new Bun.CryptoHasher("sha256")
				.update(await file.bytes())
				.digest("hex"),
		});
	}

	return hashed;
}
