import { describe, expect, it } from "bun:test";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunManifest } from "./manifest";
import { loadRunManifest, writeRunManifest } from "./manifest";
import { benchmarkRunPaths } from "./run-layout";
import { TEST_TARGET, TestResources } from "./test-support";

const testResources = TestResources.forEachTest();

describe(loadRunManifest.name, () => {
	function manifestFixture(): RunManifest {
		return {
			caseId: "audit-log",
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
				target: TEST_TARGET,
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

	it("reads a manifest without a caseId as the audit-log case", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-manifest-"));
		testResources.track(directory);
		const paths = benchmarkRunPaths(directory, "run");
		const { caseId: _caseId, ...legacy } = manifestFixture();

		await Bun.write(paths.manifestFile, JSON.stringify(legacy));

		const loaded = await loadRunManifest(paths.manifestFile);

		expect(loaded.caseId).toBe("audit-log");
	});

	it("loads a pre-target manifest with the former target configuration", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-manifest-"));
		testResources.track(directory);
		const paths = benchmarkRunPaths(directory, "run");
		const manifest = manifestFixture();
		const { target: _target, ...legacyPipeline } = manifest.pipeline;
		await Bun.write(
			paths.manifestFile,
			`${JSON.stringify({ ...manifest, pipeline: legacyPipeline }, null, 2)}\n`,
		);

		const loaded = await loadRunManifest(paths.manifestFile);

		expect(loaded.pipeline.target).toEqual({
			checks: [
				{
					command: ["bun", "run", "typecheck"],
					env: { CONFIG_PATH: "src/config/test.yaml" },
				},
				{
					command: ["bun", "run", "check"],
					env: { CONFIG_PATH: "src/config/test.yaml" },
				},
				{
					command: ["bun", "run", "test:unit"],
					env: { CONFIG_PATH: "src/config/test.yaml" },
				},
			],
			integrityFiles: ["package.json", "tsconfig.json", "biome.json"],
		});
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
