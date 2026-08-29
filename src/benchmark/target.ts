import { cp, mkdtemp, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommandError, runCommand } from "./command";
import { CONTROL_DIR, WORKFLOW_PATHS } from "./config";
import { StageValidationError } from "./contracts";

export interface SourceBaseline {
	readonly root: string;
	readonly sha: string;
	readonly origin?: string;
}

export interface WorkflowBackup {
	readonly directory: string;
	readonly presentPaths: readonly string[];
}

export async function git(directory: string, ...args: string[]) {
	return (await runCommand(["git", ...args], directory)).trim();
}

export async function assertSourceReady(
	sourceDir: string,
): Promise<SourceBaseline> {
	const sourceRoot = await realpath(sourceDir);
	const repositoryRoot = await realpath(
		await git(sourceRoot, "rev-parse", "--show-toplevel"),
	);
	const controlRoot = await realpath(CONTROL_DIR);

	if (sourceRoot !== repositoryRoot) {
		throw new Error("Target must be the repository root");
	}

	if (sourceRoot === controlRoot) {
		throw new Error("Target must not be the control repository");
	}

	const branch = await git(sourceRoot, "branch", "--show-current");
	if (branch !== "main") {
		throw new Error(
			`Target must be on main, found ${branch || "detached HEAD"}`,
		);
	}

	const status = await git(
		sourceRoot,
		"status",
		"--porcelain=v1",
		"--untracked-files=all",
	);
	if (status) throw new Error("Target main must be clean before a run");

	return {
		root: sourceRoot,
		sha: await git(sourceRoot, "rev-parse", "HEAD"),
		origin: await optionalGit(sourceRoot, "remote", "get-url", "origin"),
	};
}

async function optionalGit(directory: string, ...args: string[]) {
	try {
		return await git(directory, ...args);
	} catch {
		return undefined;
	}
}

export async function assertControlReady() {
	const status = await git(
		CONTROL_DIR,
		"status",
		"--porcelain=v1",
		"--untracked-files=all",
	);
	if (status) {
		throw new Error(
			"Commit the control repository before running the benchmark",
		);
	}

	return await git(CONTROL_DIR, "rev-parse", "HEAD");
}

export async function captureWorkflowBackup(
	targetDir: string,
): Promise<WorkflowBackup> {
	const directory = await mkdtemp(join(tmpdir(), "template-workflow-backup-"));
	const presentPaths: string[] = [];

	for (const path of WORKFLOW_PATHS) {
		try {
			await stat(join(targetDir, path));
		} catch (error) {
			if (
				error instanceof Error &&
				"code" in error &&
				error.code === "ENOENT"
			) {
				continue;
			}

			throw error;
		}

		await cp(join(targetDir, path), join(directory, path), { recursive: true });
		presentPaths.push(path);
	}

	return { directory, presentPaths };
}

async function restoreWorkflowBackup(
	targetDir: string,
	backup: WorkflowBackup,
) {
	for (const path of WORKFLOW_PATHS) {
		await rm(join(targetDir, path), { force: true, recursive: true });
	}

	for (const path of backup.presentPaths) {
		await cp(join(backup.directory, path), join(targetDir, path), {
			recursive: true,
		});
	}
}

function runMarkerPath(root: string) {
	return join(root, ".git", "benchmark-run.json");
}

export async function claimTarget(source: SourceBaseline) {
	const path = runMarkerPath(source.root);
	const marker = Bun.file(path);

	if (await marker.exists()) {
		throw new Error(
			`A previous benchmark run left this target unrestored: ${(await marker.text()).trim()}. Restore it manually (git reset --hard <sha>; git clean -fd), then delete ${path}.`,
		);
	}

	await Bun.write(
		path,
		`${JSON.stringify({
			sha: source.sha,
			pid: process.pid,
			startedAt: new Date().toISOString(),
		})}\n`,
	);
}

export async function restoreTarget(
	source: SourceBaseline,
	backup?: WorkflowBackup,
) {
	await git(source.root, "switch", "--force", "main");
	await git(source.root, "reset", "--hard", source.sha);
	await git(source.root, "clean", "-fd");

	if (backup) await restoreWorkflowBackup(source.root, backup);

	const restored = await assertSourceReady(source.root);
	if (restored.sha !== source.sha) {
		throw new Error(
			"Target repository was not restored to its original commit",
		);
	}

	await rm(runMarkerPath(source.root), { force: true });
}

export async function teardownTarget(
	source: SourceBaseline,
	backup: WorkflowBackup,
) {
	try {
		await restoreTarget(source, backup);
	} catch (error) {
		console.error(
			`Restore failed; the workflow backup remains at ${backup.directory}`,
		);
		throw error;
	}

	await rm(backup.directory, { force: true, recursive: true });
	console.log(`Target restored to ${source.sha}.`);
}

export async function assertWorkspaceCleanAt(
	targetDir: string,
	expectedSha: string,
) {
	const branch = await git(targetDir, "branch", "--show-current");
	const sha = await git(targetDir, "rev-parse", "HEAD");
	const status = await git(
		targetDir,
		"status",
		"--porcelain=v1",
		"--untracked-files=all",
	);

	if (branch !== "main" || sha !== expectedSha || status) {
		throw new StageValidationError("Target baseline changed unexpectedly");
	}
}

export async function captureBuildCandidate(
	targetDir: string,
	taskSha: string,
) {
	const resultSha = await git(targetDir, "rev-parse", "HEAD");
	const trackedDiff = await runCommand(
		["git", "diff", "--no-ext-diff", "--binary", taskSha],
		targetDir,
	);
	const trackedPaths = (await git(targetDir, "diff", "--name-only", taskSha))
		.split("\n")
		.filter(Boolean);
	const untrackedPaths = (
		await runCommand(
			["git", "ls-files", "--others", "--exclude-standard", "-z"],
			targetDir,
		)
	)
		.split("\0")
		.filter(Boolean);
	const untrackedDiffs = await Promise.all(
		untrackedPaths.map(async (path) => {
			const content = await Bun.file(join(targetDir, path)).text();
			return `diff --git a/${path} b/${path}\nnew untracked file\n--- /dev/null\n+++ b/${path}\n@@ untracked file @@\n${content}`;
		}),
	);

	return {
		resultSha,
		diff: [trackedDiff, ...untrackedDiffs].filter(Boolean).join("\n"),
		changedPaths: [...new Set([...trackedPaths, ...untrackedPaths])],
	};
}

export async function assertBuildCommitted(targetDir: string, taskSha: string) {
	const branch = await git(targetDir, "branch", "--show-current");
	if (branch !== "main")
		throw new StageValidationError("Build phase left main");

	const status = await git(
		targetDir,
		"status",
		"--porcelain=v1",
		"--untracked-files=all",
	);
	if (status) {
		throw new StageValidationError(
			`Build phase left uncommitted changes:\n${status}`,
		);
	}

	const resultSha = await git(targetDir, "rev-parse", "HEAD");
	if (resultSha === taskSha) {
		throw new StageValidationError("Build phase did not create a commit");
	}

	try {
		await git(targetDir, "merge-base", "--is-ancestor", taskSha, resultSha);
	} catch (error) {
		if (error instanceof CommandError && error.exitCode === 1) {
			throw new StageValidationError(
				"Build phase rewrote or discarded task history",
			);
		}

		throw error;
	}
	const diff = await runCommand(
		["git", "diff", "--no-ext-diff", "--binary", `${taskSha}..${resultSha}`],
		targetDir,
	);
	if (!diff.trim()) {
		throw new StageValidationError("Build commit contains no changes");
	}

	const subjects = await git(
		targetDir,
		"log",
		"--format=%s",
		`${taskSha}..${resultSha}`,
	);
	assertConventionalCommitSubjects(subjects.split("\n"));

	return { resultSha, diff };
}

export function assertConventionalCommitSubjects(subjects: readonly string[]) {
	const invalidSubjects = subjects.filter(
		(subject) => !/^[a-z]+(?:\([^)]+\))?!?: .+/.test(subject),
	);

	if (invalidSubjects.length > 0) {
		throw new StageValidationError(
			`Build used non-conventional commit subjects: ${invalidSubjects.join(", ")}`,
		);
	}
}

export async function changedPathsBetween(
	targetDir: string,
	fromSha: string,
	toSha: string,
) {
	return (await git(targetDir, "diff", "--name-only", `${fromSha}..${toSha}`))
		.split("\n")
		.filter(Boolean);
}
