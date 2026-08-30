import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { z } from "zod";
import { runCommand } from "./command";
import { StageValidationError } from "./contracts";
import type { PlanningStageDefinition } from "./pipeline";
import { assertWorkspaceCleanAt, type ExpectedBranch, git } from "./target";

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

export async function readTaskOutput(targetDir: string, taskId: string) {
	return await runCommand(["backlog", "task", taskId, "--json"], targetDir);
}

export function parseTaskState(output: string) {
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
) {
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
		const documentId = file.split(" ", 1)[0];
		return (
			(attachedReferences.includes(file) ||
				(documentId !== undefined && attachedIds.has(documentId))) &&
			file.toLowerCase().endsWith(`-${expectedDoc}.md`)
		);
	});

	if (!artifactFile) {
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
	taskState: { output: string; view: TaskView },
	expectedBranch: ExpectedBranch = "main",
) {
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
