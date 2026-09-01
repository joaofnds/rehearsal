import { describe, expect, it } from "bun:test";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunManifest } from "./manifest";
import { loadRunManifest, writeRunManifest } from "./manifest";
import { benchmarkRunPaths } from "./run-layout";
import { TestResources } from "./test-support";

const testResources = TestResources.forEachTest();

describe(loadRunManifest.name, () => {
	function manifestFixture(): RunManifest {
		return {
			timestamp: "2026-08-30T00:00:00.000Z",
			controlSha: "control-sha",
			sourceRoot: "/tmp/target",
			sourceSha: "source-sha",
			taskId: "TASK-1",
			taskSha: "task-sha",
			task: "Task text",
			productBrief: "Brief text",
			model: "sonnet",
			effort: "high",
			judgeModel: "opus",
			judgeEffort: "high",
			sessionBudgetUsd: 5,
			pipeline: {
				statuses: ["To Do", "Done"],
				stages: [
					{
						name: "discuss",
						kind: "planning",
						skill: "discuss",
						artifact: "spec",
						rubric: "rubrics/discuss.json",
						requiresAcceptanceCriteria: false,
					},
					{
						name: "build",
						kind: "delivery",
						skill: "build",
						rubric: "rubrics/build.json",
					},
				],
			},
			pipelinePath: "pipelines/default.json",
		};
	}

	it("round-trips the manifest a run wrote", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-manifest-"));
		testResources.track(directory);
		const paths = benchmarkRunPaths(directory, "run");
		const manifest = manifestFixture();

		await writeRunManifest(paths.manifestFile, manifest);
		const manifestStats = await stat(paths.manifestFile);

		expect(await loadRunManifest(paths.manifestFile)).toEqual(manifest);
		expect(manifestStats.isFile()).toBe(true);
	});

	it("names the missing manifest when the run predates manifests", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-manifest-"));
		testResources.track(directory);
		const paths = benchmarkRunPaths(directory, "run");

		expect(loadRunManifest(paths.manifestFile)).rejects.toThrow(
			"runs recorded before manifests cannot be replayed",
		);
	});

	it("rejects a manifest that lost a field it later needs", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-manifest-"));
		testResources.track(directory);
		const paths = benchmarkRunPaths(directory, "run");
		const { taskSha: _taskSha, ...truncated } = manifestFixture();
		await Bun.write(
			paths.manifestFile,
			`${JSON.stringify(truncated, null, 2)}\n`,
		);

		expect(loadRunManifest(paths.manifestFile)).rejects.toThrow();
	});
});
