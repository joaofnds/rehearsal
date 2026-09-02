export interface LineObserver {
	readonly carry: (characters: number) => void;
}

export const IGNORE_CARRY: LineObserver = { carry: () => undefined };

/**
 * Session files run to several megabytes, so a file's lines are read as a
 * stream of chunks and split on the way through: holding one as a string would
 * put a whole transcript in memory to look at a few of its records. The carry
 * is the partial line spanning two chunks, reported so a test can observe that
 * the whole file is never held.
 */
export async function* fileLines(
	path: string,
	observer: LineObserver = IGNORE_CARRY,
): AsyncGenerator<string> {
	for await (const line of terminatedFileLines(path, observer)) {
		yield line.text;
	}
}

export interface FileLine {
	readonly text: string;
	readonly terminated: boolean;
}

/**
 * The same stream, keeping whether each line ended with a newline in the
 * source. A copy that must differ from its source in nothing but a rewritten
 * value needs that, because a file ending without a newline and one ending with
 * it are different bytes.
 */
export async function* terminatedFileLines(
	path: string,
	observer: LineObserver = IGNORE_CARRY,
): AsyncGenerator<FileLine> {
	const decoder = new TextDecoder();
	let carry = "";

	for await (const chunk of Bun.file(path).stream()) {
		carry += decoder.decode(chunk, { stream: true });
		observer.carry(carry.length);
		const parts = carry.split("\n");
		carry = parts.pop() ?? "";
		for (const part of parts) {
			yield { text: part, terminated: true };
		}
	}

	carry += decoder.decode();
	if (carry !== "") {
		yield { text: carry, terminated: false };
	}
}
