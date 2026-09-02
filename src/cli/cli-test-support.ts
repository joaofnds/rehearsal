import type { CommandOutput } from "#cli/output";

export interface OutputRecorder {
	readonly output: CommandOutput;
	readonly stdout: readonly string[];
	readonly stderr: readonly string[];
}

export function recordOutput(): OutputRecorder {
	const stdout: string[] = [];
	const stderr: string[] = [];

	return {
		stdout,
		stderr,
		output: {
			stdout: (text) => {
				stdout.push(text);
			},
			stderr: (text) => {
				stderr.push(text);
			},
		},
	};
}

export async function failureOf(work: Promise<void>): Promise<Error> {
	try {
		await work;
	} catch (error) {
		return error instanceof Error ? error : new Error(String(error));
	}

	throw new Error("Expected the command to fail");
}
