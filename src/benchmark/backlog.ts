import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { z } from "zod";
import { runCommand } from "./command";
import { StageValidationError } from "./contracts";
import type { PlanningStageDefinition } from "./pipeline";
import type { ExpectedBranch } from "./target";
import { assertWorkspaceCleanAt, git } from "./target";
import type { Immutable } from "./contracts";

const taskViewSchema = z
	.object({
		task: z
			.object({
				acceptanceCriteria: z.array(z.unknown()),
				documentation: z.array(z.string()),
			})
			.loose(),
	})
	.loose();

type TaskView = Immutable<z.infer<typeof taskViewSchema>>;

interface TaskSeed {
	readonly title: string;
	readonly description: string;
}

function parseTaskSeed(task: string): TaskSeed {
	const [heading, ...body] = task.trim().split("\n");
	if (heading === undefined || !heading.startsWith("# ")) {
		throw new Error("backlog-seed.md must start with a level-one heading");
	}

	const description = body.join("\n").trim();
	if (!description) {
		throw new Error("backlog-seed.md needs a task description");
	}

	return { title: heading.slice(2).trim(), description };
}

async function configureBacklog(targetDir: string): Promise<void> {
	const configPath = join(targetDir, "backlog", "config.yml");
	const configFile = Bun.file(configPath);

	if (!(await configFile.exists())) {
		await runCommand(
			[
				"backlog",
				"init",
				"Template",
				"--defaults",
				"--integration-mode",
				"cli",
				"--agent-instructions",
				"none",
			],
			targetDir,
		);
	}

	const config = await Bun.file(configPath).text();
	const statuses =
		'statuses: ["To Do", "Spec", "Grill", "Plan", "Build", "Done"]';
	const configured = config.replace(/^statuses:.*$/mu, statuses);
	if (configured === config && !config.includes(statuses)) {
		throw new Error("Backlog configuration does not declare statuses");
	}

	await Bun.write(configPath, configured);
}

export async function createTaskCommit(
	targetDir: string,
	task: string,
	instructions: string,
): Promise<{ taskId: string; taskSha: string }> {
	await configureBacklog(targetDir);
	const { title, description } = parseTaskSeed(task);
	const createdTask = await runCommand(
		[
			"backlog",
			"task",
			"create",
			title,
			"--description",
			description,
			"--type",
			"feature",
			"--status",
			"To Do",
			"--plain",
		],
		targetDir,
	);
	const taskId = /Task (?<id>[A-Z]+-\d+)/u.exec(createdTask)?.groups?.["id"];
	if (taskId === undefined) {
		throw new Error("Backlog did not return the created task ID");
	}

	return {
		taskId,
		taskSha: await installInstructions(targetDir, instructions),
	};
}

/**
 * Commits the instruction corpus so the session reads it from the tree like
 * any project file. A replay reuses this to swap the checkpoint-era
 * CLAUDE.md for the current one; when the content already matches, nothing
 * is committed and the checkout's SHA stands.
 */
export async function installInstructions(
	targetDir: string,
	instructions: string,
): Promise<string> {
	await Bun.write(join(targetDir, "CLAUDE.md"), instructions);
	await git(targetDir, "add", "--", "CLAUDE.md");
	const stagedPaths = await git(targetDir, "diff", "--cached", "--name-only");

	if (stagedPaths) {
		await git(
			targetDir,
			"commit",
			"-m",
			"chore: configure project instructions",
			"--",
			"CLAUDE.md",
		);
	}

	return git(targetDir, "rev-parse", "HEAD");
}

export function readTaskOutput(
	targetDir: string,
	taskId: string,
): Promise<string> {
	return runCommand(["backlog", "task", taskId, "--json"], targetDir);
}

export interface TaskState {
	readonly output: string;
	readonly view: TaskView;
}

export function parseTaskState(output: string): TaskState {
	try {
		return { output, view: taskViewSchema.parse(JSON.parse(output)) };
	} catch {
		throw new StageValidationError("Backlog returned invalid task state");
	}
}

export function assertStageArtifactState(
	stage: PlanningStageDefinition,
	view: TaskView,
	documentFiles: readonly string[],
): string {
	if (
		stage.requiresAcceptanceCriteria &&
		view.task.acceptanceCriteria.length === 0
	) {
		throw new StageValidationError(
			`${stage.name} completed without acceptance criteria`,
		);
	}

	const expectedDoc = stage.artifact;
	const attachedReferences = view.task.documentation.map((reference) =>
		basename(reference),
	);
	const attachedIds = new Set(
		attachedReferences.map((reference) => reference.split(" ", 1)[0]),
	);
	const artifactFile = documentFiles.find((file) => {
		const [documentId] = file.split(" ", 1);
		return (
			(attachedReferences.includes(file) ||
				(documentId !== undefined && attachedIds.has(documentId))) &&
			file.toLowerCase().endsWith(`-${expectedDoc}.md`)
		);
	});

	if (artifactFile === undefined) {
		throw new StageValidationError(
			`${stage.name} completed without its durable ${expectedDoc} document`,
		);
	}

	return artifactFile;
}

export async function assertPlanningStageCompleted(
	targetDir: string,
	taskSha: string,
	stage: PlanningStageDefinition,
	taskState: { readonly output: string; readonly view: TaskView },
	expectedBranch: ExpectedBranch = "main",
): Promise<{
	taskState: string;
	artifact: { path: string; content: string };
}> {
	await assertWorkspaceCleanAt(targetDir, taskSha, expectedBranch);
	const { output, view } = taskState;
	const documentFiles = await readdir(join(targetDir, "backlog", "docs"));
	const artifactFile = assertStageArtifactState(stage, view, documentFiles);
	const artifactPath = join("backlog", "docs", artifactFile);

	return {
		taskState: output,
		artifact: {
			path: artifactPath,
			content: await Bun.file(join(targetDir, artifactPath)).text(),
		},
	};
}
