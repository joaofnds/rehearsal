import { describe, expect, it } from "bun:test";
import type { CommandDefinition } from "#cli/commands";
import {
	asUsageError,
	COMMANDS,
	commandHelp,
	parseCommandLine,
	topLevelHelp,
	UsageError,
} from "#cli/commands";

const exampleCommand: CommandDefinition = {
	name: "example",
	summary: "Demonstrate the flag table",
	flags: [
		{
			name: "--model",
			kind: "value",
			envVar: "BENCHMARK_MODEL",
			defaultValue: "sonnet",
			help: "Model every workflow session uses",
		},
		{
			name: "--yes",
			kind: "switch",
			help: "Approve the projected cost without a prompt",
		},
	],
};

describe(commandHelp.name, () => {
	it("names every declared flag with its default and environment variable", () => {
		const help = commandHelp(exampleCommand);

		expect(help).toContain("--model");
		expect(help).toContain("BENCHMARK_MODEL");
		expect(help).toContain("sonnet");
		expect(help).toContain("Model every workflow session uses");
		expect(help).toContain("--yes");
		expect(help).toContain("Approve the projected cost without a prompt");
	});
});

describe(topLevelHelp.name, () => {
	it("lists every command with its summary and the exit-code meanings", () => {
		const help = topLevelHelp();

		for (const command of COMMANDS) {
			expect(help).toContain(command.name);
			expect(help).toContain(command.summary);
		}
		expect(help).toContain("0  the command completed and wrote its record");
		expect(help).toContain("1  execution failure");
		expect(help).toContain("2  usage error");
		expect(help).toContain("3  refused precondition");
	});
});

describe("declared commands", () => {
	it("declares run, replay, and compare", () => {
		expect(COMMANDS.map((command) => command.name)).toEqual([
			"run",
			"replay",
			"compare",
		]);
	});

	it.each(["run", "replay", "compare"])(
		"names every flag %s declares in its own help",
		(name) => {
			const command = COMMANDS.find((candidate) => candidate.name === name);
			const help = commandHelp(command ?? exampleCommand);

			expect(command?.flags.length ?? 0).toBeGreaterThan(0);
			for (const flag of command?.flags ?? []) {
				expect(help).toContain(flag.name);
				expect(help).toContain(flag.help);
				if (flag.envVar !== undefined) {
					expect(help).toContain(flag.envVar);
				}
				if (flag.defaultValue !== undefined) {
					expect(help).toContain(flag.defaultValue);
				}
			}
		},
	);

	it("declares the run flags the card names", () => {
		const run = COMMANDS.find((command) => command.name === "run");

		expect(run?.flags.map((flag) => flag.name)).toEqual([
			"--target",
			"--model",
			"--effort",
			"--judge-model",
			"--judge-effort",
			"--session-budget-usd",
			"--pipeline",
			"--confirm",
			"--reps",
			"--yes",
			"--json",
		]);
	});
});

describe(parseCommandLine.name, () => {
	it("names the unknown flag it refuses", () => {
		expect(() => parseCommandLine(exampleCommand, ["--bogus"])).toThrow(
			"Unknown flag --bogus for rehearsal example",
		);
	});

	it("refuses a declared flag standing where a value belongs", () => {
		expect(() =>
			parseCommandLine(exampleCommand, ["--model", "--yes"]),
		).toThrow("Flag --model needs a value for rehearsal example");
	});

	it("refuses a token that is not a flag", () => {
		expect(() => parseCommandLine(exampleCommand, ["oops"])).toThrow(
			"Unexpected argument oops for rehearsal example",
		);
	});

	it("refuses a short flag as a usage error rather than a positional argument", () => {
		const compare = COMMANDS.find((command) => command.name === "compare");

		expect(() => parseCommandLine(compare ?? exampleCommand, ["-h"])).toThrow(
			"Unknown flag -h for rehearsal compare",
		);
	});

	it("refuses a second positional argument", () => {
		const compare = COMMANDS.find((command) => command.name === "compare");

		expect(() =>
			parseCommandLine(compare ?? exampleCommand, ["one.json", "two.json"]),
		).toThrow("Unexpected argument two.json for rehearsal compare");
	});

	it("reports the help request, the argument, and the remaining flags", () => {
		const compare = COMMANDS.find((command) => command.name === "compare");

		expect(
			parseCommandLine(compare ?? exampleCommand, ["manifest.json", "--json"]),
		).toEqual({
			helpRequested: false,
			argument: "manifest.json",
			json: true,
			flags: [],
		});
	});

	it("reports a help request before any other flag is judged", () => {
		expect(parseCommandLine(exampleCommand, ["--help", "--bogus"])).toEqual({
			helpRequested: true,
			argument: undefined,
			json: false,
			flags: ["--help", "--bogus"],
		});
	});

	it("passes declared flags through in order for the configuration parser", () => {
		expect(
			parseCommandLine(exampleCommand, ["--model", "opus", "--yes"]),
		).toEqual({
			helpRequested: false,
			argument: undefined,
			json: false,
			flags: ["--model", "opus", "--yes"],
		});
	});
});

describe(asUsageError.name, () => {
	it("re-raises a configuration rejection as a usage error", () => {
		expect(() =>
			asUsageError(() => {
				throw new Error("Provide --target or BENCHMARK_TARGET_DIR");
			}),
		).toThrow(new UsageError("Provide --target or BENCHMARK_TARGET_DIR"));
	});

	it("returns the parsed configuration when parsing succeeds", () => {
		expect(asUsageError(() => "parsed")).toBe("parsed");
	});
});
