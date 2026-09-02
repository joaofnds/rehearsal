import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { SessionCase } from "./case";
import type { HashedFile } from "./checkpoint";
import { lineageKey } from "./checkpoint";
import type { SessionSettings } from "./claude";
import type { ResolvedCorpusFile } from "./corpus-file";

async function hashTree(root: string): Promise<readonly HashedFile[]> {
	const entries = await readdir(root, { recursive: true });
	const files: HashedFile[] = [];

	for (const entry of entries.toSorted()) {
		const absolute = join(root, entry);
		const entryStats = await stat(absolute);
		if (!entryStats.isFile()) {
			continue;
		}

		files.push({
			path: entry,
			sha256: new Bun.CryptoHasher("sha256")
				.update(await Bun.file(absolute).bytes())
				.digest("hex"),
		});
	}

	return files;
}

/**
 * `lineageKey` hashes exactly upstream, corpus files, model, and effort, and
 * nothing may enter that object. Everything frozen about a session attempt that
 * is not corpus — the transcript digest, the fixture tree, the prompt, and the
 * tool and settings overlays — is hashed into the one upstream string, so the
 * key keeps its four fields and a corpus edit still invalidates through
 * corpusFiles.
 */
export async function sessionUpstreamDigest(
	sessionCase: SessionCase,
): Promise<string> {
	const { declaration, fixturePath } = sessionCase;

	return createHash("sha256")
		.update(
			JSON.stringify({
				transcript: declaration.transcript?.sha256 ?? null,
				fixture: fixturePath === undefined ? null : await hashTree(fixturePath),
				prompt: sessionCase.prompt,
				tools: sessionCase.tools,
				settings: sessionCase.settings ?? null,
				agents: sessionCase.agents ?? null,
			}),
		)
		.digest("hex");
}

export async function sessionLineage(
	sessionCase: SessionCase,
	corpusFiles: readonly ResolvedCorpusFile[],
	settings: SessionSettings,
): Promise<string> {
	return lineageKey({
		upstream: await sessionUpstreamDigest(sessionCase),
		corpusFiles: corpusFiles.map(({ path, sha256 }) => ({ path, sha256 })),
		model: settings.model,
		effort: settings.effort,
	});
}
