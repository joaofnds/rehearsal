import { describe, expect, it } from "bun:test";
import { CommandError, killActiveCommands, runCommand } from "./command";

async function pgrepMatches(pattern: string): Promise<string> {
	try {
		const matches = await runCommand(["pgrep", "-f", pattern], process.cwd());
		return matches.trim();
	} catch (error) {
		if (error instanceof CommandError && error.exitCode === 1) {
			return "";
		}

		throw error;
	}
}

describe(killActiveCommands.name, () => {
	it("kills a running command's whole process group", async () => {
		const running = (async () => {
			try {
				return await runCommand(
					["sh", "-c", "sleep 987654 & wait"],
					process.cwd(),
				);
			} catch {
				return "killed";
			}
		})();
		while ((await pgrepMatches("sleep 987654")) === "") {
			await Bun.sleep(25);
		}

		await killActiveCommands();

		expect(await running).toBe("killed");
		expect(await pgrepMatches("sleep 987654")).toBe("");
	});

	it("kills the whole group when a command times out", async () => {
		const running = (async () => {
			try {
				return await runCommand(
					["sh", "-c", "sleep 987653 & wait"],
					process.cwd(),
					{ timeoutMs: 250 },
				);
			} catch {
				return "killed";
			}
		})();

		expect(await running).toBe("killed");
		expect(await pgrepMatches("sleep 987653")).toBe("");
	});
});
