import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const CHECKPOINTS_SUFFIX = ".checkpoints";
const MANIFEST_FILE = "manifest.json";
const RECORD_SUFFIX = ".json";

export interface BenchmarkRunPaths {
	readonly runsDirectory: string;
	readonly name: string;
	readonly artifactFile: string;
	readonly reviewFile: string;
	readonly checkpointsDirectory: string;
	readonly manifestFile: string;
	readonly replaysDirectory: string;
	readonly stageFile: (stage: string) => string;
	readonly checkpointDirectory: (stage: string) => string;
	readonly replayDirectory: (lineage: string) => string;
	readonly replayRecordFile: (lineage: string, timestamp: string) => string;
}

export interface ConfirmationRepPaths {
	readonly directory: string;
	readonly recordFile: string;
	readonly finalFile: string;
	readonly stagesDirectory: string;
	readonly checkpointsDirectory: string;
	readonly stageFile: (stage: string) => string;
	readonly checkpointDirectory: (stage: string) => string;
}

export interface ConfirmationGroupPaths {
	readonly directory: string;
	readonly groupFile: string;
	readonly inputsDirectory: string;
	readonly reportFile: string;
	readonly repsDirectory: string;
	readonly rep: (repId: string) => ConfirmationRepPaths;
}

export interface ComparisonReportPaths {
	readonly directory: string;
	readonly reportFile: string;
}

export function benchmarkRunsDirectory(controlDirectory: string): string {
	return join(controlDirectory, ".benchmark-runs");
}

export function runNameFromTimestamp(timestamp: string): string {
	return timestamp.replaceAll(":", "-");
}

export function runNameFromCheckpointsEntry(entry: string): string | undefined {
	if (!entry.endsWith(CHECKPOINTS_SUFFIX)) {
		return undefined;
	}

	return entry.slice(0, -CHECKPOINTS_SUFFIX.length);
}

/**
 * A replay record is filed under the lineage it consumed rather than under the
 * run that produced it, so it is reachable without naming a run.
 */
export function replayRecordFile(
	runsDirectory: string,
	lineage: string,
	timestamp: string,
): string {
	return join(
		runsDirectory,
		"replays",
		lineage,
		`${runNameFromTimestamp(timestamp)}.json`,
	);
}

export function benchmarkRunPaths(
	runsDirectory: string,
	name: string,
): BenchmarkRunPaths {
	const checkpointsDirectory = join(
		runsDirectory,
		`${name}${CHECKPOINTS_SUFFIX}`,
	);
	const replaysDirectory = join(runsDirectory, "replays");

	return {
		runsDirectory,
		name,
		artifactFile: join(runsDirectory, `${name}.json`),
		reviewFile: join(runsDirectory, `${name}.review.json`),
		checkpointsDirectory,
		manifestFile: join(checkpointsDirectory, MANIFEST_FILE),
		replaysDirectory,
		stageFile: (stage) => join(runsDirectory, `${name}.${stage}.json`),
		checkpointDirectory: (stage) => join(checkpointsDirectory, stage),
		replayDirectory: (lineage) => join(replaysDirectory, lineage),
		replayRecordFile: (lineage, timestamp) =>
			replayRecordFile(runsDirectory, lineage, timestamp),
	};
}

export function confirmationGroupPaths(
	runsDirectory: string,
	groupId: string,
): ConfirmationGroupPaths {
	const directory = join(runsDirectory, "confirmations", groupId);
	const repsDirectory = join(directory, "reps");

	return {
		directory,
		groupFile: join(directory, "group.json"),
		inputsDirectory: join(directory, "inputs"),
		reportFile: join(directory, "report.json"),
		repsDirectory,
		rep: (repId) => {
			const repDirectory = join(repsDirectory, repId);
			const stagesDirectory = join(repDirectory, "stages");
			const checkpointsDirectory = join(repDirectory, "checkpoints");

			return {
				directory: repDirectory,
				recordFile: join(repDirectory, "rep.json"),
				finalFile: join(repDirectory, "final.json"),
				stagesDirectory,
				checkpointsDirectory,
				stageFile: (stage) => join(stagesDirectory, `${stage}.json`),
				checkpointDirectory: (stage) => join(checkpointsDirectory, stage),
			};
		},
	};
}

export function comparisonReportPaths(
	runsDirectory: string,
	manifestDigest: string,
): ComparisonReportPaths {
	const directory = join(runsDirectory, "comparisons", manifestDigest);

	return { directory, reportFile: join(directory, "report.json") };
}

/**
 * Enumeration lives beside the path builders because this module is the only
 * one that knows a run's checkpoints directory carries a suffix, a group is a
 * directory under `confirmations`, and a replay record is a timestamp file
 * under its lineage. A directory that was never written is nothing recorded,
 * not a failure: `list` over a fresh checkout prints no line and exits 0.
 */
async function entries(directory: string): Promise<readonly Dirent[]> {
	const found: Dirent[] = await readdir(directory, {
		withFileTypes: true,
	}).catch(() => []);

	return found.toSorted((left, right) => (left.name < right.name ? -1 : 1));
}

async function directoryNames(directory: string): Promise<readonly string[]> {
	const found = await entries(directory);

	return found.filter((entry) => entry.isDirectory()).map(({ name }) => name);
}

export async function recordedRunNames(
	runsDirectory: string,
): Promise<readonly string[]> {
	const names = await directoryNames(runsDirectory);

	return names
		.map((entry) => runNameFromCheckpointsEntry(entry))
		.filter((name) => name !== undefined);
}

export function confirmationGroupIds(
	runsDirectory: string,
): Promise<readonly string[]> {
	return directoryNames(join(runsDirectory, "confirmations"));
}

export function comparisonDigests(
	runsDirectory: string,
): Promise<readonly string[]> {
	return directoryNames(join(runsDirectory, "comparisons"));
}

export interface SessionAttemptId {
	readonly caseId: string;
	readonly uuid: string;
}

export async function sessionAttemptIds(
	runsDirectory: string,
): Promise<readonly SessionAttemptId[]> {
	const sessionsDirectory = join(runsDirectory, "sessions");
	const attempts: SessionAttemptId[] = [];

	for (const caseId of await directoryNames(sessionsDirectory)) {
		for (const uuid of await directoryNames(join(sessionsDirectory, caseId))) {
			attempts.push({ caseId, uuid });
		}
	}

	return attempts;
}

export interface StageAttemptId {
	readonly lineage: string;
	readonly timestamp: string;
}

export async function replayAttemptIds(
	runsDirectory: string,
): Promise<readonly StageAttemptId[]> {
	const replaysDirectory = join(runsDirectory, "replays");
	const attempts: StageAttemptId[] = [];

	for (const lineage of await directoryNames(replaysDirectory)) {
		for (const entry of await entries(join(replaysDirectory, lineage))) {
			if (entry.isFile() && entry.name.endsWith(RECORD_SUFFIX)) {
				attempts.push({
					lineage,
					timestamp: entry.name.slice(0, -RECORD_SUFFIX.length),
				});
			}
		}
	}

	return attempts;
}
