import { describe, expect, it } from "bun:test";
import { chmod } from "node:fs/promises";
import { join } from "node:path";
import { pathExists, statIfExists } from "#benchmark/file-presence";
import { TestResources } from "#benchmark/test-support";
import { failureOf } from "#cli/cli-test-support";

const resources = TestResources.forEachTest();

describe(statIfExists.name, () => {
	it("reports a file that is there", async () => {
		const directory = await resources.createControlDirectory();
		await Bun.write(join(directory, "present.md"), "here\n");

		const stats = await statIfExists(join(directory, "present.md"));

		expect(stats?.isFile()).toBe(true);
	});

	it("reports absence for a path that is not there", async () => {
		expect(await statIfExists("/no/such/path/at/all")).toBeUndefined();
	});

	/**
	 * A permission failure is not absence. Reading it as absence would refuse an
	 * unreadable corpus source for the wrong reason, and would let a checkpoint
	 * record partial state as truth.
	 */
	it("raises a failure that is not absence rather than reporting absence", async () => {
		const directory = await resources.createControlDirectory();
		await Bun.write(join(directory, "locked/inside.md"), "hidden\n");
		await chmod(join(directory, "locked"), 0o000);

		const failure = await failureOf(
			statIfExists(join(directory, "locked/inside.md")),
		);

		await chmod(join(directory, "locked"), 0o700);
		expect(failure.message).toContain("EACCES");
	});
});

describe(pathExists.name, () => {
	it("answers whether the path is there", async () => {
		const directory = await resources.createControlDirectory();
		await Bun.write(join(directory, "present.md"), "here\n");

		expect(await pathExists(join(directory, "present.md"))).toBe(true);
		expect(await pathExists(join(directory, "absent.md"))).toBe(false);
	});
});
