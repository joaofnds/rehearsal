import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { TOML } from "bun";
import { assertPinnedBunVersion } from "./bun-pin";
import { PROJECT_ROOT } from "./test-support";

describe("assertPinnedBunVersion", () => {
	it("returns when the running version matches the required one", () => {
		expect(() => {
			assertPinnedBunVersion("1.2.3", "1.2.3");
		}).not.toThrow();
	});

	it("throws naming the required and the running version", () => {
		expect(() => {
			assertPinnedBunVersion("9.9.9", "1.2.3");
		}).toThrow("Use Bun 9.9.9; current version is 1.2.3");
	});
});

describe("bun-pin-guard", () => {
	it("stops the process and names both versions when the version is wrong", async () => {
		const child = Bun.spawn(
			[
				process.execPath,
				join(PROJECT_ROOT, "src/benchmark/bun-pin-guard.ts"),
				"9.9.9",
			],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const [exitCode, stderr] = await Promise.all([
			child.exited,
			new Response(child.stderr).text(),
		]);

		expect(exitCode).toBe(1);
		expect(stderr).toContain("Use Bun 9.9.9");
		expect(stderr).toContain(Bun.version);
	});
});

describe("bunfig.toml", () => {
	it("preloads the guard into every test process", async () => {
		const bunfig = TOML.parse(
			await Bun.file(join(PROJECT_ROOT, "bunfig.toml")).text(),
		);

		expect(bunfig).toMatchObject({
			test: { preload: ["./src/benchmark/bun-pin-guard.ts"] },
		});
	});
});
