import { afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "./command";
import type { LocalCheckResult } from "./contracts";

export const PROJECT_ROOT = join(import.meta.dir, "../..");

export interface TestRepository {
	readonly directory: string;
	readonly sha: string;
}

export class TestResources {
	private readonly directories: string[] = [];

	public static forEachTest(): TestResources {
		const resources = new TestResources();
		afterEach(() => resources.cleanup());

		return resources;
	}

	public track(directory: string): void {
		this.directories.push(directory);
	}

	public async createRepository(): Promise<TestRepository> {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-source-"));
		this.track(directory);
		await runCommand(["git", "init", "-b", "main"], directory);
		await runCommand(
			["git", "config", "user.name", "Benchmark Test"],
			directory,
		);
		await runCommand(
			["git", "config", "user.email", "benchmark@example.com"],
			directory,
		);
		await Bun.write(join(directory, "base.txt"), "base\n");
		await Bun.write(
			join(directory, "package.json"),
			'{"scripts":{"typecheck":"tsc --noEmit","check":"biome check","test:unit":"bun test src"}}\n',
		);
		await Bun.write(join(directory, "bun.lock"), "{}\n");
		await commitAll(directory, "chore: base");
		const head = await runCommand(["git", "rev-parse", "HEAD"], directory);

		return { directory, sha: head.trim() };
	}

	private async cleanup(): Promise<void> {
		await Promise.all(
			this.directories
				.splice(0)
				.map((path) => rm(path, { force: true, recursive: true })),
		);
	}
}

export async function commitAll(
	directory: string,
	message: string,
): Promise<void> {
	await runCommand(["git", "add", "."], directory);
	await runCommand(["git", "commit", "-m", message], directory);
}

export function harnessResult(
	status: "PASS" | "FAIL",
	claim: string,
): LocalCheckResult {
	return {
		status,
		evidence: [
			{
				source: "local-checks",
				path: "harness",
				claim,
			},
		],
	};
}
