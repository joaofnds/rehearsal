import { createHash } from "node:crypto";
import type { SessionCase } from "./case";
import { hashDirectory, lineageKey } from "./checkpoint";
import type { SessionSettings } from "./claude";
import type { ResolvedCorpusFile } from "./corpus-file";

/**
 * `lineageKey` hashes upstream, corpus files, model, effort, and a stage
 * checkpoint's settings file; nothing else may enter that object. A session
 * case has no settings file of its own — that surface is ACT-37's, for stage
 * checkpoints only — so it never sets that field and always hashes it as
 * absent. Everything else frozen about a session attempt that is not corpus
 * — the transcript digest, the fixture tree, the prompt, the tool and
 * settings overlays, and the declared project files — is hashed into the one
 * upstream string, so a corpus edit still invalidates through corpusFiles.
 * `projectFiles` names which of the fixture's own bytes the manifest checks
 * against, a fact the fixture's byte hash alone does not carry: two cases
 * sharing one fixture tree but declaring a different project file are
 * checked against a different contract and must not share a lineage.
 */
export async function sessionUpstreamDigest(
	sessionCase: SessionCase,
): Promise<string> {
	const { declaration, fixturePath } = sessionCase;

	return createHash("sha256")
		.update(
			JSON.stringify({
				transcript: declaration.transcript?.sha256 ?? null,
				fixture:
					fixturePath === undefined
						? null
						: await hashDirectory(fixturePath, "", { rootMayBeALink: false }),
				prompt: sessionCase.prompt,
				tools: sessionCase.tools,
				settings: sessionCase.settings ?? null,
				agents: sessionCase.agents ?? null,
				projectFiles: sessionCase.projectFiles,
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
