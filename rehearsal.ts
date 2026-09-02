#!/usr/bin/env bun
import { CONTROL_DIR, REQUIRED_BUN_VERSION } from "./src/benchmark/config";
import { benchmarkRunsDirectory } from "./src/benchmark/run-layout";
import { runCompare } from "./src/cli/compare-command";
import type { CommandDefinition } from "./src/cli/commands";
import {
	COMMANDS,
	commandHelp,
	parseCommandLine,
	topLevelHelp,
	UsageError,
} from "./src/cli/commands";
import { EXIT_CODES, exitCodeFor } from "./src/cli/exit-codes";
import { processOutput } from "./src/cli/output";

function findCommand(name: string): CommandDefinition {
	const command = COMMANDS.find((candidate) => candidate.name === name);
	if (command === undefined) {
		throw new UsageError(`Unknown command ${name}`);
	}

	return command;
}

async function main(): Promise<number> {
	if (Bun.version !== REQUIRED_BUN_VERSION) {
		throw new Error(
			`Use Bun ${REQUIRED_BUN_VERSION}; current version is ${Bun.version}`,
		);
	}

	const [name, ...args] = Bun.argv.slice(2);
	if (name === "--help") {
		processOutput.stdout(topLevelHelp());

		return EXIT_CODES.completed;
	}
	if (name === undefined) {
		processOutput.stderr(topLevelHelp());

		return EXIT_CODES.usageError;
	}

	const command = findCommand(name);
	const commandLine = parseCommandLine(command, args);
	if (commandLine.helpRequested) {
		processOutput.stdout(commandHelp(command));

		return EXIT_CODES.completed;
	}

	if (command.name === "compare") {
		await runCompare(
			{
				manifestPath: commandLine.argument,
				runsDirectory: benchmarkRunsDirectory(CONTROL_DIR),
				json: commandLine.json,
			},
			processOutput,
		);

		return EXIT_CODES.completed;
	}

	throw new Error(`Command ${command.name} is not wired up yet`);
}

if (import.meta.main) {
	try {
		process.exit(await main());
	} catch (error) {
		const failure = error instanceof Error ? error : new Error(String(error));
		processOutput.stderr(`${failure.message}\n`);
		process.exit(exitCodeFor(failure));
	}
}
