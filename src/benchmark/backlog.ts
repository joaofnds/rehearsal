import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { runCommand } from "./command";
import type { WorkflowStage } from "./config";
import { assertWorkspaceCleanAt, git } from "./target";

const taskViewSchema = z
	.object({
		task: z
			.object({
				acceptanceCriteria: z.array(z.unknown()),
				documentation: z.array(z.string()),
			})
			.passthrough(),
	})
	.passthrough();

type TaskView = z.infer<typeof taskViewSchema>;

function parseTaskSeed(task: string) {
	const [heading, ...body] = task.trim().split("\n");
	if (!heading?.startsWith("# ")) {
		throw new Error("backlog-seed.md must start with a level-one heading");
	}

	const description = body.join("\n").trim();
	if (!description) throw new Error("backlog-seed.md needs a task description");

	return { title: heading.slice(2).trim(), description };
}

async function configureBacklog(targetDir: string) {
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
	const configured = config.replace(/^statuses:.*$/m, statuses);
	if (configured === config && !config.includes(statuses)) {
		throw new Error("Backlog configuration does not declare statuses");
	}

	await Bun.write(configPath, configured);
}

export async function createTaskCommit(
	targetDir: string,
	task: string,
	instructions: string,
) {
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
	const taskId = /Task ([A-Z]+-\d+)/.exec(createdTask)?.[1];
	if (!taskId) throw new Error("Backlog did not return the created task ID");

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

	return {
		taskId,
		taskSha: await git(targetDir, "rev-parse", "HEAD"),
	};
}

export async function readTaskState(targetDir: string, taskId: string) {
	const output = await runCommand(
		["backlog", "task", taskId, "--json"],
		targetDir,
	);

	return { output, view: taskViewSchema.parse(JSON.parse(output)) };
}

export function assertStageArtifactState(
	stage: Exclude<WorkflowStage, "build">,
	view: TaskView,
	documentFiles: readonly string[],
) {
	if (stage === "discuss" && view.task.acceptanceCriteria.length === 0) {
		throw new Error("Discuss completed without acceptance criteria");
	}

	const expectedDoc = {
		discuss: "spec",
		grill: "grilled",
		plan: "plan",
	}[stage];
	const attachedIds = new Set(view.task.documentation);
	const hasArtifact = documentFiles.some((file) => {
		const documentId = file.split(" ", 1)[0];
		return (
			documentId !== undefined &&
			attachedIds.has(documentId) &&
			file.toLowerCase().endsWith(`-${expectedDoc}.md`)
		);
	});

	if (!hasArtifact) {
		throw new Error(
			`${stage} completed without its durable ${expectedDoc} document`,
		);
	}
}

export async function assertPlanningStageCompleted(
	targetDir: string,
	taskId: string,
	taskSha: string,
	stage: Exclude<WorkflowStage, "build">,
) {
	await assertWorkspaceCleanAt(targetDir, taskSha);
	const { view } = await readTaskState(targetDir, taskId);
	const documentFiles = await readdir(join(targetDir, "backlog", "docs"));
	assertStageArtifactState(stage, view, documentFiles);
}
