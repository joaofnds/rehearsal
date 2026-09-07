import { z } from "zod";
import type { HashedFile } from "./checkpoint";

export class StageSettingsError extends Error {
	public override name = "StageSettingsError";
}

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
 * The file's own bytes are what lineage hashes and what `--settings` carries
 * verbatim, so the schema only gates the file at load time; a value the
 * schema accepts is re-serialized from the parsed value, not from the raw
 * text, so a settings file with insignificant whitespace still produces one
 * canonical lineage hash.
 */
export async function loadStageSettings(
	path: string,
): Promise<LoadedStageSettings> {
	const file = Bun.file(path);
	const bytes = await file.bytes();

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

	return {
		json: JSON.stringify(parsed.data),
		hashed: {
			path,
			sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
		},
	};
}
