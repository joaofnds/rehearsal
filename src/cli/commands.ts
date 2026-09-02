import { DEFAULT_PIPELINE_PATH } from "#benchmark/config";
import type { CommandFailure } from "#cli/exit-codes";
import { EXIT_CODES } from "#cli/exit-codes";

export interface FlagDefinition {
	readonly name: string;
	readonly kind: "value" | "switch";
	readonly envVar?: string | undefined;
	readonly defaultValue?: string | undefined;
	readonly help: string;
}

export interface CommandDefinition {
	readonly name: string;
	readonly summary: string;
	readonly argument?: string | undefined;
	readonly flags: readonly FlagDefinition[];
}

function flagLine(flag: FlagDefinition): string {
	const qualifiers = [
		flag.defaultValue === undefined
			? undefined
			: `default ${flag.defaultValue}`,
		flag.envVar === undefined ? undefined : `env ${flag.envVar}`,
	].filter((qualifier) => qualifier !== undefined);
	const suffix = qualifiers.length === 0 ? "" : ` (${qualifiers.join(", ")})`;

	return `  ${flag.name}${flag.kind === "value" ? " <value>" : ""}: ${flag.help}${suffix}`;
}

export function commandHelp(command: CommandDefinition): string {
	const usage = [
		"rehearsal",
		command.name,
		command.argument === undefined ? undefined : `<${command.argument}>`,
		"[flags]",
	]
		.filter((part) => part !== undefined)
		.join(" ");

	return [
		`Usage: ${usage}`,
		"",
		command.summary,
		"",
		"Flags:",
		...command.flags.map((flag) => flagLine(flag)),
		"",
	].join("\n");
}

const sessionFlags: readonly FlagDefinition[] = [
	{
		name: "--model",
		kind: "value",
		envVar: "BENCHMARK_MODEL",
		help: "Model every workflow session and the Product Owner use",
	},
	{
		name: "--effort",
		kind: "value",
		envVar: "BENCHMARK_EFFORT",
		help: "Reasoning effort for the workflow: low, medium, high, xhigh, or max",
	},
	{
		name: "--judge-model",
		kind: "value",
		envVar: "BENCHMARK_JUDGE_MODEL",
		defaultValue: "opus, or sonnet when the workflow model is opus",
		help: "Model the stage and final Judges use",
	},
	{
		name: "--judge-effort",
		kind: "value",
		envVar: "BENCHMARK_JUDGE_EFFORT",
		defaultValue: "the workflow effort",
		help: "Reasoning effort for the Judges",
	},
	{
		name: "--session-budget-usd",
		kind: "value",
		envVar: "BENCHMARK_SESSION_BUDGET_USD",
		help: "Spend limit enforced for each session",
	},
];

const confirmationFlags: readonly FlagDefinition[] = [
	{
		name: "--confirm",
		kind: "switch",
		help: "Run a confirmation group instead of one debug rep",
	},
	{
		name: "--reps",
		kind: "value",
		defaultValue: "5",
		help: "Reps in the confirmation group; at least 2, only with --confirm",
	},
	{
		name: "--yes",
		kind: "switch",
		help: "Approve the projected cost without a prompt, only with --confirm",
	},
];

const jsonFlag: FlagDefinition = {
	name: "--json",
	kind: "switch",
	help: "Print the record this command wrote on stdout instead of its path",
};

export const COMMANDS: readonly CommandDefinition[] = [
	{
		name: "run",
		summary: "Run the pipeline against the target repository and grade it",
		flags: [
			{
				name: "--target",
				kind: "value",
				envVar: "BENCHMARK_TARGET_DIR",
				help: "Target repository the pipeline runs in",
			},
			...sessionFlags,
			{
				name: "--pipeline",
				kind: "value",
				envVar: "BENCHMARK_PIPELINE",
				defaultValue: DEFAULT_PIPELINE_PATH,
				help: "Pipeline definition the run executes",
			},
			...confirmationFlags,
			jsonFlag,
		],
	},
	{
		name: "replay",
		summary: "Replay one stage of a recorded run against the current corpus",
		flags: [
			{
				name: "--run",
				kind: "value",
				help: "Name of the recorded run to replay from",
			},
			{
				name: "--stage",
				kind: "value",
				help: "Stage to replay from that run's checkpoint",
			},
			...sessionFlags,
			...confirmationFlags,
			jsonFlag,
		],
	},
	{
		name: "compare",
		summary: "Report over completed confirmation evidence; runs no session",
		argument: "comparison-manifest.json",
		flags: [jsonFlag],
	},
];

export function topLevelHelp(): string {
	return [
		"Usage: rehearsal <command> [flags]",
		"",
		"Commands:",
		...COMMANDS.map(
			(command) => `  ${command.name.padEnd(9)}${command.summary}`,
		),
		"",
		"Exit codes:",
		"  0  the command completed and wrote its record, whatever the grade",
		"  1  execution failure",
		"  2  usage error",
		"  3  refused precondition",
		"",
		"Run `rehearsal <command> --help` for a command's flags.",
		"",
	].join("\n");
}

export interface CommandLine {
	readonly helpRequested: boolean;
	readonly argument: string | undefined;
	readonly json: boolean;
	readonly flags: readonly string[];
}

export class UsageError extends Error implements CommandFailure {
	public readonly exitCode = EXIT_CODES.usageError;

	public constructor(message: string) {
		super(message);
		this.name = "UsageError";
	}
}

const HELP_FLAG = "--help";
const JSON_FLAG = "--json";

function takesValue(command: CommandDefinition, name: string): boolean {
	return command.flags.some(
		(flag) => flag.name === name && flag.kind === "value",
	);
}

function declares(command: CommandDefinition, name: string): boolean {
	return command.flags.some((flag) => flag.name === name);
}

export function parseCommandLine(
	command: CommandDefinition,
	args: readonly string[],
): CommandLine {
	if (args.includes(HELP_FLAG)) {
		return {
			helpRequested: true,
			argument: undefined,
			json: false,
			flags: [...args],
		};
	}

	let argument: string | undefined;
	let json = false;
	const flags: string[] = [];

	for (let index = 0; index < args.length;) {
		const token = args[index];
		if (token === undefined) {
			break;
		}
		if (!token.startsWith("--")) {
			if (command.argument === undefined || argument !== undefined) {
				throw new UsageError(
					`Unexpected argument ${token} for rehearsal ${command.name}`,
				);
			}
			argument = token;
			index += 1;
			continue;
		}
		if (!declares(command, token)) {
			throw new UsageError(
				`Unknown flag ${token} for rehearsal ${command.name}`,
			);
		}
		if (token === JSON_FLAG) {
			json = true;
			index += 1;
			continue;
		}

		flags.push(token);
		if (takesValue(command, token)) {
			const value = args[index + 1];
			if (value === undefined) {
				throw new UsageError(
					`Flag ${token} needs a value for rehearsal ${command.name}`,
				);
			}
			flags.push(value);
			index += 2;
			continue;
		}

		index += 1;
	}

	return { helpRequested: false, argument, json, flags };
}
