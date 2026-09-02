export interface CommandOutput {
	readonly stdout: (text: string) => void;
	readonly stderr: (text: string) => void;
}

export const processOutput: CommandOutput = {
	stdout: (text) => {
		process.stdout.write(text);
	},
	stderr: (text) => {
		process.stderr.write(text);
	},
};

/**
 * The only thing stdout carries: the strict record a command wrote, or the
 * path to it. Every command answers `--json` the same way, so the rule lives
 * here rather than at each command's last line.
 */
export async function writeRecord(
	output: CommandOutput,
	recordFile: string,
	json: boolean,
): Promise<void> {
	output.stdout(json ? await Bun.file(recordFile).text() : `${recordFile}\n`);
}
