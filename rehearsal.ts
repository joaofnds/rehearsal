#!/usr/bin/env bun
import { CONTROL_DIR, REQUIRED_BUN_VERSION } from "./src/benchmark/config";
import { loadPipeline } from "./src/benchmark/pipeline";
import { benchmarkRunsDirectory } from "./src/benchmark/run-layout";
import { runCompare } from "./src/cli/compare-command";
import {
	executeReplay,
	resolveRunDirectory,
	runReplayCommand,
} from "./src/cli/replay-command";
import { executeRun, runRunCommand } from "./src/cli/run-command";
import type { CommandDefinition, CommandLine } from "./src/cli/commands";
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

function main(): Promise<number> {
	if (Bun.version !== REQUIRED_BUN_VERSION) {
		throw new Error(
			`Use Bun ${REQUIRED_BUN_VERSION}; current version is ${Bun.version}`,
		);
	}

	const [name, ...args] = Bun.argv.slice(2);
	if (name === "--help") {
		processOutput.stdout(topLevelHelp());

		return Promise.resolve(EXIT_CODES.completed);
	}
	if (name === undefined) {
		processOutput.stderr(topLevelHelp());

		return Promise.resolve(EXIT_CODES.usageError);
	}

	const command = findCommand(name);
	const commandLine = parseCommandLine(command, args);
	if (commandLine.helpRequested) {
		processOutput.stdout(commandHelp(command));

		return Promise.resolve(EXIT_CODES.completed);
	}

	return dispatch(command.name, commandLine);
}

async function dispatch(
	name: string,
	commandLine: CommandLine,
): Promise<number> {
	switch (name) {
		case "compare": {
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
		case "replay": {
			await runReplayCommand(
				{
					args: commandLine.flags,
					json: commandLine.json,
					stdinIsTerminal: process.stdin.isTTY,
				},
				{ output: processOutput, resolveRunDirectory, execute: executeReplay },
			);

			return EXIT_CODES.completed;
		}
		case "run": {
			await runRunCommand(
				{
					args: commandLine.flags,
					json: commandLine.json,
					stdinIsTerminal: process.stdin.isTTY,
				},
				{ output: processOutput, loadPipeline, execute: executeRun },
			);

			return EXIT_CODES.completed;
		}
		default: {
			throw new Error(`Command ${name} is declared but not wired up`);
		}
	}
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
