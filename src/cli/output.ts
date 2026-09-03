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

export function writeDiagnostic(
	output: CommandOutput,
	message: string | undefined,
): void {
	if (message === undefined) {
		return;
	}

	output.stderr(`${message}\n`);
}

/**
 * A record a command could not read, named by the id `show` accepts back and
 * by the reason. Every listing collects these rather than throwing, because one
 * half-written record must not hide the ones beside it.
 */
export interface UnreadableRecord {
	readonly id: string;
	readonly reason: string;
}

/**
 * Where an unreadable record goes: stderr, one line each, before the answers
 * that did read. Every command that reads more than one record answers this
 * the same way, so the rule lives here rather than at each command's own loop.
 */
export function writeUnreadable(
	output: CommandOutput,
	unreadable: readonly UnreadableRecord[],
): void {
	for (const { id, reason } of unreadable) {
		output.stderr(`${id}: ${reason}\n`);
	}
}
