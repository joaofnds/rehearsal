import { describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	isTerminalRunEventKind,
	openRunEventStore,
	runEventRecorderFor,
} from "./run-events";
import { TestResources } from "./test-support";

const testResources = TestResources.forEachTest();

describe(openRunEventStore.name, () => {
	it("opens a file-backed database in WAL mode, per decision-3", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-run-events-"));
		testResources.track(directory);

		const store = await openRunEventStore(join(directory, "events.sqlite"));

		expect(store.journalMode()).toBe("wal");
		store.close();
	});

	it("creates a database file's parent directory when it does not exist yet, since the runs directory is never created ahead of the first run", async () => {
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-run-events-"));
		testResources.track(parent);
		const path = join(parent, "not-yet-created", "events.sqlite");

		const store = await openRunEventStore(path);

		expect(await Bun.file(path).exists()).toBe(true);
		store.close();
	});

	it("replays every appended event for a run in append order", async () => {
		const store = await openRunEventStore(":memory:");

		store.append({
			runId: "run-1",
			kind: "stage-started",
			stage: "shape",
			spentUsd: 0,
			elapsedMs: 0,
		});
		store.append({
			runId: "run-1",
			kind: "turn-completed",
			stage: "shape",
			spentUsd: 0.5,
			elapsedMs: 1000,
		});

		expect(
			store.eventsSince("run-1", 0).map(({ kind, spentUsd }) => ({
				kind,
				spentUsd,
			})),
		).toEqual([
			{ kind: "stage-started", spentUsd: 0 },
			{ kind: "turn-completed", spentUsd: 0.5 },
		]);
	});

	it("keeps events for different runs separate", async () => {
		const store = await openRunEventStore(":memory:");

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

		expect(store.eventsSince("run-1", 0)).toHaveLength(1);
		expect(store.eventsSince("run-2", 0)).toHaveLength(1);
	});

	it("returns only events after the requested sequence, for a reader that reconnects mid-stream", async () => {
		const store = await openRunEventStore(":memory:");

		store.append({
			runId: "run-1",
			kind: "stage-started",
			stage: "shape",
			spentUsd: 0,
			elapsedMs: 0,
		});
		const [first] = store.eventsSince("run-1", 0);
		store.append({
			runId: "run-1",
			kind: "turn-completed",
			stage: "shape",
			spentUsd: 0.5,
			elapsedMs: 1000,
		});

		expect(
			store.eventsSince("run-1", first?.sequence ?? 0).map(({ kind }) => kind),
		).toEqual(["turn-completed"]);
	});

	it("reports the latest event recorded for a run", async () => {
		const store = await openRunEventStore(":memory:");

		store.append({
			runId: "run-1",
			kind: "stage-started",
			stage: "shape",
			spentUsd: 0,
			elapsedMs: 0,
		});
		store.append({
			runId: "run-1",
			kind: "run-completed",
			stage: "shape",
			spentUsd: 1,
			elapsedMs: 2000,
		});

		expect(store.latestEvent("run-1")?.kind).toBe("run-completed");
	});

	it("reports no latest event for a run nothing was appended to", async () => {
		const store = await openRunEventStore(":memory:");

		expect(store.latestEvent("run-1")).toBeUndefined();
	});

	it("lists the run id of every run holding at least one event", async () => {
		const store = await openRunEventStore(":memory:");
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

		expect(store.runIds().toSorted()).toEqual(["run-1", "run-2"]);
	});
});

describe(runEventRecorderFor.name, () => {
	it("appends every recorded call to the store under the fixed run id", async () => {
		const store = await openRunEventStore(":memory:");
		const recorder = runEventRecorderFor(store, "run-1");

		recorder.record("stage-started", "shape", 0, 0);
		recorder.record("stage-completed", "shape", 1, 1000);

		expect(
			store
				.eventsSince("run-1", 0)
				.map(({ kind, stage, spentUsd, elapsedMs }) => ({
					kind,
					stage,
					spentUsd,
					elapsedMs,
				})),
		).toEqual([
			{ kind: "stage-started", stage: "shape", spentUsd: 0, elapsedMs: 0 },
			{ kind: "stage-completed", stage: "shape", spentUsd: 1, elapsedMs: 1000 },
		]);
	});
});

describe(isTerminalRunEventKind.name, () => {
	it.each([
		["run-completed", true],
		["run-interrupted", true],
		["stage-started", false],
		["stage-completed", false],
		["turn-completed", false],
	] as const)("reads %s as terminal: %s", (kind, expected) => {
		expect(isTerminalRunEventKind(kind)).toBe(expected);
	});
});
