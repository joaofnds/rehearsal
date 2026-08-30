import { join } from "node:path";
import { z } from "zod";
import { effortSchema } from "./config";
import { pipelineDefinitionSchema } from "./pipeline";

export const RUN_MANIFEST_FILE = "manifest.json";

/**
 * Written when the run starts, not when it ends: a run that dies mid-pipeline
 * still leaves replay everything it needs to re-run a stage from the
 * checkpoints the run did record.
 */
const runManifestSchema = z
	.object({
		timestamp: z.string().min(1),
		controlSha: z.string().min(1),
		sourceRoot: z.string().min(1),
		sourceSha: z.string().min(1),
		taskId: z.string().min(1),
		taskSha: z.string().min(1),
		task: z.string().min(1),
		productBrief: z.string().min(1),
		model: z.string().min(1),
		effort: effortSchema.optional(),
		judgeModel: z.string().min(1),
		judgeEffort: effortSchema.optional(),
		sessionBudgetUsd: z.number().positive(),
		pipelinePath: z.string().min(1),
		pipeline: pipelineDefinitionSchema,
	})
	.strict();

export type RunManifest = z.infer<typeof runManifestSchema>;

export async function writeRunManifest(
	runDirectory: string,
	manifest: RunManifest,
) {
	await Bun.write(
		join(runDirectory, RUN_MANIFEST_FILE),
		`${JSON.stringify(manifest, null, 2)}\n`,
	);
}

export async function loadRunManifest(
	runDirectory: string,
): Promise<RunManifest> {
	const path = join(runDirectory, RUN_MANIFEST_FILE);
	const file = Bun.file(path);

	if (!(await file.exists())) {
		throw new Error(
			`No run manifest at ${path}; runs recorded before manifests cannot be replayed`,
		);
	}

	return runManifestSchema.parse(JSON.parse(await file.text()));
}
