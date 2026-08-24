import { createHash } from "node:crypto";
import { join } from "node:path";
import { CommandError, runCommand } from "./command";
import {
	BASELINE_CONTEXT_EXCLUDED_PATHS,
	CHECK_PATHS,
	TEST_CONFIG_PATH,
} from "./config";
import type { ContextFile, LocalCheckResult } from "./contracts";

export async function runChecks(targetDir: string, label: string) {
	console.log(`\n${label}`);
	const options = { env: { CONFIG_PATH: TEST_CONFIG_PATH } };

	await runCommand(["bun", "run", "typecheck"], targetDir, options);
	await runCommand(["bun", "run", "check"], targetDir, options);
	await runCommand(["bun", "run", "test:unit"], targetDir, options);
}

export async function captureTreatmentChecks(
	targetDir: string,
): Promise<LocalCheckResult> {
	try {
		await runChecks(targetDir, "Treatment checks");
		return {
			status: "PASS",
			evidence: [
				{
					source: "local-checks",
					path: "bun run typecheck; bun run check; bun run test:unit",
					claim: "All treatment checks exited successfully",
				},
			],
		};
	} catch (error) {
		const command =
			error instanceof CommandError
				? error.command.join(" ")
				: "unknown command";
		const exitCode = error instanceof CommandError ? error.exitCode : "unknown";
		console.error(`Treatment check failed: ${command} exited ${exitCode}`);

		return {
			status: "FAIL",
			evidence: [
				{
					source: "local-checks",
					path: command,
					claim: `Treatment check exited ${exitCode}`,
				},
			],
		};
	}
}

export async function captureFileHashes(directory: string) {
	const hashes = new Map<string, string>();

	for (const path of CHECK_PATHS) {
		const file = Bun.file(join(directory, path));
		const content = (await file.exists())
			? await file.bytes()
			: new Uint8Array();
		hashes.set(path, createHash("sha256").update(content).digest("hex"));
	}

	return hashes;
}

export async function captureCheckIntegrity(
	directory: string,
	baselineHashes: ReadonlyMap<string, string>,
): Promise<LocalCheckResult> {
	const treatmentHashes = await captureFileHashes(directory);
	const changedPaths: string[] = [];

	for (const [path, baselineHash] of baselineHashes) {
		if (treatmentHashes.get(path) !== baselineHash) changedPaths.push(path);
	}

	return {
		status: changedPaths.length === 0 ? "PASS" : "FAIL",
		evidence: [
			{
				source: "local-checks",
				path: CHECK_PATHS.join(", "),
				claim:
					changedPaths.length === 0
						? "Check scripts and configurations match the baseline"
						: `Build modified check definitions: ${changedPaths.join(", ")}`,
			},
		],
	};
}

export async function captureBaselineContext(directory: string) {
	const context: ContextFile[] = [];
	const trackedPaths = (await runCommand(["git", "ls-files"], directory))
		.trim()
		.split("\n")
		.filter(Boolean)
		.filter(
			(path) => !BASELINE_CONTEXT_EXCLUDED_PATHS.includes(path as "bun.lock"),
		);

	for (const path of trackedPaths) {
		const file = Bun.file(join(directory, path));
		if (await file.exists()) context.push({ path, content: await file.text() });
	}

	return context;
}
