import { describe, expect, it } from "bun:test";
import { chmod, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { CONTROL_DIR } from "./config";
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
	it("records a control-relative settings identity", async () => {
		const directory = await mkdtemp(join(CONTROL_DIR, ".rehearsal-settings-"));
		testResources.track(directory);
		const path = join(directory, "settings.json");
		await Bun.write(path, "{}");

		const loaded = await loadStageSettings(path);

		expect(loaded.hashed.path).toBe(relative(CONTROL_DIR, path));
	});

	it("reads, hashes, and re-serializes the declared file's bytes", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-settings-"));
		testResources.track(directory);
		const path = join(directory, "settings.json");
		const content = { permissions: { deny: ["Bash(rm *)"] } };
		await Bun.write(path, JSON.stringify(content));

		const loaded = await loadStageSettings(path);

		expect(JSON.parse(loaded.json)).toEqual(content);
		expect(loaded.hashed.sha256).toBe(
			new Bun.CryptoHasher("sha256").update(loaded.json).digest("hex"),
		);
	});

	it("hashes the same digest for two files that differ only in whitespace", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-settings-"));
		testResources.track(directory);
		const compact = join(directory, "compact.json");
		const spaced = join(directory, "spaced.json");
		const content = { permissions: { deny: ["Bash(rm *)"] } };
		await Bun.write(compact, JSON.stringify(content));
		await Bun.write(spaced, JSON.stringify(content, null, 2));

		const [loadedCompact, loadedSpaced] = await Promise.all([
			loadStageSettings(compact),
			loadStageSettings(spaced),
		]);

		expect(loadedSpaced.hashed.sha256).toBe(loadedCompact.hashed.sha256);
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

	it("refuses a path with no file, naming it", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-settings-"));
		testResources.track(directory);
		const path = join(directory, "missing.json");

		expect(loadStageSettings(path)).rejects.toThrow(
			new RegExp(`No stage settings file at ${path}.*settingsFile`, "u"),
		);
	});

	it("translates an unreadable file into a settings refusal", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-settings-"));
		testResources.track(directory);
		const path = join(directory, "settings.json");
		await Bun.write(path, "{}");
		await chmod(path, 0);

		try {
			let failure: unknown;
			try {
				await loadStageSettings(path);
			} catch (error) {
				failure = error;
			}
			expect(failure).toHaveProperty(
				"message",
				expect.stringMatching(`Cannot read stage settings file ${path}`),
			);
		} finally {
			await chmod(path, 0o600);
		}
	});

	it("translates an invalid filesystem path into a settings refusal", () => {
		const path = `settings${String.fromCodePoint(0)}.json`;

		expect(loadStageSettings(path)).rejects.toThrow(
			/Cannot read stage settings file/u,
		);
	});
});
