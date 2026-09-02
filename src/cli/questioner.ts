import { stderr, stdin as input } from "node:process";
import { createInterface } from "node:readline/promises";

export interface TerminalQuestioner {
	readonly question: (message: string) => Promise<string>;
	readonly close: () => void;
}

export function terminalQuestioner(): TerminalQuestioner {
	const readline = createInterface({ input, output: stderr });

	return {
		question: (message) => readline.question(message),
		close: () => {
			readline.close();
		},
	};
}
