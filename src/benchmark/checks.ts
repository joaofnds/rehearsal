import { createHash } from "node:crypto";
import { join } from "node:path";
import { CommandError, runCommand } from "./command";
import {
	CHECK_PATHS,
	MAX_CONTEXT_FILE_BYTES,
	MAX_CONTEXT_TOTAL_BYTES,
	TEST_CONFIG_PATH,
} from "./config";
import type { ContextFile, LocalCheckResult } from "./contracts";

export interface TargetCheck {
	readonly command: readonly string[];
	readonly env?: Readonly<Record<string, string>> | undefined;
}

const DEFAULT_TARGET_CHECKS: readonly TargetCheck[] = [
	{
		command: ["bun", "run", "typecheck"],
		env: { CONFIG_PATH: TEST_CONFIG_PATH },
	},
	{
		command: ["bun", "run", "check"],
		env: { CONFIG_PATH: TEST_CONFIG_PATH },
	},
	{
		command: ["bun", "run", "test:unit"],
		env: { CONFIG_PATH: TEST_CONFIG_PATH },
	},
];

export async function runChecks(
	targetDir: string,
	label: string,
	checks: readonly TargetCheck[] = DEFAULT_TARGET_CHECKS,
): Promise<void> {
	console.log(`\n${label}`);

	for (const check of checks) {
		await runCommand(check.command, targetDir, { env: check.env });
	}
}

export async function captureTreatmentChecks(
	targetDir: string,
	checks: readonly TargetCheck[] = DEFAULT_TARGET_CHECKS,
): Promise<LocalCheckResult> {
	try {
		await runChecks(targetDir, "Treatment checks", checks);
		return {
			status: "PASS",
			evidence: [
				{
					source: "local-checks",
					path: checks.map(({ command }) => command.join(" ")).join("; "),
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

export async function captureFileHashes(
	directory: string,
	integrityFiles?: readonly string[] | undefined,
): Promise<Map<string, string>> {
	const hashes = new Map<string, string>();
	const paths = integrityFiles ?? CHECK_PATHS;

	for (const path of paths) {
		const file = Bun.file(join(directory, path));
		const exists = await file.exists();
		if (!exists && integrityFiles !== undefined) {
			throw new Error(`Declared check-integrity file is missing: ${path}`);
		}

		const content = exists ? await file.bytes() : new Uint8Array();
		hashes.set(path, createHash("sha256").update(content).digest("hex"));
	}

	return hashes;
}

export async function captureCheckIntegrity(
	directory: string,
	baselineHashes: ReadonlyMap<string, string>,
): Promise<LocalCheckResult> {
	const changedPaths: string[] = [];

	for (const [path, baselineHash] of baselineHashes) {
		const file = Bun.file(join(directory, path));
		if (!(await file.exists())) {
			changedPaths.push(path);
			continue;
		}

		const treatmentHash = createHash("sha256")
			.update(await file.bytes())
			.digest("hex");
		if (treatmentHash !== baselineHash) {
			changedPaths.push(path);
		}
	}
	const integrityFiles = [...baselineHashes.keys()];

	return {
		status: changedPaths.length === 0 ? "PASS" : "FAIL",
		evidence: [
			{
				source: "local-checks",
				path: integrityFiles.join(", "),
				claim:
					changedPaths.length === 0
						? "Check scripts and configurations match the baseline"
						: `Build modified check definitions: ${changedPaths.join(", ")}`,
			},
		],
	};
}

export async function captureBoundedContent(
	file: ReturnType<typeof Bun.file>,
): Promise<string> {
	if (file.size > MAX_CONTEXT_FILE_BYTES) {
		return `[${file.size} bytes omitted: exceeds the ${MAX_CONTEXT_FILE_BYTES}-byte capture limit]`;
	}

	const bytes = await file.bytes();
	if (bytes.subarray(0, 8192).includes(0)) {
		return "[binary file omitted]";
	}

	return new TextDecoder().decode(bytes);
}

export async function captureBaselineContext(
	directory: string,
): Promise<ContextFile[]> {
	const context: ContextFile[] = [];
	const trackedOutput = await runCommand(["git", "ls-files"], directory);
	const trackedPaths = trackedOutput
		.trim()
		.split("\n")
		.filter(Boolean)
		.filter((path) => path !== "bun.lock");
	let totalBytes = 0;

	for (const path of trackedPaths) {
		const file = Bun.file(join(directory, path));
		if (!(await file.exists())) {
			continue;
		}

		if (totalBytes + file.size > MAX_CONTEXT_TOTAL_BYTES) {
			context.push({
				path,
				content: "[omitted: total capture budget exhausted]",
			});
			continue;
		}

		const content = await captureBoundedContent(file);
		context.push({ path, content });
		totalBytes += content.length;
	}

	return context;
}
