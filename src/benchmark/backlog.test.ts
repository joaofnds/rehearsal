import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	assertPlanningStageCompleted,
	assertStageArtifactState,
	seedTaskBoard,
	parseTaskState,
	readTaskCard,
} from "./backlog";
import { runCommand } from "./command";
import { StageValidationError } from "./contracts";
import type { TestRepository } from "./test-support";
import { TestResources } from "./test-support";

const testResources = TestResources.forEachTest();

describe(assertStageArtifactState.name, () => {
	const view = {
		task: {
			acceptanceCriteria: [{}],
			documentation: ["doc-1", "doc-2", "doc-3"],
		},
	};
	const planStage = {
		name: "plan",
		kind: "planning",
		skill: "plan",
		artifact: "plan",
		rubric: "rubrics/plan.json",
		requiresAcceptanceCriteria: false,
	} as const;

	it("requires no document from a stage that declares no artifact", () => {
		const { artifact: _artifact, ...cardOnlyStage } = planStage;

		expect(assertStageArtifactState(cardOnlyStage, view, [])).toBeUndefined();
	});

	it("still requires acceptance criteria from a stage without an artifact", () => {
		const { artifact: _artifact, ...cardOnlyStage } = planStage;

		expect(() =>
			assertStageArtifactState(
				{ ...cardOnlyStage, requiresAcceptanceCriteria: true },
				{ task: { acceptanceCriteria: [], documentation: [] } },
				[],
			),
		).toThrow("without acceptance criteria");
	});

	it("rejects a stage that requires acceptance criteria and has none", () => {
		expect(() =>
			assertStageArtifactState(
				{ ...planStage, requiresAcceptanceCriteria: true },
				{ task: { acceptanceCriteria: [], documentation: ["doc-3"] } },
				["doc-3 - Asynchronous-audit-log-module-plan.md"],
			),
		).toThrow("without acceptance criteria");
	});

	it("accepts an empty acceptance list when the stage does not require it", () => {
		expect(() =>
			assertStageArtifactState(
				{ ...planStage, requiresAcceptanceCriteria: false },
				{ task: { acceptanceCriteria: [], documentation: ["doc-3"] } },
				["doc-3 - Asynchronous-audit-log-module-plan.md"],
			),
		).not.toThrow();
	});

	it("resolves attached document IDs to titled artifact files", () => {
		expect(() =>
			assertStageArtifactState(planStage, view, [
				"doc-1 - Asynchronous-audit-log-module-spec.md",
				"doc-2 - Asynchronous-audit-log-module-grilled.md",
				"doc-3 - Asynchronous-audit-log-module-plan.md",
			]),
		).not.toThrow();
	});

	it("rejects an unattached document with the expected suffix", () => {
		expect(() =>
			assertStageArtifactState(planStage, view, ["doc-4 - Unattached-plan.md"]),
		).toThrow("without its durable plan document");
	});

	it("accepts Backlog documentation paths as attachment references", () => {
		expect(() =>
			assertStageArtifactState(
				{
					name: "discuss",
					kind: "planning",
					skill: "discuss",
					artifact: "spec",
					rubric: "rubrics/discuss.json",
					requiresAcceptanceCriteria: true,
				},
				{
					task: {
						acceptanceCriteria: [{}],
						documentation: ["backlog/docs/doc-1 - audit-log-module-spec.md"],
					},
				},
				["doc-1 - audit-log-module-spec.md"],
			),
		).not.toThrow();
	});
});

describe(readTaskCard.name, () => {
	it("returns the card file matching the task id", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-card-"));
		testResources.track(directory);
		await mkdir(join(directory, "backlog", "tasks"), { recursive: true });
		await Bun.write(
			join(directory, "backlog", "tasks", "task-1 - Audit-log.md"),
			"## Goal\nthe card\n",
		);

		expect(await readTaskCard(directory, "TASK-1")).toContain("the card");
	});

	it("rejects a task without a card file", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-card-"));
		testResources.track(directory);
		await mkdir(join(directory, "backlog", "tasks"), { recursive: true });

		expect(readTaskCard(directory, "TASK-9")).rejects.toThrow(
			"No task card found",
		);
	});
});

describe(parseTaskState.name, () => {
	it("classifies malformed Backlog output as candidate validation failure", () => {
		expect(() => parseTaskState("not json")).toThrow(StageValidationError);
	});
});

/**
 * The target's project instructions are a property of the target. A run that
 * wrote the harness's own CLAUDE.md over them would grade an agent against a
 * repository that does not exist.
 */
describe(seedTaskBoard.name, () => {
	const seed = "# Add an audit log\n\nRecord every write to the ledger.\n";
	async function createTarget(): Promise<TestRepository> {
		const target = await testResources.createRepository();
		await runCommand(
			["git", "config", "core.excludesFile", "/dev/null"],
			target.directory,
		);

		return target;
	}

	it("adds no CLAUDE.md to the target tree", async () => {
		const target = await createTarget();

		await seedTaskBoard(target.directory, seed, ["To Do", "Done"]);

		expect(await Bun.file(join(target.directory, "CLAUDE.md")).exists()).toBe(
			false,
		);
	});

	it("writes no instructions commit, leaving the base commit at HEAD", async () => {
		const target = await createTarget();

		const { taskSha } = await seedTaskBoard(target.directory, seed, [
			"To Do",
			"Done",
		]);

		const subjects = await runCommand(
			["git", "log", "--format=%s"],
			target.directory,
		);
		expect(subjects).not.toContain("chore: configure project instructions");
		expect(taskSha).toBe(target.sha);
	});

	it("puts the board under ignored workflow state without a personal configuration", async () => {
		const target = await createTarget();

		await seedTaskBoard(target.directory, seed, ["To Do", "Done"]);

		expect(
			await readdir(join(target.directory, "backlog", "tasks")),
		).toHaveLength(1);
		expect(
			Bun.YAML.parse(
				await Bun.file(join(target.directory, "backlog", "config.yml")).text(),
			),
		).toMatchObject({ statuses: ["To Do", "Done"] });
	});

	it("preserves an existing custom board configuration", async () => {
		const target = await createTarget();
		await Bun.write(
			join(target.directory, "backlog.config.yml"),
			[
				'project_name: "Existing"',
				'default_status: "To Do"',
				'statuses: ["To Do"]',
				'task_prefix: "work"',
				'backlog_directory: "workflow-board"',
				"",
			].join("\n"),
		);

		await seedTaskBoard(target.directory, seed, ["To Do", "Done"]);

		expect(
			await readdir(join(target.directory, "workflow-board", "tasks")),
		).toHaveLength(1);
		expect(
			Bun.YAML.parse(
				await Bun.file(join(target.directory, "backlog.config.yml")).text(),
			),
		).toMatchObject({
			statuses: ["To Do", "Done"],
			task_prefix: "work",
		});
		expect(
			await runCommand(
				["git", "status", "--porcelain", "--untracked-files=all"],
				target.directory,
			),
		).toBe("");
	});

	it("escapes Git pattern characters in a custom board path", async () => {
		const target = await createTarget();
		await Bun.write(
			join(target.directory, "backlog.config.yml"),
			[
				'project_name: "Existing"',
				'default_status: "To Do"',
				'statuses: ["To Do", "Done"]',
				'backlog_directory: "board*"',
				"",
			].join("\n"),
		);

		await seedTaskBoard(target.directory, seed, ["To Do", "Done"]);
		await mkdir(join(target.directory, "board-source"));
		await Bun.write(
			join(target.directory, "board-source", "payload.ts"),
			"product source\n",
		);

		expect(
			await runCommand(
				["git", "status", "--porcelain", "--untracked-files=all"],
				target.directory,
			),
		).toBe("?? board-source/payload.ts\n");
		expect(
			await readdir(join(target.directory, "board*", "tasks")),
		).toHaveLength(1);
	});

	it("refuses to rewrite statuses in a tracked configuration", async () => {
		const target = await createTarget();
		const configPath = join(target.directory, "backlog.config.yml");
		const original = [
			'project_name: "Existing"',
			'default_status: "To Do"',
			'statuses: ["To Do"]',
			"task_prefix: work",
			'backlog_directory: "workflow-board"',
			"",
		].join("\n");
		await Bun.write(configPath, original);
		await runCommand(["git", "add", "backlog.config.yml"], target.directory);
		await runCommand(
			["git", "commit", "-m", "chore: configure backlog"],
			target.directory,
		);

		expect(
			seedTaskBoard(target.directory, seed, ["To Do", "Done"]),
		).rejects.toThrow("must already declare the pipeline statuses");
		expect(await Bun.file(configPath).text()).toBe(original);
		expect(
			await Bun.file(join(target.directory, "workflow-board")).exists(),
		).toBe(false);
	});

	it("keeps a compatible tracked configuration byte-for-byte", async () => {
		const target = await createTarget();
		const configPath = join(target.directory, "backlog.config.yml");
		await runCommand(
			[
				"backlog",
				"init",
				"Existing",
				"--defaults",
				"--integration-mode",
				"cli",
				"--agent-instructions",
				"none",
				"--backlog-dir",
				"workflow-board",
				"--config-location",
				"root",
				"--no-git",
			],
			target.directory,
		);
		const original = await Bun.file(configPath).text();
		await runCommand(["git", "add", "backlog.config.yml"], target.directory);
		await runCommand(
			["git", "commit", "-m", "chore: configure backlog"],
			target.directory,
		);

		await seedTaskBoard(target.directory, seed, [
			"To Do",
			"In Progress",
			"Done",
		]);

		expect(await Bun.file(configPath).text()).toBe(original);
		expect(
			await runCommand(
				["git", "status", "--porcelain", "--untracked-files=all"],
				target.directory,
			),
		).toBe("");
	});

	it("refuses a tracked configuration the pinned CLI would normalize", async () => {
		const target = await createTarget();
		const configPath = join(target.directory, "backlog", "config.yml");
		const original = [
			"project_name: Existing",
			"default_status: To Do",
			"statuses: [To Do, Done]",
			"task_prefix: work",
			"",
		].join("\n");
		await mkdir(join(target.directory, "backlog"));
		await Bun.write(configPath, original);
		await runCommand(
			["git", "add", "-f", "backlog/config.yml"],
			target.directory,
		);
		await runCommand(
			["git", "commit", "-m", "chore: configure backlog"],
			target.directory,
		);

		expect(
			seedTaskBoard(target.directory, seed, ["To Do", "Done"]),
		).rejects.toThrow("must already be normalized by the pinned Backlog CLI");
		expect(await Bun.file(configPath).text()).toBe(original);
		expect(
			await runCommand(
				["git", "status", "--porcelain", "--untracked-files=all"],
				target.directory,
			),
		).toBe("");
	});

	it("refuses a configured board path outside the target", async () => {
		const target = await createTarget();
		await Bun.write(
			join(target.directory, "backlog.config.yml"),
			[
				'project_name: "Existing"',
				'default_status: "To Do"',
				'statuses: ["To Do", "Done"]',
				'backlog_directory: "../outside"',
				"",
			].join("\n"),
		);

		expect(
			seedTaskBoard(target.directory, seed, ["To Do", "Done"]),
		).rejects.toThrow("must stay inside the target repository");
	});

	it("translates malformed configuration before changing private excludes", async () => {
		const target = await createTarget();
		const excludePath = join(target.directory, ".git", "info", "exclude");
		const originalExcludes = await Bun.file(excludePath).text();
		await Bun.write(
			join(target.directory, "backlog.config.yml"),
			"statuses: [unterminated\n",
		);

		expect(
			seedTaskBoard(target.directory, seed, ["To Do", "Done"]),
		).rejects.toThrow("Invalid Backlog configuration:");
		expect(await Bun.file(excludePath).text()).toBe(originalExcludes);
	});

	it("refuses a linked root configuration without changing its target", async () => {
		const target = await createTarget();
		const outside = join(target.directory, "outside.yml");
		const original = [
			'project_name: "Outside"',
			'statuses: ["To Do"]',
			"",
		].join("\n");
		await Bun.write(outside, original);
		await symlink(outside, join(target.directory, "backlog.config.yml"));

		expect(
			seedTaskBoard(target.directory, seed, ["To Do", "Done"]),
		).rejects.toThrow("is a link");
		expect(await Bun.file(outside).text()).toBe(original);
	});

	it("refuses a custom board beneath a linked directory", async () => {
		const target = await createTarget();
		await mkdir(join(target.directory, "actual"));
		await symlink(
			join(target.directory, "actual"),
			join(target.directory, "linked"),
		);
		await Bun.write(
			join(target.directory, "backlog.config.yml"),
			[
				'project_name: "Existing"',
				'statuses: ["To Do", "Done"]',
				'backlog_directory: "linked/board"',
				"",
			].join("\n"),
		);

		expect(
			seedTaskBoard(target.directory, seed, ["To Do", "Done"]),
		).rejects.toThrow("contains a link");
	});

	it("refuses Git administrative state as the board directory", async () => {
		const target = await createTarget();
		await Bun.write(
			join(target.directory, "backlog.config.yml"),
			[
				'project_name: "Existing"',
				'statuses: ["To Do", "Done"]',
				'backlog_directory: ".git"',
				"",
			].join("\n"),
		);

		expect(
			seedTaskBoard(target.directory, seed, ["To Do", "Done"]),
		).rejects.toThrow("must not use Git administrative state");
	});

	it("refuses a board directory that contains tracked source", async () => {
		const target = await createTarget();
		await mkdir(join(target.directory, "src"));
		await Bun.write(join(target.directory, "src", "app.ts"), "source\n");
		await Bun.write(
			join(target.directory, "backlog.config.yml"),
			[
				'project_name: "Existing"',
				'statuses: ["To Do", "Done"]',
				'backlog_directory: "src"',
				"",
			].join("\n"),
		);
		await runCommand(["git", "add", "src/app.ts"], target.directory);
		await runCommand(
			["git", "commit", "-m", "feat: add source"],
			target.directory,
		);

		expect(
			seedTaskBoard(target.directory, seed, ["To Do", "Done"]),
		).rejects.toThrow("must not contain tracked files: src/app.ts");
		expect(await Bun.file(join(target.directory, "src", "app.ts")).text()).toBe(
			"source\n",
		);
	});

	it("updates a block-list status configuration without leaving invalid YAML", async () => {
		const target = await createTarget();
		await mkdir(join(target.directory, ".backlog"));
		await Bun.write(
			join(target.directory, ".backlog", "config.yml"),
			[
				'project_name: "Existing"',
				'default_status: "To Do"',
				"statuses:",
				"  - To Do",
				"task_prefix: work",
				"",
			].join("\n"),
		);

		await seedTaskBoard(target.directory, seed, ["To Do", "Done"]);

		expect(
			Bun.YAML.parse(
				await Bun.file(join(target.directory, ".backlog", "config.yml")).text(),
			),
		).toMatchObject({ statuses: ["To Do", "Done"] });
		expect(
			await readdir(join(target.directory, ".backlog", "tasks")),
		).toHaveLength(1);
	});

	it("uses an existing hidden-folder board configuration", async () => {
		const target = await createTarget();
		await mkdir(join(target.directory, ".backlog"));
		await Bun.write(
			join(target.directory, ".backlog", "config.yml"),
			[
				'project_name: "Existing"',
				'default_status: "To Do"',
				'statuses: ["To Do"]',
				"",
			].join("\n"),
		);

		await seedTaskBoard(target.directory, seed, ["To Do", "Done"]);

		expect(
			await readdir(join(target.directory, ".backlog", "tasks")),
		).toHaveLength(1);
		expect(
			await Bun.file(join(target.directory, "backlog.config.yml")).exists(),
		).toBe(false);
	});

	it("reads back a card from the board it seeded", async () => {
		const target = await createTarget();

		const { taskId } = await seedTaskBoard(target.directory, seed, [
			"To Do",
			"Done",
		]);

		expect(await readTaskCard(target.directory, taskId)).toContain(
			"Add an audit log",
		);
	});

	it("completes a planning stage that wrote no document", async () => {
		const target = await createTarget();
		const { taskId } = await seedTaskBoard(target.directory, seed, [
			"To Do",
			"Done",
		]);
		const view = { task: { acceptanceCriteria: [{}], documentation: [] } };
		const stage = {
			name: "shape",
			kind: "planning",
			skill: "shape",
			rubric: "rubrics/shape.json",
			requiresAcceptanceCriteria: false,
		} as const;

		const completed = await assertPlanningStageCompleted(
			target.directory,
			target.sha,
			stage,
			{ output: taskId, view },
		);

		expect(completed.artifact).toBeUndefined();
	});

	it("leaves a target that ignores no board path clean", async () => {
		const target = await createTarget();
		const existingExcludes = "# retain this spacing\n\n";
		await Bun.write(
			join(target.directory, ".git", "info", "exclude"),
			existingExcludes,
		);
		await Bun.write(join(target.directory, ".gitignore"), "node_modules/\n");
		await runCommand(["git", "add", ".gitignore"], target.directory);
		await runCommand(
			["git", "commit", "-m", "chore: drop workflow ignores"],
			target.directory,
		);
		await seedTaskBoard(target.directory, seed, ["To Do", "Done"]);
		await mkdir(join(target.directory, "src", "backlog"), { recursive: true });
		await Bun.write(
			join(target.directory, "src", "backlog", "payload.ts"),
			"untracked payload\n",
		);
		expect(
			await Bun.file(join(target.directory, ".git", "info", "exclude")).text(),
		).toStartWith(existingExcludes);

		expect(
			await runCommand(
				["git", "status", "--porcelain", "--untracked-files=all"],
				target.directory,
			),
		).toBe("?? src/backlog/payload.ts\n");
	});

	it("writes private excludes through a linked worktree's common Git directory", async () => {
		const target = await createTarget();
		await Bun.write(join(target.directory, ".gitignore"), "node_modules/\n");
		await runCommand(["git", "add", ".gitignore"], target.directory);
		await runCommand(
			["git", "commit", "-m", "chore: drop workflow ignores"],
			target.directory,
		);
		await runCommand(["git", "switch", "-c", "primary"], target.directory);
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-worktree-"));
		testResources.track(parent);
		const worktree = join(parent, "main");
		await runCommand(
			["git", "worktree", "add", worktree, "main"],
			target.directory,
		);
		testResources.trackWorktree(target.directory, worktree);

		await seedTaskBoard(worktree, seed, ["To Do", "Done"]);

		const commonDirectory = await runCommand(
			["git", "rev-parse", "--git-common-dir"],
			worktree,
		);
		const exclude = await Bun.file(
			resolve(worktree, commonDirectory.trim(), "info", "exclude"),
		).text();
		expect(exclude).toContain("/backlog/");
		expect(
			await runCommand(
				["git", "status", "--porcelain", "--untracked-files=all"],
				worktree,
			),
		).toBe("");
	});
});
