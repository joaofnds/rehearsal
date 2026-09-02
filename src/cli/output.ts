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
