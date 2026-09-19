import { createHash } from "node:crypto";
import type { SessionCase } from "./case";
import { hashDirectory, lineageKey } from "./checkpoint";
import type { SessionSettings } from "./claude";
import type { ResolvedCorpusFile } from "./corpus-file";
import type { JsonValue } from "./json-value";
import { jsonArraySchema, jsonObjectSchema } from "./json-value";

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

/**
 * A settings block written in another key order is the same settings, so the
 * digest must not change with it. Every nesting level is ordered, because a
 * permission grant sits at `permissions.allow` and an arm that may edit files
 * must not share an identity with one that may not.
 */
/**
 * `JsonValue` carries no discriminant, so which member a value is comes from
 * parsing it rather than from a `typeof` on its representation. An array keeps
 * its order, since order is meaning there; an object's keys are sorted; every
 * other member is already its own identity.
 */
function orderedForHashing(value: JsonValue): JsonValue {
	const array = jsonArraySchema.safeParse(value);
	if (array.success) {
		return array.data.map((element) => orderedForHashing(element));
	}

	const object = jsonObjectSchema.safeParse(value);
	if (!object.success) {
		return value;
	}

	return Object.fromEntries(
		Object.entries(object.data)
			.toSorted(([left], [right]) => left.localeCompare(right))
			.map(([key, nested]) => [key, orderedForHashing(nested)]),
	);
}

/**
 * The identity of an arm's behavior settings, recorded beside the corpus
 * digests. `sessionUpstreamDigest` already folds the settings into lineage, so
 * two arms differing only here are already refused as incomparable; what that
 * digest cannot do is say *which* input differed, because it hashes the prompt,
 * tools, fixture and agents into one string. Settings are the one declared
 * input with no per-file digest of its own, so without this an operator reading
 * two records sees the lineage differ and nothing that names the reason.
 */
export function sessionSettingsDigest(
	sessionCase: SessionCase,
): string | undefined {
	if (sessionCase.settings === undefined) {
		return undefined;
	}

	return createHash("sha256")
		.update(JSON.stringify(orderedForHashing(sessionCase.settings)))
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
