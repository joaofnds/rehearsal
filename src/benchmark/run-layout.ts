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
