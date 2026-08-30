import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { parseArgs, REQUIRED_BUN_VERSION } from "./src/benchmark/config";
import { runBenchmark } from "./src/benchmark/run";

async function main(): Promise<void> {
	if (Bun.version !== REQUIRED_BUN_VERSION) {
		throw new Error(
			`Use Bun ${REQUIRED_BUN_VERSION}; current version is ${Bun.version}`,
		);
	}

	const rl = createInterface({ input, output });

	try {
		await runBenchmark(parseArgs(Bun.argv.slice(2)), rl);
	} finally {
		rl.close();
	}
}

if (import.meta.main) {
	await main();
}
