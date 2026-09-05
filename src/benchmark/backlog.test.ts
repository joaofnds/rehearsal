import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	assertStageArtifactState,
	seedTaskBoard,
	parseTaskState,
	readTaskCard,
} from "./backlog";
import { runCommand } from "./command";
import { StageValidationError } from "./contracts";
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

	it("adds no CLAUDE.md to the target tree", async () => {
		const target = await testResources.createRepository();

		await seedTaskBoard(target.directory, seed, ["To Do", "Done"]);

		expect(await Bun.file(join(target.directory, "CLAUDE.md")).exists()).toBe(
			false,
		);
	});

	it("writes no instructions commit, leaving the base commit at HEAD", async () => {
		const target = await testResources.createRepository();

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

	it("puts the board where the base configuration says, under the ignored workflow state", async () => {
		const target = await testResources.createRepository();

		await seedTaskBoard(target.directory, seed, ["To Do", "Done"]);

		expect(
			await readdir(join(target.directory, ".boris", "backlog", "tasks")),
		).toHaveLength(1);
	});

	it("leaves a target that ignores no board path clean", async () => {
		const target = await testResources.createRepository();
		await Bun.write(join(target.directory, ".gitignore"), "node_modules/\n");
		await runCommand(["git", "add", ".gitignore"], target.directory);
		await runCommand(
			["git", "commit", "-m", "chore: drop workflow ignores"],
			target.directory,
		);

		await seedTaskBoard(target.directory, seed, ["To Do", "Done"]);

		expect(
			await runCommand(["git", "status", "--porcelain"], target.directory),
		).toBe("");
	});
});
