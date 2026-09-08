import { describe, expect, it } from "bun:test";
import type { ReconciliationDependencies } from "./run-reconciliation";
import { reconcileInterruptedRuns } from "./run-reconciliation";
import { openRunEventStore } from "./run-events";

interface FakeDependencies {
	readonly artifactFiles: Set<string>;
	readonly manifests: Map<string, { readonly sourceRoot: string }>;
	readonly markers: Map<string, { readonly pid: number }>;
	readonly alivePids: Set<number>;
}

function fakeDependencies(
	runsDirectory: string,
	overrides: Partial<FakeDependencies> = {},
): ReconciliationDependencies {
	const artifactFiles = overrides.artifactFiles ?? new Set<string>();
	const manifests = overrides.manifests ?? new Map();
	const markers = overrides.markers ?? new Map();
	const alivePids = overrides.alivePids ?? new Set<number>();

	return {
		runsDirectory,
		artifactExists: (path: string) => Promise.resolve(artifactFiles.has(path)),
		loadManifest: (path: string) => Promise.resolve(manifests.get(path)),
		readMarker: (root: string) => Promise.resolve(markers.get(root)),
		isAlive: (pid: number) => alivePids.has(pid),
	};
}

describe(reconcileInterruptedRuns.name, () => {
	it("reconciles a run to INTERRUPTED when its claimed target's pid is dead and no terminal record exists", async () => {
		const store = openRunEventStore(":memory:");
		store.append({
			runId: "run-1",
			kind: "stage-started",
			stage: "shape",
			spentUsd: 0,
			elapsedMs: 0,
		});
		const dependencies = fakeDependencies("/runs", {
			manifests: new Map([
				["/runs/run-1.checkpoints/manifest.json", { sourceRoot: "/target" }],
			]),
			markers: new Map([["/target", { pid: 4242 }]]),
			alivePids: new Set(),
		});

		const reconciled = await reconcileInterruptedRuns(store, dependencies);

		expect(reconciled).toEqual(["run-1"]);
		expect(store.latestEvent("run-1")?.kind).toBe("run-interrupted");
	});

	it("leaves a run alone when its claimed target's pid is still alive", async () => {
		const store = openRunEventStore(":memory:");
		store.append({
			runId: "run-1",
			kind: "stage-started",
			stage: "shape",
			spentUsd: 0,
			elapsedMs: 0,
		});
		const dependencies = fakeDependencies("/runs", {
			manifests: new Map([
				["/runs/run-1.checkpoints/manifest.json", { sourceRoot: "/target" }],
			]),
			markers: new Map([["/target", { pid: 4242 }]]),
			alivePids: new Set([4242]),
		});

		const reconciled = await reconcileInterruptedRuns(store, dependencies);

		expect(reconciled).toEqual([]);
		expect(store.latestEvent("run-1")?.kind).toBe("stage-started");
	});

	it("leaves a run alone once its terminal record already exists on disk", async () => {
		const store = openRunEventStore(":memory:");
		store.append({
			runId: "run-1",
			kind: "stage-started",
			stage: "shape",
			spentUsd: 0,
			elapsedMs: 0,
		});
		const dependencies = fakeDependencies("/runs", {
			artifactFiles: new Set(["/runs/run-1.json"]),
		});

		const reconciled = await reconcileInterruptedRuns(store, dependencies);

		expect(reconciled).toEqual([]);
		expect(store.latestEvent("run-1")?.kind).toBe("stage-started");
	});

	it("treats a missing manifest as nothing to reconcile, not an error, since the crash may have preceded it", async () => {
		const store = openRunEventStore(":memory:");
		store.append({
			runId: "run-1",
			kind: "stage-started",
			stage: "shape",
			spentUsd: 0,
			elapsedMs: 0,
		});
		const dependencies = fakeDependencies("/runs");

		const reconciled = await reconcileInterruptedRuns(store, dependencies);

		expect(reconciled).toEqual([]);
		expect(store.latestEvent("run-1")?.kind).toBe("stage-started");
	});

	it("treats a missing claim marker as nothing to reconcile, since the target may already have been restored", async () => {
		const store = openRunEventStore(":memory:");
		store.append({
			runId: "run-1",
			kind: "stage-started",
			stage: "shape",
			spentUsd: 0,
			elapsedMs: 0,
		});
		const dependencies = fakeDependencies("/runs", {
			manifests: new Map([
				["/runs/run-1.checkpoints/manifest.json", { sourceRoot: "/target" }],
			]),
		});

		const reconciled = await reconcileInterruptedRuns(store, dependencies);

		expect(reconciled).toEqual([]);
		expect(store.latestEvent("run-1")?.kind).toBe("stage-started");
	});

	it("does not re-reconcile a run already marked INTERRUPTED", async () => {
		const store = openRunEventStore(":memory:");
		store.append({
			runId: "run-1",
			kind: "run-interrupted",
			stage: "shape",
			spentUsd: 0,
			elapsedMs: 0,
		});
		const dependencies = fakeDependencies("/runs", {
			manifests: new Map([
				["/runs/run-1.checkpoints/manifest.json", { sourceRoot: "/target" }],
			]),
			markers: new Map([["/target", { pid: 4242 }]]),
		});

		const reconciled = await reconcileInterruptedRuns(store, dependencies);

		expect(reconciled).toEqual([]);
	});

	it("reconciles every crashed run among several, independently", async () => {
		const store = openRunEventStore(":memory:");
		store.append({
			runId: "run-1",
			kind: "stage-started",
			stage: "shape",
			spentUsd: 0,
			elapsedMs: 0,
		});
		store.append({
			runId: "run-2",
			kind: "stage-started",
			stage: "discuss",
			spentUsd: 0,
			elapsedMs: 0,
		});
		const dependencies = fakeDependencies("/runs", {
			manifests: new Map([
				["/runs/run-1.checkpoints/manifest.json", { sourceRoot: "/target-1" }],
				["/runs/run-2.checkpoints/manifest.json", { sourceRoot: "/target-2" }],
			]),
			markers: new Map([
				["/target-1", { pid: 111 }],
				["/target-2", { pid: 222 }],
			]),
			alivePids: new Set([222]),
		});

		const reconciled = await reconcileInterruptedRuns(store, dependencies);

		expect(reconciled.toSorted()).toEqual(["run-1"]);
	});
});
