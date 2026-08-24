import { cp, mkdtemp, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "./command";
import { CONTROL_DIR, WORKFLOW_PATHS } from "./config";

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
		throw new Error("Target baseline changed unexpectedly");
	}
}

export async function assertBuildCommitted(targetDir: string, taskSha: string) {
	const branch = await git(targetDir, "branch", "--show-current");
	if (branch !== "main") throw new Error("Build phase left main");

	const status = await git(
		targetDir,
		"status",
		"--porcelain=v1",
		"--untracked-files=all",
	);
	if (status) throw new Error("Build phase left uncommitted changes");

	const resultSha = await git(targetDir, "rev-parse", "HEAD");
	if (resultSha === taskSha) {
		throw new Error("Build phase did not create a commit");
	}

	await git(targetDir, "merge-base", "--is-ancestor", taskSha, resultSha);
	const diff = await runCommand(
		["git", "diff", "--no-ext-diff", "--binary", `${taskSha}..${resultSha}`],
		targetDir,
	);
	if (!diff.trim()) throw new Error("Build commit contains no changes");

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
		throw new Error(
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
