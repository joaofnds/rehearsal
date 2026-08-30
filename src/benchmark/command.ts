import { COMMAND_TIMEOUT_MS } from "./config";

interface CommandOptions {
	readonly env?: Record<string, string> | undefined;
	readonly input?: string | undefined;
	readonly timeoutMs?: number | undefined;
}

export class CommandError extends Error {
	public override name = "CommandError";

	public constructor(
		public readonly command: readonly string[],
		public readonly exitCode: number,
		public readonly stdout: string,
		public readonly stderr: string,
	) {
		super(
			`Command failed (${exitCode}): ${command.join(" ")}\n${stderr || stdout}`,
		);
	}
}

const activeProcesses = new Set<ReturnType<typeof Bun.spawn>>();

function killProcessGroup(child: ReturnType<typeof Bun.spawn>): void {
	try {
		process.kill(-child.pid, "SIGKILL");
	} catch {
		child.kill("SIGKILL");
	}
}

export async function runCommand(
	command: readonly string[],
	cwd: string,
	options: CommandOptions = {},
): Promise<string> {
	const child = Bun.spawn([...command], {
		cwd,
		env: { ...Bun.env, ...options.env },
		stdin: options.input === undefined ? "ignore" : new Blob([options.input]),
		stdout: "pipe",
		stderr: "pipe",
		detached: true,
	});
	activeProcesses.add(child);
	const timeout = setTimeout(
		() => killProcessGroup(child),
		options.timeoutMs ?? COMMAND_TIMEOUT_MS,
	);

	try {
		const [exitCode, stdout, stderr] = await Promise.all([
			child.exited,
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
		]);

		if (exitCode !== 0) {
			throw new CommandError(command, exitCode, stdout, stderr);
		}

		return stdout;
	} finally {
		clearTimeout(timeout);
		activeProcesses.delete(child);
	}
}

export async function killActiveCommands(): Promise<void> {
	const children = [...activeProcesses];
	for (const child of children) {
		killProcessGroup(child);
	}

	await Promise.allSettled(children.map((child) => child.exited));
}
