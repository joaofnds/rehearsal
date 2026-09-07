import { describe, expect, it } from "bun:test";
import { CommandError } from "./command";
import { PipelineDefinitionError } from "./pipeline";
import { StageSettingsError } from "./stage-settings";
import {
	assertPipelinePreflight,
	asRefusedPrecondition,
	defaultModelProbe,
	defaultProbeModel,
	probeModelAvailable,
} from "./preflight";
import { RefusedPreconditionError } from "./exit-codes";

interface FakeEnvelope {
	readonly session_id: string;
	readonly is_error: boolean;
	readonly api_error_status?: number;
	readonly result?: string;
}

function fakeProbe(envelope: FakeEnvelope): () => Promise<string> {
	return () => Promise.resolve(JSON.stringify(envelope));
}

describe(probeModelAvailable.name, () => {
	it("returns cleanly when the provider accepts the model", async () => {
		await probeModelAvailable(
			"sonnet",
			fakeProbe({ session_id: "session-1", is_error: false }),
		);
	});

	it("refuses naming the model and the fix when the provider rejects it", () => {
		const invoke = fakeProbe({
			session_id: "session-1",
			is_error: true,
			api_error_status: 404,
			result:
				"There's an issue with the selected model (definitely-not-a-real-model-xyz). It may not exist or you may not have access to it.",
		});

		const failure = probeModelAvailable(
			"definitely-not-a-real-model-xyz",
			invoke,
		);

		expect(failure).rejects.toBeInstanceOf(RefusedPreconditionError);
		expect(failure).rejects.toThrow("definitely-not-a-real-model-xyz");
		expect(failure).rejects.toThrow(/re-declar|entitle/u);
	});

	it("propagates a malformed probe response instead of calling it unavailable", () => {
		const failure = probeModelAvailable("sonnet", () =>
			Promise.resolve("not valid json"),
		);

		expect(failure).rejects.not.toBeInstanceOf(RefusedPreconditionError);
	});
});

describe(defaultModelProbe.name, () => {
	it("resolves with the child process's stdout on a clean exit", () => {
		const probe = defaultModelProbe("sonnet", (_command, _cwd, _options) =>
			Promise.resolve('{"session_id":"session-1","is_error":false}'),
		);

		expect(probe()).resolves.toBe(
			'{"session_id":"session-1","is_error":false}',
		);
	});

	it("resolves with the failed child process's stdout instead of throwing", () => {
		const rejectedStdout =
			'{"session_id":"session-1","is_error":true,"result":"model rejected"}';
		const probe = defaultModelProbe("bad-model", () =>
			Promise.reject(new CommandError(["claude"], 1, rejectedStdout, "")),
		);

		expect(probe()).resolves.toBe(rejectedStdout);
	});

	it("rethrows a failure that carries no stdout to read as an envelope", () => {
		const probe = defaultModelProbe("sonnet", () =>
			Promise.reject(new Error("spawn ENOENT")),
		);

		expect(probe()).rejects.toThrow("spawn ENOENT");
	});
});

describe(defaultProbeModel.name, () => {
	it("resolves when the provider accepts the model", async () => {
		await defaultProbeModel("sonnet", () =>
			Promise.resolve('{"session_id":"s","is_error":false}'),
		);
	});

	it("refuses naming the model when the provider rejects it", () => {
		const probe = defaultProbeModel("bad-model", () =>
			Promise.reject(
				new CommandError(
					["claude"],
					1,
					'{"session_id":"s","is_error":true,"result":"unknown model"}',
					"",
				),
			),
		);

		expect(probe).rejects.toBeInstanceOf(RefusedPreconditionError);
		expect(probe).rejects.toThrow("bad-model");
	});
});

describe(assertPipelinePreflight.name, () => {
	const readySource = {
		root: "/target",
		sha: "a".repeat(40),
		origin: undefined,
	};
	const passingSettings = {
		json: "{}",
		hashed: { path: "/settings.json", sha256: "b".repeat(64) },
	};
	const passingProbe = (): Promise<void> => Promise.resolve();

	function dependencies(
		overrides: Partial<Parameters<typeof assertPipelinePreflight>[1]> = {},
	): Parameters<typeof assertPipelinePreflight>[1] {
		return {
			assertControlReady: () => Promise.resolve("control-sha"),
			assertSourceReady: () => Promise.resolve(readySource),
			loadStageSettings: () => Promise.resolve(passingSettings),
			probeModel: passingProbe,
			...overrides,
		};
	}

	it("proceeds when every declared reference resolves", async () => {
		await assertPipelinePreflight(
			{
				sourceDir: "/target",
				settingsFilePath: "/settings.json",
				model: "sonnet",
			},
			dependencies(),
		);
	});

	it("halts naming the missing target before checking anything else", () => {
		const settingsCalls: string[] = [];
		const failure = assertPipelinePreflight(
			{
				sourceDir: "/missing",
				settingsFilePath: "/settings.json",
				model: "sonnet",
			},
			dependencies({
				assertSourceReady: () =>
					Promise.reject(new Error("Target must be the repository root")),
				loadStageSettings: () => {
					settingsCalls.push("called");

					return Promise.resolve(passingSettings);
				},
			}),
		);

		expect(failure).rejects.toBeInstanceOf(RefusedPreconditionError);
		expect(failure).rejects.toThrow("Target must be the repository root");
		expect(settingsCalls).toEqual([]);
	});

	it("propagates a git command failure instead of relabeling it a refused precondition", () => {
		const failure = assertPipelinePreflight(
			{
				sourceDir: "/target",
				settingsFilePath: "/settings.json",
				model: "sonnet",
			},
			dependencies({
				assertSourceReady: () =>
					Promise.reject(
						new CommandError(
							["git", "rev-parse"],
							128,
							"",
							"fatal: not a git repository",
						),
					),
			}),
		);

		expect(failure).rejects.toBeInstanceOf(CommandError);
	});

	it("halts naming the missing settings file before probing the model", () => {
		const probeCalls: string[] = [];
		const failure = assertPipelinePreflight(
			{
				sourceDir: "/target",
				settingsFilePath: "/missing.json",
				model: "sonnet",
			},
			dependencies({
				loadStageSettings: () =>
					Promise.reject(
						new StageSettingsError("No stage settings file at /missing.json"),
					),
				probeModel: (model) => {
					probeCalls.push(model);

					return passingProbe();
				},
			}),
		);

		expect(failure).rejects.toBeInstanceOf(RefusedPreconditionError);
		expect(failure).rejects.toThrow("/missing.json");
		expect(probeCalls).toEqual([]);
	});

	it("halts naming the model last, once every file reference resolved", () => {
		const failure = assertPipelinePreflight(
			{
				sourceDir: "/target",
				settingsFilePath: "/settings.json",
				model: "no-such-model",
			},
			dependencies({
				probeModel: (model) =>
					Promise.reject(
						new RefusedPreconditionError(`unknown model ${model}`),
					),
			}),
		);

		expect(failure).rejects.toBeInstanceOf(RefusedPreconditionError);
		expect(failure).rejects.toThrow("no-such-model");
	});
});

describe(asRefusedPrecondition.name, () => {
	it("returns the loaded value unchanged", () => {
		expect(asRefusedPrecondition(() => Promise.resolve(42))).resolves.toBe(42);
	});

	it.each([
		[
			"a missing pipeline file",
			() => new PipelineDefinitionError("no pipeline"),
		],
		[
			"a missing stage settings file",
			() => new StageSettingsError("no settings"),
		],
	])("wraps %s as a refused precondition", (_label, buildError) => {
		const failure = asRefusedPrecondition(() => Promise.reject(buildError()));

		expect(failure).rejects.toBeInstanceOf(RefusedPreconditionError);
	});

	it("passes through an error of another kind", () => {
		const failure = asRefusedPrecondition(() =>
			Promise.reject(new Error("something else broke")),
		);

		expect(failure).rejects.not.toBeInstanceOf(RefusedPreconditionError);
	});
});
