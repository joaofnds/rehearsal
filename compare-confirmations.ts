import { writeComparisonReport } from "./src/benchmark/comparison-command";
import { CONTROL_DIR, REQUIRED_BUN_VERSION } from "./src/benchmark/config";
import { benchmarkRunsDirectory } from "./src/benchmark/run-layout";

async function main(): Promise<void> {
	if (Bun.version !== REQUIRED_BUN_VERSION) {
		throw new Error(
			`Use Bun ${REQUIRED_BUN_VERSION}; current version is ${Bun.version}`,
		);
	}

	const [manifestPath, ...unexpected] = Bun.argv.slice(2);
	if (manifestPath === undefined || unexpected.length > 0) {
		throw new Error("Usage: bun run compare <comparison-manifest.json>");
	}

	const reportFile = await writeComparisonReport({
		manifestPath,
		runsDirectory: benchmarkRunsDirectory(CONTROL_DIR),
	});

	console.log(`Comparison report: ${reportFile}`);
}

if (import.meta.main) {
	await main();
}
