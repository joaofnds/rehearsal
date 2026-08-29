import { COMMAND_TIMEOUT_MS } from "./config";

interface CommandOptions {
	readonly env?: Record<string, string>;
	readonly input?: string;
	readonly timeoutMs?: number;
}

export class CommandError extends Error {
	constructor(
		readonly command: readonly string[],
		readonly exitCode: number,
		readonly stdout: string,
		readonly stderr: string,
	) {
		super(
			`Command failed (${exitCode}): ${command.join(" ")}\n${stderr || stdout}`,
		);
	}
}

const activeProcesses = new Set<ReturnType<typeof Bun.spawn>>();

export async function runCommand(
	command: readonly string[],
	cwd: string,
	options: CommandOptions = {},
): Promise<string> {
	const process = Bun.spawn([...command], {
		cwd,
		env: { ...Bun.env, ...options.env },
		stdin: options.input === undefined ? "ignore" : new Blob([options.input]),
		stdout: "pipe",
		stderr: "pipe",
		timeout: options.timeoutMs ?? COMMAND_TIMEOUT_MS,
		killSignal: "SIGKILL",
		detached: true,
	});
	activeProcesses.add(process);

	try {
		const [exitCode, stdout, stderr] = await Promise.all([
			process.exited,
			new Response(process.stdout).text(),
			new Response(process.stderr).text(),
		]);

		if (exitCode !== 0) {
			throw new CommandError(command, exitCode, stdout, stderr);
		}

		return stdout;
	} finally {
		activeProcesses.delete(process);
	}
}

export async function killActiveCommands() {
	const children = [...activeProcesses];
	for (const child of children) {
		try {
			process.kill(-child.pid, "SIGKILL");
		} catch {
			child.kill("SIGKILL");
		}
	}

	await Promise.allSettled(children.map((child) => child.exited));
}
