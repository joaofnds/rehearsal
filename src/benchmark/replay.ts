import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
	type CheckpointRecord,
	type HashedFile,
	INITIAL_CHECKPOINT_STAGE,
	readCheckpointRecord,
} from "./checkpoint";
import type { RunManifest } from "./manifest";
import type { StageDefinition } from "./pipeline";

export class ReplayError extends Error {}

/**
 * Every checkpoint the run recorded, keyed by stage. The record's own stage
 * name is authoritative; the directory name only locates it.
 */
export async function loadRunCheckpoints(
	runDirectory: string,
): Promise<Map<string, CheckpointRecord>> {
	const checkpoints = new Map<string, CheckpointRecord>();

	for (const entry of await readdir(runDirectory, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;

		const record = await readCheckpointRecord(join(runDirectory, entry.name));
		checkpoints.set(record.stage, record);
	}

	return checkpoints;
}

export interface ReplayPlan {
	readonly definition: StageDefinition;
	readonly consumed: CheckpointRecord;
	readonly priorArtifacts: readonly HashedFile[];
}

/**
 * Replaying stage N consumes the checkpoint of stage N-1: the state after
 * that stage was accepted. The whole chain back to the initial checkpoint is
 * verified first, because the prior artifacts fed to the judge are collected
 * from every earlier checkpoint and a broken link would present artifacts
 * that never led to the consumed state.
 */
export function resolveReplay(
	manifest: RunManifest,
	checkpoints: ReadonlyMap<string, CheckpointRecord>,
	stageName: string,
): ReplayPlan {
	const stages = manifest.pipeline.stages;
	const index = stages.findIndex(({ name }) => name === stageName);
	const definition = stages[index];
	if (!definition) {
		throw new ReplayError(
			`The run's pipeline has no ${stageName} stage; it declares ${stages
				.map(({ name }) => name)
				.join(", ")}`,
		);
	}

	const initial = checkpoints.get(INITIAL_CHECKPOINT_STAGE);
	if (!initial) {
		throw new ReplayError(
			"The run has no initial checkpoint; runs recorded before initial checkpoints cannot be replayed",
		);
	}

	let consumed = initial;
	const priorArtifacts: HashedFile[] = [];
	for (const earlier of stages.slice(0, index)) {
		const checkpoint = checkpoints.get(earlier.name);
		if (!checkpoint) {
			throw new ReplayError(
				`The run has no checkpoint for the ${earlier.name} stage; it stopped before accepting it`,
			);
		}
		if (checkpoint.upstream !== consumed.lineage) {
			throw new ReplayError(
				`The run's checkpoint chain is broken at the ${earlier.name} stage: it consumed ${checkpoint.upstream}, but ${consumed.stage} produced ${consumed.lineage}`,
			);
		}

		priorArtifacts.push(...checkpoint.artifacts);
		consumed = checkpoint;
	}

	return { definition, consumed, priorArtifacts };
}
