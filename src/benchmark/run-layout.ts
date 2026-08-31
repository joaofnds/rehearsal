import { join } from "node:path";

const CHECKPOINTS_SUFFIX = ".checkpoints";
const MANIFEST_FILE = "manifest.json";

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

export function benchmarkRunsDirectory(controlDirectory: string): string {
	return join(controlDirectory, ".benchmark-runs");
}

export function runNameFromTimestamp(timestamp: string): string {
	return timestamp.replaceAll(":", "-");
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
			join(
				replaysDirectory,
				lineage,
				`${runNameFromTimestamp(timestamp)}.json`,
			),
	};
}
