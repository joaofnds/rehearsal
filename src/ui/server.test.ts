import { describe, expect, it } from "bun:test";
import { RecordedRunsFixture } from "#benchmark/run-records-test-support";
import { benchmarkRunsDirectory } from "#benchmark/run-layout";
import { TestResources } from "#benchmark/test-support";
import { handleUrl } from "#ui/server";

async function fixtureRunsDirectory(
	resources: Readonly<TestResources>,
): Promise<{ runsDirectory: string; fixture: RecordedRunsFixture }> {
	const runsDirectory = benchmarkRunsDirectory(
		await resources.createControlDirectory(),
	);
	const fixture = new RecordedRunsFixture(runsDirectory);
	await fixture.write();

	return { runsDirectory, fixture };
}

describe("handleUrl", () => {
	it("serves the overview as HTML at the root", async () => {
		const resources = TestResources.forEachTest();
		const { runsDirectory } = await fixtureRunsDirectory(resources);

		const response = await handleUrl("http://localhost/", runsDirectory);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
	});

	it("serves one record's own bytes as JSON", async () => {
		const resources = TestResources.forEachTest();
		const { runsDirectory, fixture } = await fixtureRunsDirectory(resources);
		const id = `attempt:session:${fixture.sessionAttempt.caseId}/${fixture.sessionAttempt.uuid}`;

		const response = await handleUrl(
			`http://localhost/record/${encodeURIComponent(id)}`,
			runsDirectory,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ caseId: "smoke" });
	});

	it("refuses a record id whose segment escapes the runs directory", async () => {
		const resources = TestResources.forEachTest();
		const { runsDirectory } = await fixtureRunsDirectory(resources);

		const response = await handleUrl(
			`http://localhost/record/${encodeURIComponent("run:../../../etc/passwd")}`,
			runsDirectory,
		);

		expect(response.status).toBe(400);
	});

	it("serves nothing for a traversal path a client left unencoded", async () => {
		const resources = TestResources.forEachTest();
		const { runsDirectory } = await fixtureRunsDirectory(resources);

		const response = await handleUrl(
			"http://localhost/record/run:../../../etc/passwd",
			runsDirectory,
		);

		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(response.headers.get("content-type")).not.toContain("text/html");
	});

	it("answers an unknown path with 404", async () => {
		const resources = TestResources.forEachTest();
		const { runsDirectory } = await fixtureRunsDirectory(resources);

		const response = await handleUrl(
			"http://localhost/nothing-here",
			runsDirectory,
		);

		expect(response.status).toBe(404);
	});
});
