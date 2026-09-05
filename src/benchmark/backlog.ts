import { mkdir, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { z } from "zod";
import { runCommand } from "./command";
import { StageValidationError } from "./contracts";
import type { PlanningStageDefinition } from "./pipeline";
import type { ExpectedBranch } from "./target";
import { capturePlanningAdvance, git } from "./target";
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

const WORKFLOW_STATE_PATHS = ["backlog/", "backlog.config.yml", ".boris/"];

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

/**
 * The harness writes no commit for the board it creates, so a target that never
 * opted into a board reports it as untracked and the stage is failed for
 * scaffolding the harness put there. The exclusion goes in the repository's
 * private info/exclude rather than its .gitignore, which is the target's own
 * file and a property of the repository under test.
 */
async function excludeWorkflowState(targetDir: string): Promise<void> {
	const excludePath = join(targetDir, ".git", "info", "exclude");
	const existing = await Bun.file(excludePath)
		.text()
		.catch(() => "");
	const lines = existing.split("\n");
	const missing = WORKFLOW_STATE_PATHS.filter((path) => !lines.includes(path));
	if (missing.length === 0) {
		return;
	}

	await mkdir(join(targetDir, ".git", "info"), { recursive: true });
	const kept = existing.trimEnd();
	const body = kept ? [kept, ...missing] : missing;

	await Bun.write(excludePath, `${body.join("\n")}\n`);
}

async function configureBacklog(
	targetDir: string,
	statuses: readonly string[],
): Promise<void> {
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
	const statusesLine = `statuses: [${statuses
		.map((status) => JSON.stringify(status))
		.join(", ")}]`;
	const configured = config.replace(/^statuses:.*$/mu, statusesLine);
	if (configured === config && !config.includes(statusesLine)) {
		throw new Error("Backlog configuration does not declare statuses");
	}

	await Bun.write(configPath, configured);
}

/**
 * Seeds the target's board with the run's task and reports the commit the
 * stage's changes are measured from. It writes no commit of its own: the
 * board lives under the target's ignored workflow state, and the target's
 * project instructions are a property of the target, so a run that rewrote
 * them would grade the agent against a repository nobody has.
 */
export async function seedTaskBoard(
	targetDir: string,
	task: string,
	statuses: readonly string[],
): Promise<{ taskId: string; taskSha: string }> {
	const [entryStatus] = statuses;
	if (entryStatus === undefined) {
		throw new Error("The pipeline must declare at least one board status");
	}

	await excludeWorkflowState(targetDir);
	await configureBacklog(targetDir, statuses);
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
			entryStatus,
			"--plain",
		],
		targetDir,
	);
	const taskId = /Task (?<id>[A-Z]+-\d+)/u.exec(createdTask)?.groups?.["id"];
	if (taskId === undefined) {
		throw new Error("Backlog did not return the created task ID");
	}

	return { taskId, taskSha: await git(targetDir, "rev-parse", "HEAD") };
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

/**
 * The card file is the task's full record: goal, decisions, glossary, and
 * prose sections that backlog's JSON projection omits. Judges read the card;
 * the JSON stays for structural validation.
 */
export async function readTaskCard(
	targetDir: string,
	taskId: string,
): Promise<string> {
	const tasksDirectory = join(targetDir, "backlog", "tasks");
	const entries = await readdir(tasksDirectory);
	const prefix = `${taskId.toLowerCase()} -`;
	const cardFile = entries.find((entry) =>
		entry.toLowerCase().startsWith(prefix),
	);
	if (cardFile === undefined) {
		throw new StageValidationError(`No task card found for ${taskId}`);
	}

	return Bun.file(join(tasksDirectory, cardFile)).text();
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
): string | undefined {
	if (
		stage.requiresAcceptanceCriteria &&
		view.task.acceptanceCriteria.length === 0
	) {
		throw new StageValidationError(
			`${stage.name} completed without acceptance criteria`,
		);
	}

	const expectedDoc = stage.artifact;
	if (expectedDoc === undefined) {
		return undefined;
	}

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
	baselineSha: string,
	stage: PlanningStageDefinition,
	taskState: { readonly output: string; readonly view: TaskView },
	expectedBranch: ExpectedBranch = "main",
): Promise<{
	taskState: string;
	artifact: { path: string; content: string } | undefined;
	resultSha: string;
	diff: string;
	changedPaths: string[];
	commitSubjects?: string[] | undefined;
}> {
	const advance = await capturePlanningAdvance(
		targetDir,
		baselineSha,
		expectedBranch,
	);
	const { output, view } = taskState;
	const documentFiles = await readdir(join(targetDir, "backlog", "docs"));
	const artifactFile = assertStageArtifactState(stage, view, documentFiles);
	if (artifactFile === undefined) {
		return { taskState: output, artifact: undefined, ...advance };
	}
	const artifactPath = join("backlog", "docs", artifactFile);

	return {
		taskState: output,
		artifact: {
			path: artifactPath,
			content: await Bun.file(join(targetDir, artifactPath)).text(),
		},
		...advance,
	};
}
