import { createHash } from "node:crypto";
import {
	commitProjectInstructions,
	createBacklogTask,
	listBacklogTaskIds,
	parseTaskSeed,
	readTaskState,
} from "../benchmark/backlog";
import { git } from "../benchmark/target";
import type { SqliteStorage } from "../storage/sqlite-storage";

export type TargetSetupPoint =
	| "AFTER_TASK_CREATED"
	| "AFTER_INSTRUCTIONS_COMMITTED";

export interface TargetSetupBarrier {
	reach(point: TargetSetupPoint): Promise<void> | void;
}

export class TargetSetup {
	constructor(
		private readonly storage: SqliteStorage,
		private readonly barrier?: TargetSetupBarrier,
	) {}

	async run(input: {
		readonly confirmedRetry?: boolean;
		readonly instructions: string;
		readonly runId: string;
		readonly targetRoot: string;
		readonly targetSha: string;
		readonly task: string;
	}) {
		let setup = this.storage.readTargetSetup(input.runId);
		if (setup?.state === "SUCCEEDED") return setup;
		if (!setup) {
			const [branch, sha, status, preTaskIds] = await Promise.all([
				git(input.targetRoot, "branch", "--show-current"),
				git(input.targetRoot, "rev-parse", "HEAD"),
				git(
					input.targetRoot,
					"status",
					"--porcelain=v1",
					"--untracked-files=all",
				),
				listBacklogTaskIds(input.targetRoot),
			]);
			if (branch !== "main" || sha !== input.targetSha || status !== "") {
				throw new Error("Target setup facts differ from the authorized baseline");
			}
			const expected = parseTaskSeed(input.task);
			setup = this.storage.createTargetSetupIntent({
				expectedDescription: expected.description,
				expectedTitle: expected.title,
				instructionSha256: sha256(input.instructions),
				originalBranch: branch,
				originalSha: sha,
				originalStatus: status,
				preTaskIds,
				runId: input.runId,
				targetRoot: input.targetRoot,
			});
		}
		if (!setup) throw new Error("Target setup intent was not persisted");
		if (setup.state === "UNCERTAIN") {
			if (!input.confirmedRetry) {
				throw new Error("Target setup retry requires explicit confirmation");
			}
			this.storage.retryTargetSetup(input.runId);
			setup = this.storage.readTargetSetup(input.runId);
		}
		if (setup?.state === "INTENDED") this.storage.startTargetSetup(input.runId);
		if (!setup) throw new Error("Target setup intent disappeared");
		const durableSetup = setup;

		try {
			let observed = await this.observe(durableSetup, input.instructions);
			if (observed.classification === "ALL_BEFORE") {
				await createBacklogTask(input.targetRoot, input.task);
				await this.barrier?.reach("AFTER_TASK_CREATED");
				observed = await this.observe(durableSetup, input.instructions);
			}
			if (observed.classification === "TASK_CREATED") {
				await commitProjectInstructions(input.targetRoot, input.instructions);
				await this.barrier?.reach("AFTER_INSTRUCTIONS_COMMITTED");
				observed = await this.observe(durableSetup, input.instructions);
			}
			if (observed.classification !== "ALL_AFTER") {
				throw new TargetSetupDivergedError(observed);
			}
			this.storage.completeTargetSetup({
				observed,
				runId: input.runId,
				setupSha: observed.sha,
				taskId: observed.taskId,
			});

			return this.storage.readTargetSetup(input.runId);
		} catch (error) {
			const observed = await this.observe(durableSetup, input.instructions);
			const noEffect = observed.classification === "ALL_BEFORE";
			this.storage.finishTargetSetupFailure({
				message: error instanceof Error ? error.message : String(error),
				observed,
				runId: input.runId,
				state: noEffect ? "FAILED" : "UNCERTAIN",
			});
			throw error;
		}
	}

	private async observe(
		setup: NonNullable<ReturnType<SqliteStorage["readTargetSetup"]>>,
		instructions: string,
	) {
		const [branch, sha, status, taskIds] = await Promise.all([
			git(setup.targetRoot, "branch", "--show-current"),
			git(setup.targetRoot, "rev-parse", "HEAD"),
			git(
				setup.targetRoot,
				"status",
				"--porcelain=v1",
				"--untracked-files=all",
			),
			listBacklogTaskIds(setup.targetRoot),
		]);
		const preTaskIds = new Set(setup.preTaskIds);
		const addedTaskIds = taskIds.filter((id) => !preTaskIds.has(id));
		const matches: string[] = [];
		for (const taskId of addedTaskIds) {
			const task = (await readTaskState(setup.targetRoot, taskId)).view.task;
			if (
				task.title === setup.expectedTitle &&
				task.description === setup.expectedDescription
			) {
				matches.push(taskId);
			}
		}
		const facts = { addedTaskIds, branch, matches, sha, status };
		if (
			branch === setup.originalBranch &&
			sha === setup.originalSha &&
			status === setup.originalStatus &&
			addedTaskIds.length === 0
		) {
			return { ...facts, classification: "ALL_BEFORE" as const };
		}
		if (
			branch === setup.originalBranch &&
			sha === setup.originalSha &&
			status === setup.originalStatus &&
			addedTaskIds.length === 1 &&
			matches.length === 1
		) {
			return {
				...facts,
				classification: "TASK_CREATED" as const,
				taskId: matches[0] as string,
			};
		}
		if (
			status === "" &&
			addedTaskIds.length === 1 &&
			matches.length === 1 &&
			(await this.isExactSetupCommit(setup, instructions, sha))
		) {
			return {
				...facts,
				classification: "ALL_AFTER" as const,
				taskId: matches[0] as string,
			};
		}

		return { ...facts, classification: "DIVERGED" as const };
	}

	private async isExactSetupCommit(
		setup: NonNullable<ReturnType<SqliteStorage["readTargetSetup"]>>,
		instructions: string,
		sha: string,
	) {
		const [parent, subject, paths, content] = await Promise.all([
			git(setup.targetRoot, "rev-parse", `${sha}^`),
			git(setup.targetRoot, "log", "-1", "--pretty=%s", sha),
			git(setup.targetRoot, "diff-tree", "--no-commit-id", "--name-only", "-r", sha),
			git(setup.targetRoot, "show", `${sha}:CLAUDE.md`),
		]);

		return (
			parent === setup.originalSha &&
			subject === setup.expectedCommitSubject &&
			paths === "CLAUDE.md" &&
			sha256(content) === setup.instructionSha256 &&
			content === instructions
		);
	}
}

class TargetSetupDivergedError extends Error {
	constructor(readonly observed: unknown) {
		super("Target setup facts diverged from the persisted intent");
	}
}

function sha256(value: string) {
	return createHash("sha256").update(value).digest("hex");
}
