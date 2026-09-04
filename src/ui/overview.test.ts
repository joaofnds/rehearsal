import { describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { RecordedRunsFixture } from "#benchmark/run-records-test-support";
import { benchmarkRunsDirectory } from "#benchmark/run-layout";
import { TestResources } from "#benchmark/test-support";
import { readOverview } from "#ui/overview";

async function emptyRunsDirectory(
	resources: Readonly<TestResources>,
): Promise<string> {
	return benchmarkRunsDirectory(await resources.createControlDirectory());
}

describe("readOverview", () => {
	it("reports every record kind when nothing has been recorded", async () => {
		const resources = TestResources.forEachTest();
		const runsDirectory = await emptyRunsDirectory(resources);

		const overview = await readOverview(runsDirectory);

		expect(overview.sections.map((section) => section.kind)).toEqual([
			"cases",
			"runs",
			"checkpoints",
			"attempts",
			"groups",
			"comparisons",
		]);
	});

	it("carries every recorded attempt through to its section", async () => {
		const resources = TestResources.forEachTest();
		const runsDirectory = await emptyRunsDirectory(resources);
		await new RecordedRunsFixture(runsDirectory).write();

		const overview = await readOverview(runsDirectory);
		const attempts = overview.sections.find(
			(section) => section.kind === "attempts",
		);

		expect(attempts?.entries.length).toBeGreaterThan(0);
	});

	it("reports a record directory holding no record as unreadable, never as an entry", async () => {
		const resources = TestResources.forEachTest();
		const runsDirectory = await emptyRunsDirectory(resources);
		await mkdir(join(runsDirectory, "sessions", "smoke", "empty"), {
			recursive: true,
		});

		const overview = await readOverview(runsDirectory);
		const attempts = overview.sections.find(
			(section) => section.kind === "attempts",
		);

		expect(attempts?.entries).toEqual([]);
		expect(attempts?.unreadable).toHaveLength(1);
	});
});
