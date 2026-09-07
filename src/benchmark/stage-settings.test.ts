import { describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadStageSettings, stageSettingsSchema } from "./stage-settings";
import { TestResources } from "./test-support";

const testResources = TestResources.forEachTest();

describe("stageSettingsSchema", () => {
	it("accepts a permissions deny list and feature switches", () => {
		const result = stageSettingsSchema.safeParse({
			permissions: { deny: ["Bash(rm *)"] },
			disableAllHooks: true,
		});

		expect(result.success).toBe(true);
	});

	it("accepts an empty object", () => {
		expect(stageSettingsSchema.safeParse({}).success).toBe(true);
	});

	it("rejects a hooks key", () => {
		const result = stageSettingsSchema.safeParse({ hooks: {} });

		expect(result.success).toBe(false);
	});

	it("rejects a key it does not declare", () => {
		const result = stageSettingsSchema.safeParse({ statusLine: "custom" });

		expect(result.success).toBe(false);
	});
});

describe(loadStageSettings.name, () => {
	it("reads, hashes, and re-serializes the declared file's bytes", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-settings-"));
		testResources.track(directory);
		const path = join(directory, "settings.json");
		const content = { permissions: { deny: ["Bash(rm *)"] } };
		await Bun.write(path, JSON.stringify(content));

		const loaded = await loadStageSettings(path);

		expect(JSON.parse(loaded.json)).toEqual(content);
		expect(loaded.hashed.sha256).toBe(
			new Bun.CryptoHasher("sha256")
				.update(await Bun.file(path).bytes())
				.digest("hex"),
		);
	});

	it("refuses a settings file that fails the schema", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-settings-"));
		testResources.track(directory);
		const path = join(directory, "settings.json");
		await Bun.write(path, JSON.stringify({ hooks: {} }));

		expect(loadStageSettings(path)).rejects.toThrow(/invalid/u);
	});

	it("refuses a settings file that is not valid JSON", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-settings-"));
		testResources.track(directory);
		const path = join(directory, "settings.json");
		await Bun.write(path, "not json");

		expect(loadStageSettings(path)).rejects.toThrow(/not valid JSON/u);
	});
});
