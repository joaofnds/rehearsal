import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import {
	benchmarkRunPaths,
	benchmarkRunsDirectory,
	confirmationGroupPaths,
	runNameFromCheckpointsEntry,
	runNameFromTimestamp,
} from "./run-layout";

describe(benchmarkRunPaths.name, () => {
	it("preserves every existing run artifact path", () => {
		const runsDirectory = benchmarkRunsDirectory("/control");
		const name = runNameFromTimestamp("2026-08-31T01:45:19.323Z");
		const paths = benchmarkRunPaths(runsDirectory, name);

		expect(paths).toMatchObject({
			runsDirectory: join("/control", ".benchmark-runs"),
			name: "2026-08-31T01-45-19.323Z",
			artifactFile: join(
				"/control",
				".benchmark-runs",
				"2026-08-31T01-45-19.323Z.json",
			),
			reviewFile: join(
				"/control",
				".benchmark-runs",
				"2026-08-31T01-45-19.323Z.review.json",
			),
			checkpointsDirectory: join(
				"/control",
				".benchmark-runs",
				"2026-08-31T01-45-19.323Z.checkpoints",
			),
			manifestFile: join(
				"/control",
				".benchmark-runs",
				"2026-08-31T01-45-19.323Z.checkpoints",
				"manifest.json",
			),
			replaysDirectory: join("/control", ".benchmark-runs", "replays"),
		});
		expect(paths.stageFile("shape")).toBe(
			join(
				"/control",
				".benchmark-runs",
				"2026-08-31T01-45-19.323Z.shape.json",
			),
		);
		expect(paths.checkpointDirectory("initial")).toBe(
			join(
				"/control",
				".benchmark-runs",
				"2026-08-31T01-45-19.323Z.checkpoints",
				"initial",
			),
		);
		expect(
			paths.replayRecordFile("lineage-1", "2026-08-31T04:22:25.607Z"),
		).toBe(
			join(
				"/control",
				".benchmark-runs",
				"replays",
				"lineage-1",
				"2026-08-31T04-22-25.607Z.json",
			),
		);
		expect(runNameFromCheckpointsEntry("run-1.checkpoints")).toBe("run-1");
		expect(runNameFromCheckpointsEntry("run-1.json")).toBeUndefined();
	});
});

describe(confirmationGroupPaths.name, () => {
	it("assigns one durable path to every group and rep artifact", () => {
		const paths = confirmationGroupPaths(
			benchmarkRunsDirectory("/control"),
			"group-1",
		);
		const rep = paths.rep("group-1-rep-2");

		expect(paths).toMatchObject({
			directory: join(
				"/control",
				".benchmark-runs",
				"confirmations",
				"group-1",
			),
			groupFile: join(
				"/control",
				".benchmark-runs",
				"confirmations",
				"group-1",
				"group.json",
			),
			inputsDirectory: join(
				"/control",
				".benchmark-runs",
				"confirmations",
				"group-1",
				"inputs",
			),
			reportFile: join(
				"/control",
				".benchmark-runs",
				"confirmations",
				"group-1",
				"report.json",
			),
			repsDirectory: join(
				"/control",
				".benchmark-runs",
				"confirmations",
				"group-1",
				"reps",
			),
		});
		expect(rep).toMatchObject({
			directory: join(paths.repsDirectory, "group-1-rep-2"),
			recordFile: join(paths.repsDirectory, "group-1-rep-2", "rep.json"),
			stagesDirectory: join(paths.repsDirectory, "group-1-rep-2", "stages"),
			checkpointsDirectory: join(
				paths.repsDirectory,
				"group-1-rep-2",
				"checkpoints",
			),
		});
		expect(rep.stageFile("build")).toBe(
			join(paths.repsDirectory, "group-1-rep-2", "stages", "build.json"),
		);
		expect(rep.checkpointDirectory("build")).toBe(
			join(paths.repsDirectory, "group-1-rep-2", "checkpoints", "build"),
		);
	});
});
