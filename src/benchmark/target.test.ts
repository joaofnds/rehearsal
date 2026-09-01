import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "./command";
import { StageValidationError } from "./contracts";
import {
	addWorktree,
	assertBuildCommitted,
	assertCommitSubjects,
	assertSourceReady,
	assertWorkspaceCleanAt,
	capturePlanningAdvance,
	captureWorkflowBackup,
	claimTarget,
	removeWorktree,
	restoreTarget,
	teardownTarget,
} from "./target";
import { TestResources, commitAll } from "./test-support";

const testResources = TestResources.forEachTest();

describe(assertCommitSubjects.name, () => {
	const conventional = String.raw`^[a-z]+(?:\([^)]+\))?!?: .+`;

	it("accepts subjects matching the pipeline's convention", () => {
		expect(() => {
			assertCommitSubjects(
				["feat(audit): add worker", "fix: wire persistence"],
				conventional,
			);
		}).not.toThrow();
	});

	it("rejects subjects outside the pipeline's convention", () => {
		expect(() => {
			assertCommitSubjects(["Implement audit"], conventional);
		}).toThrow("do not match the pipeline's convention");
	});

	it("holds subjects to whatever convention the pipeline declares", () => {
		expect(() => {
			assertCommitSubjects(["add audit worker"], "^[a-z]");
		}).not.toThrow();
	});
});

describe(assertBuildCommitted.name, () => {
	it("returns only the stage's commit subjects oldest first", async () => {
		const source = await testResources.createRepository();
		await Bun.write(
			join(source.directory, "first.ts"),
			"export const first = 1;\n",
		);
		await commitAll(source.directory, "add first change");
		await Bun.write(
			join(source.directory, "second.ts"),
			"export const second = 2;\n",
		);
		await commitAll(source.directory, "add second change");

		const build = await assertBuildCommitted(source.directory, source.sha);

		expect(build.commitSubjects).toEqual([
			"add first change",
			"add second change",
		]);
	});

	it("accepts a build committed on a detached replay worktree", async () => {
		const source = await testResources.createRepository();
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-worktree-"));
		testResources.track(parent);
		const worktree = join(parent, "worktree");
		await addWorktree(source.directory, source.sha, worktree);
		await Bun.write(join(worktree, "feature.ts"), "export const built = 1;\n");
		await commitAll(worktree, "feat: build in replay worktree");

		const build = await assertBuildCommitted(worktree, source.sha, null);

		expect(build.diff).toContain("feature.ts");
		expect(assertBuildCommitted(worktree, source.sha)).rejects.toBeInstanceOf(
			StageValidationError,
		);
		await removeWorktree(source.directory, worktree);
	});

	it("classifies rewritten task history as candidate validation failure", async () => {
		const source = await testResources.createRepository();
		await runCommand(
			["git", "switch", "--orphan", "rewritten"],
			source.directory,
		);
		await Bun.write(join(source.directory, "rewritten.txt"), "rewritten\n");
		await commitAll(source.directory, "feat: rewrite history");
		await runCommand(["git", "branch", "-M", "main"], source.directory);

		expect(
			assertBuildCommitted(source.directory, source.sha),
		).rejects.toBeInstanceOf(StageValidationError);
	});
});

describe(addWorktree.name, () => {
	it("gives a replay a detached checkout without touching the primary", async () => {
		const source = await testResources.createRepository();
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-worktree-"));
		testResources.track(parent);
		const worktree = join(parent, "worktree");

		await addWorktree(source.directory, source.sha, worktree);

		expect(await Bun.file(join(worktree, "base.txt")).text()).toBe("base\n");
		const worktreeBranch = await runCommand(
			["git", "branch", "--show-current"],
			worktree,
		);
		expect(worktreeBranch.trim()).toBe("");
		const primaryBranch = await runCommand(
			["git", "branch", "--show-current"],
			source.directory,
		);
		expect(primaryBranch.trim()).toBe("main");

		await removeWorktree(source.directory, worktree);

		expect(await Bun.file(join(worktree, "base.txt")).exists()).toBe(false);
	});

	it("removes a worktree that holds uncommitted replay state", async () => {
		const source = await testResources.createRepository();
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-worktree-"));
		testResources.track(parent);
		const worktree = join(parent, "worktree");
		await addWorktree(source.directory, source.sha, worktree);
		await Bun.write(join(worktree, "backlog", "task.md"), "workflow state\n");

		await removeWorktree(source.directory, worktree);

		expect(await Bun.file(join(worktree, "base.txt")).exists()).toBe(false);
	});
});

describe(capturePlanningAdvance.name, () => {
	it("captures commits a planning stage added on the baseline", async () => {
		const source = await testResources.createRepository();
		await Bun.write(join(source.directory, "GLOSSARY.md"), "audit log\n");
		await commitAll(source.directory, "add project glossary");
		const head = await runCommand(
			["git", "rev-parse", "HEAD"],
			source.directory,
		);

		const advance = await capturePlanningAdvance(source.directory, source.sha);

		expect(advance.resultSha).toBe(head.trim());
		expect(advance.changedPaths).toEqual(["GLOSSARY.md"]);
		expect(advance.diff).toContain("audit log");
		expect(advance.commitSubjects).toEqual(["add project glossary"]);
	});

	it("captures an empty advance when the stage committed nothing", async () => {
		const source = await testResources.createRepository();

		const advance = await capturePlanningAdvance(source.directory, source.sha);

		expect(advance).toEqual({
			resultSha: source.sha,
			diff: "",
			changedPaths: [],
		});
	});

	it("rejects a stage that rewrote the baseline history", async () => {
		const source = await testResources.createRepository();
		await runCommand(
			["git", "commit", "--amend", "--no-edit", "-m", "chore: rewritten"],
			source.directory,
		);

		expect(
			capturePlanningAdvance(source.directory, source.sha),
		).rejects.toThrow("rewrote or discarded task history");
	});

	it("rejects a stage that left the worktree dirty", async () => {
		const source = await testResources.createRepository();
		await Bun.write(join(source.directory, "stray.md"), "uncommitted\n");

		expect(
			capturePlanningAdvance(source.directory, source.sha),
		).rejects.toThrow("Target baseline changed unexpectedly");
	});
});

describe(assertWorkspaceCleanAt.name, () => {
	it("accepts a clean detached worktree when no branch is expected", async () => {
		const source = await testResources.createRepository();
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-worktree-"));
		testResources.track(parent);
		const worktree = join(parent, "worktree");
		await addWorktree(source.directory, source.sha, worktree);

		expect(
			assertWorkspaceCleanAt(worktree, source.sha, null),
		).resolves.toBeUndefined();
		expect(assertWorkspaceCleanAt(worktree, source.sha)).rejects.toBeInstanceOf(
			StageValidationError,
		);
	});

	it("rejects a workspace that left its detached checkout for a branch", async () => {
		const source = await testResources.createRepository();
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-worktree-"));
		testResources.track(parent);
		const worktree = join(parent, "worktree");
		await addWorktree(source.directory, source.sha, worktree);
		await runCommand(["git", "switch", "-c", "stray"], worktree);

		expect(
			assertWorkspaceCleanAt(worktree, source.sha, null),
		).rejects.toBeInstanceOf(StageValidationError);
	});
});

describe(assertSourceReady.name, () => {
	it("rejects a clean repository off main", async () => {
		const source = await testResources.createRepository();
		await runCommand(["git", "switch", "-c", "feature"], source.directory);

		expect(assertSourceReady(source.directory)).rejects.toThrow(
			"Target must be on main",
		);
	});

	it("rejects a repository subdirectory", async () => {
		const source = await testResources.createRepository();
		const subdirectory = join(source.directory, "nested");
		await mkdir(subdirectory);

		expect(assertSourceReady(subdirectory)).rejects.toThrow(
			"Target must be the repository root",
		);
	});
});

describe(restoreTarget.name, () => {
	it("restores main after generated commits and files", async () => {
		const source = await testResources.createRepository();
		const baseline = await assertSourceReady(source.directory);
		await Bun.write(
			join(source.directory, "generated.ts"),
			"export const value = 1;\n",
		);
		await commitAll(source.directory, "feat: generate change");
		await Bun.write(join(source.directory, "unfinished.ts"), "unfinished\n");

		await restoreTarget(baseline);

		expect(
			await runCommand(["git", "rev-parse", "HEAD"], source.directory),
		).toBe(`${source.sha}\n`);
		expect(
			await runCommand(["git", "status", "--porcelain"], source.directory),
		).toBe("");
		expect(
			await Bun.file(join(source.directory, "generated.ts")).exists(),
		).toBe(false);
		expect(
			await Bun.file(join(source.directory, "unfinished.ts")).exists(),
		).toBe(false);
	});

	it("returns the target to main from a stage branch", async () => {
		const source = await testResources.createRepository();
		const baseline = await assertSourceReady(source.directory);
		await runCommand(["git", "switch", "-c", "agent-work"], source.directory);
		await Bun.write(join(source.directory, "stray.ts"), "export {};\n");
		await commitAll(source.directory, "feat: stray branch work");

		await restoreTarget(baseline);

		const restoredBranch = await runCommand(
			["git", "branch", "--show-current"],
			source.directory,
		);
		expect(restoredBranch.trim()).toBe("main");
		const restoredSha = await runCommand(
			["git", "rev-parse", "HEAD"],
			source.directory,
		);
		expect(restoredSha.trim()).toBe(source.sha);
	});

	it("preserves every workflow path that existed before the run", async () => {
		const source = await testResources.createRepository();
		const backlogDirectory = join(source.directory, "backlog");
		const borisDirectory = join(source.directory, ".boris");
		await mkdir(backlogDirectory);
		await mkdir(borisDirectory);
		await Bun.write(join(backlogDirectory, "original.md"), "original\n");
		await Bun.write(join(borisDirectory, "CONTEXT.md"), "context\n");
		const baseline = await assertSourceReady(source.directory);
		const backup = await captureWorkflowBackup(source.directory);
		testResources.track(backup.directory);
		await Bun.write(join(backlogDirectory, "original.md"), "changed\n");
		await Bun.write(join(backlogDirectory, "generated.md"), "generated\n");
		await Bun.write(join(borisDirectory, "CONTEXT.md"), "rewritten\n");

		await restoreTarget(baseline, backup);

		expect(await Bun.file(join(backlogDirectory, "original.md")).text()).toBe(
			"original\n",
		);
		expect(
			await Bun.file(join(backlogDirectory, "generated.md")).exists(),
		).toBe(false);
		expect(await Bun.file(join(borisDirectory, "CONTEXT.md")).text()).toBe(
			"context\n",
		);
	});
});

describe(claimTarget.name, () => {
	it("refuses a target an unrestored run left claimed", async () => {
		const source = await testResources.createRepository();
		const baseline = await assertSourceReady(source.directory);
		await claimTarget(baseline);

		expect(claimTarget(baseline)).rejects.toThrow(
			"previous benchmark run left this target unrestored",
		);
	});

	it("releases the claim after a verified restore", async () => {
		const source = await testResources.createRepository();
		const baseline = await assertSourceReady(source.directory);
		await claimTarget(baseline);

		await restoreTarget(baseline);

		expect(claimTarget(baseline)).resolves.toBeUndefined();
	});

	it("claims a linked-worktree target whose .git is a file", async () => {
		const source = await testResources.createRepository();
		await runCommand(["git", "switch", "-c", "primary"], source.directory);
		const worktreeParent = await mkdtemp(join(tmpdir(), "rehearsal-worktree-"));
		testResources.track(worktreeParent);
		const worktree = join(worktreeParent, "main");
		await runCommand(
			["git", "worktree", "add", worktree, "main"],
			source.directory,
		);
		const baseline = await assertSourceReady(worktree);

		await claimTarget(baseline);

		expect(claimTarget(baseline)).rejects.toThrow(
			"previous benchmark run left this target unrestored",
		);
		await restoreTarget(baseline);
		expect(claimTarget(baseline)).resolves.toBeUndefined();
	});
});

describe(teardownTarget.name, () => {
	it("discards the workflow backup after a verified restore", async () => {
		const source = await testResources.createRepository();
		const baseline = await assertSourceReady(source.directory);
		const backup = await captureWorkflowBackup(source.directory);
		testResources.track(backup.directory);
		await Bun.write(join(source.directory, "candidate.ts"), "export {};\n");
		await commitAll(source.directory, "feat: candidate");

		await teardownTarget(baseline, backup);

		const finalSha = await runCommand(
			["git", "rev-parse", "HEAD"],
			source.directory,
		);
		expect(finalSha.trim()).toBe(source.sha);
		expect(stat(backup.directory)).rejects.toThrow();
	});

	it("keeps the workflow backup when the restore fails", async () => {
		const source = await testResources.createRepository();
		const backup = await captureWorkflowBackup(source.directory);
		testResources.track(backup.directory);
		const broken = {
			root: source.directory,
			sha: "0000000000000000000000000000000000000000",
		};

		expect(teardownTarget(broken, backup)).rejects.toThrow();
		expect(stat(backup.directory)).resolves.toBeDefined();
	});
});
