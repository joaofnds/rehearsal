import { z } from "zod";
import type { HashedFile } from "./checkpoint";
import { displayPath } from "./config";

export class StageSettingsError extends Error {
	public override name = "StageSettingsError";
}

/**
 * Where the harness-owned settings file lives when a case declares none of
 * its own, relative to the control repository root: committed, versioned
 * data the harness ships, the same way `CLAUDE.md` at the root is corpus the
 * harness ships. A case names its own file to override this one; neither is
 * ever a copy of the operator's live `~/.claude/settings.json`.
 */
export const DEFAULT_STAGE_SETTINGS_FILE = "stage-settings.json";

/**
 * Every key a stage session's settings file may carry: the permissions deny
 * list and the boolean feature switches the harness has an opinion on. No
 * `hooks` key exists here, and `.strict()` refuses any key this schema does
 * not name, so a hooks block, a live settings.json's other knobs, or a typo
 * all fail to parse rather than reaching a stage session unnoticed.
 */
export const stageSettingsSchema = z
	.object({
		permissions: z
			.object({ deny: z.array(z.string()) })
			.strict()
			.optional(),
		disableAllHooks: z.boolean().optional(),
		disableSkillShellExecution: z.boolean().optional(),
		disableBundledSkills: z.boolean().optional(),
		disableWorkflows: z.boolean().optional(),
		disableAutoMode: z.boolean().optional(),
	})
	.strict();

export type StageSettings = z.infer<typeof stageSettingsSchema>;

export interface LoadedStageSettings {
	readonly json: string;
	readonly hashed: HashedFile;
}

/**
 * Lineage hashes the same re-serialized JSON that reaches `--settings`, not
 * the file's raw bytes, so a settings file with insignificant whitespace
 * still produces one canonical lineage hash.
 */
export async function loadStageSettings(
	path: string,
): Promise<LoadedStageSettings> {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new StageSettingsError(
			`No stage settings file at ${path}; add it or correct the declared settingsFile`,
		);
	}

	let bytes: Uint8Array;
	try {
		bytes = await file.bytes();
	} catch (error) {
		throw new StageSettingsError(
			`Cannot read stage settings file ${path}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	let document: unknown;
	try {
		document = JSON.parse(new TextDecoder().decode(bytes));
	} catch (error) {
		throw new StageSettingsError(
			`Stage settings file ${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const parsed = stageSettingsSchema.safeParse(document);
	if (!parsed.success) {
		const [issue] = parsed.error.issues;
		const field = issue?.path.join(".");
		throw new StageSettingsError(
			`Stage settings file ${path} has an invalid ${field === undefined || field === "" ? "declaration" : field}: ${issue?.message ?? "invalid settings"}`,
		);
	}

	const json = JSON.stringify(parsed.data);

	return {
		json,
		hashed: {
			path: displayPath(path),
			sha256: new Bun.CryptoHasher("sha256").update(json).digest("hex"),
		},
	};
}
