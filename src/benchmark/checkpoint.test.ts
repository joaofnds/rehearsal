import { describe, expect, it } from "bun:test";
import { chmod, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { CheckpointRecord, HashedFile } from "./checkpoint";
import {
	captureStageCorpus,
	corpusDifferences,
	corpusLayoutRoots,
	deriveStaleness,
	initialCheckpointInputs,
	installStageCorpusSnapshot,
	lineageKey,
	materializeCheckpoint,
	recordCheckpoint,
	rootLineage,
	snapshotStageCorpus,
	stageCorpusRoots,
} from "./checkpoint";
import { CONTROL_DIR } from "./config";
import { liveCorpusRoot } from "./corpus-file";
import { TestResources } from "./test-support";

const testResources = TestResources.forEachTest();

describe(lineageKey.name, () => {
	const base = {
		upstream: "root-key",
		corpusFiles: [
			{ path: "CLAUDE.md", sha256: "aa11" },
			{ path: ".claude/skills/discuss/SKILL.md", sha256: "bb22" },
		],
		model: "sonnet",
		effort: "high",
	} as const;

	it("returns the same key for the same inputs", () => {
		expect(lineageKey({ ...base })).toBe(lineageKey({ ...base }));
	});

	it("ignores the order corpus files are listed in", () => {
		expect(
			lineageKey({ ...base, corpusFiles: base.corpusFiles.toReversed() }),
		).toBe(lineageKey(base));
	});

	it("changes when any lineage input changes", () => {
		const variants = [
			lineageKey({ ...base, upstream: "other-upstream" }),
			lineageKey({
				...base,
				corpusFiles: [
					base.corpusFiles[0],
					{ ...base.corpusFiles[1], sha256: "cc33" },
				],
			}),
			lineageKey({
				...base,
				corpusFiles: [
					...base.corpusFiles,
					{ path: "extra.md", sha256: "dd44" },
				],
			}),
			lineageKey({ ...base, model: "opus" }),
			lineageKey({ ...base, effort: "low" }),
			lineageKey({ ...base, effort: undefined }),
		];

		expect(new Set([lineageKey(base), ...variants]).size).toBe(
			variants.length + 1,
		);
	});
});

describe(captureStageCorpus.name, () => {
	async function corpusRoots(): Promise<[string, string]> {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-corpus-"));
		testResources.track(directory);
		const roots: [string, string] = [
			join(directory, "target"),
			join(directory, "home"),
		];
		await Promise.all(roots.map((root) => mkdir(root, { recursive: true })));

		return roots;
	}

	async function installSkill(
		root: string,
		skill: string,
		body: string,
	): Promise<void> {
		const directory = join(root, "skills", skill, "references");
		await mkdir(directory, { recursive: true });
		await Bun.write(join(root, "skills", skill, "SKILL.md"), body);
		await Bun.write(join(directory, "notes.md"), `${body} notes`);
	}

	async function installAgent(
		root: string,
		agent: string,
		body: string,
	): Promise<void> {
		await mkdir(join(root, "agents"), { recursive: true });
		await Bun.write(join(root, "agents", `${agent}.md`), body);
	}

	async function installOutputStyle(
		root: string,
		style: string,
		body: string,
	): Promise<void> {
		await mkdir(join(root, "output-styles"), { recursive: true });
		await Bun.write(join(root, "output-styles", `${style}.md`), body);
	}

	it("hashes the installed instructions and every skill file", async () => {
		const roots = await corpusRoots();
		await installSkill(roots[1], "doctrine", "doctrine skill");
		await installSkill(roots[1], "discuss", "discuss skill");

		const corpus = await captureStageCorpus("discuss", "instructions", roots);

		expect(corpus.map(({ path }) => path)).toEqual([
			"CLAUDE.md",
			"skills/doctrine/SKILL.md",
			"skills/doctrine/references/notes.md",
			"skills/discuss/SKILL.md",
			"skills/discuss/references/notes.md",
		]);
		expect(new Set(corpus.map(({ sha256 }) => sha256)).size).toBe(5);
	});

	it("records the same corpus wherever the same skill files live", async () => {
		const [targetRoot, homeRoot] = await corpusRoots();
		for (const root of [targetRoot, homeRoot]) {
			await installSkill(root, "doctrine", "doctrine skill");
			await installSkill(root, "discuss", "discuss skill");
		}

		const fromTarget = await captureStageCorpus("discuss", "instructions", [
			targetRoot,
		]);
		const fromHome = await captureStageCorpus("discuss", "instructions", [
			homeRoot,
		]);

		expect(fromTarget).toEqual(fromHome);
	});

	it("installs frozen skill bytes after their source changes", async () => {
		const roots = await corpusRoots();
		await installSkill(roots[1], "doctrine", "doctrine skill");
		await installSkill(roots[1], "discuss", "discuss skill");
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-corpus-snapshot-"));
		testResources.track(parent);
		const snapshotDirectory = join(parent, "snapshot");
		const firstWorktree = join(parent, "first");
		const secondWorktree = join(parent, "second");
		await Promise.all([
			mkdir(firstWorktree, { recursive: true }),
			mkdir(secondWorktree, { recursive: true }),
		]);
		const frozen = await snapshotStageCorpus(
			"discuss",
			"instructions",
			roots,
			snapshotDirectory,
		);

		await Bun.write(
			join(roots[1], "skills", "discuss", "SKILL.md"),
			"changed skill",
		);
		await Promise.all([
			installStageCorpusSnapshot(snapshotDirectory, firstWorktree),
			installStageCorpusSnapshot(snapshotDirectory, secondWorktree),
		]);

		const first = await captureStageCorpus("discuss", "instructions", [
			join(firstWorktree, ".claude"),
		]);
		const second = await captureStageCorpus("discuss", "instructions", [
			join(secondWorktree, ".claude"),
		]);
		expect(first).toEqual(frozen);
		expect(second).toEqual(frozen);
		expect(
			await Bun.file(
				join(firstWorktree, ".claude", "skills", "discuss", "SKILL.md"),
			).text(),
		).toBe("discuss skill");
	});

	it("removes a prior stage's agents and output styles the next stage's snapshot does not carry", async () => {
		const roots = await corpusRoots();
		await installSkill(roots[1], "doctrine", "doctrine skill");
		await installSkill(roots[1], "discuss", "discuss skill");
		await installSkill(roots[1], "build", "build skill");
		await installAgent(roots[1], "reviewer", "reviewer agent");
		const parent = await mkdtemp(join(tmpdir(), "rehearsal-corpus-snapshot-"));
		testResources.track(parent);
		const worktree = join(parent, "worktree");
		await mkdir(worktree, { recursive: true });

		const firstSnapshot = join(parent, "first-snapshot");
		await snapshotStageCorpus("discuss", "instructions", roots, firstSnapshot);
		await installStageCorpusSnapshot(firstSnapshot, worktree);
		expect(
			await stat(join(worktree, ".claude", "agents", "reviewer.md")),
		).toBeDefined();

		await rm(join(roots[1], "agents"), { recursive: true });
		const secondSnapshot = join(parent, "second-snapshot");
		await snapshotStageCorpus("build", "instructions", roots, secondSnapshot);
		await installStageCorpusSnapshot(secondSnapshot, worktree);

		expect(
			stat(join(worktree, ".claude", "agents", "reviewer.md")),
		).rejects.toThrow();
	});

	it("prefers the first root that has the skill", async () => {
		const roots = await corpusRoots();
		await installSkill(roots[1], "doctrine", "doctrine skill");
		await installSkill(roots[0], "discuss", "target copy");
		await installSkill(roots[1], "discuss", "home copy");

		const corpus = await captureStageCorpus("discuss", "instructions", roots);
		const homeOnly = await captureStageCorpus("discuss", "instructions", [
			roots[1],
		]);

		expect(corpus).not.toEqual(homeOnly);
	});

	it("fails naming the skill and the searched roots when none has it", async () => {
		const roots = await corpusRoots();
		await installSkill(roots[1], "doctrine", "doctrine skill");

		expect(
			captureStageCorpus("discuss", "instructions", roots),
		).rejects.toThrow(/discuss.*not installed/u);
	});

	it("hashes every global skill into each stage's corpus", async () => {
		const roots = await corpusRoots();
		await installSkill(roots[1], "discuss", "discuss skill");
		await installSkill(roots[1], "doctrine", "doctrine skill");

		const corpus = await captureStageCorpus("discuss", "instructions", roots);

		expect(corpus.map(({ path }) => path)).toEqual([
			"CLAUDE.md",
			"skills/doctrine/SKILL.md",
			"skills/doctrine/references/notes.md",
			"skills/discuss/SKILL.md",
			"skills/discuss/references/notes.md",
		]);
	});

	it("hashes a global skill once when it is also the stage's own skill", async () => {
		const roots = await corpusRoots();
		await installSkill(roots[1], "doctrine", "doctrine skill");

		const corpus = await captureStageCorpus("doctrine", "instructions", roots);

		expect(corpus.map(({ path }) => path)).toEqual([
			"CLAUDE.md",
			"skills/doctrine/SKILL.md",
			"skills/doctrine/references/notes.md",
		]);
	});

	it("changes every stage's corpus when a global skill file changes", async () => {
		const roots = await corpusRoots();
		await installSkill(roots[1], "discuss", "discuss skill");
		await installSkill(roots[1], "doctrine", "doctrine skill");
		const before = await captureStageCorpus("discuss", "instructions", roots);

		await installSkill(roots[1], "doctrine", "doctrine skill, revised");
		const after = await captureStageCorpus("discuss", "instructions", roots);

		expect(after).not.toEqual(before);
	});

	it("fails naming the global skill when it is not installed", async () => {
		const roots = await corpusRoots();
		await installSkill(roots[1], "discuss", "discuss skill");

		expect(
			captureStageCorpus("discuss", "instructions", roots),
		).rejects.toThrow(/doctrine.*not installed/u);
	});

	it("hashes every agent and output style file, project root first", async () => {
		const roots = await corpusRoots();
		await installSkill(roots[1], "doctrine", "doctrine skill");
		await installSkill(roots[1], "discuss", "discuss skill");
		await installAgent(roots[1], "reviewer", "reviewer agent");
		await installOutputStyle(roots[1], "brief", "brief style");

		const corpus = await captureStageCorpus("discuss", "instructions", roots);

		expect(corpus.map(({ path }) => path)).toEqual([
			"CLAUDE.md",
			"agents/reviewer.md",
			"output-styles/brief.md",
			"skills/doctrine/SKILL.md",
			"skills/doctrine/references/notes.md",
			"skills/discuss/SKILL.md",
			"skills/discuss/references/notes.md",
		]);
	});

	it("prefers the project root's whole agents directory over the user's", async () => {
		const roots = await corpusRoots();
		await installSkill(roots[1], "doctrine", "doctrine skill");
		await installSkill(roots[1], "discuss", "discuss skill");
		await installAgent(roots[0], "reviewer", "project reviewer");
		await installAgent(roots[1], "reviewer", "user reviewer");
		await installAgent(roots[1], "other", "user-only agent");

		const corpus = await captureStageCorpus("discuss", "instructions", roots);

		const agentFiles = corpus.filter(({ path }) => path.startsWith("agents/"));
		expect(agentFiles.map(({ path }) => path)).toEqual(["agents/reviewer.md"]);
	});

	it("captures no agents or output styles when neither root has them", async () => {
		const roots = await corpusRoots();
		await installSkill(roots[1], "doctrine", "doctrine skill");
		await installSkill(roots[1], "discuss", "discuss skill");

		const corpus = await captureStageCorpus("discuss", "instructions", roots);

		expect(corpus.some(({ path }) => path.startsWith("agents/"))).toBe(false);
		expect(corpus.some(({ path }) => path.startsWith("output-styles/"))).toBe(
			false,
		);
	});
});

describe(recordCheckpoint.name, () => {
	const checkpointInputs = {
		stage: "discuss",
		targetSha: "task-sha",
		upstream: "root-key",
		model: "sonnet",
		effort: "high",
		corpusFiles: [{ path: "CLAUDE.md", sha256: "aa11".repeat(16) }],
		artifacts: [
			{ path: "backlog/docs/DOC-1 - spec.md", sha256: "bb22".repeat(16) },
		],
	} as const;

	interface CheckpointFixture {
		readonly targetDir: string;
		readonly checkpointDir: string;
		readonly destination: string;
	}

	async function checkpointFixture(): Promise<CheckpointFixture> {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-checkpoint-"));
		testResources.track(directory);
		const targetDir = join(directory, "target");
		await mkdir(join(targetDir, "backlog", "docs"), { recursive: true });
		await mkdir(join(targetDir, ".boris"), { recursive: true });
		await Bun.write(join(targetDir, "backlog", "config.yml"), "statuses: []\n");
		await Bun.write(
			join(targetDir, "backlog", "docs", "DOC-1 - spec.md"),
			"the spec\n",
		);
		await Bun.write(join(targetDir, ".boris", "CONTEXT.md"), "context\n");
		await mkdir(join(targetDir, "backlog", "drafts"), { recursive: true });
		await Bun.write(join(targetDir, "ignored.ts"), "not workflow state\n");

		return {
			targetDir,
			checkpointDir: join(directory, "checkpoint"),
			destination: join(directory, "materialized"),
		};
	}

	it("materializes a recorded checkpoint byte-for-byte", async () => {
		const { targetDir, checkpointDir, destination } = await checkpointFixture();

		const record = await recordCheckpoint(
			targetDir,
			checkpointDir,
			checkpointInputs,
		);
		await mkdir(destination, { recursive: true });
		const materialized = await materializeCheckpoint(
			checkpointDir,
			destination,
		);

		expect(materialized).toEqual(record);
		expect(record.lineage).toBe(
			lineageKey({
				upstream: "root-key",
				corpusFiles: checkpointInputs.corpusFiles,
				model: "sonnet",
				effort: "high",
			}),
		);
		expect(record.workflowState.map(({ path }) => path).toSorted()).toEqual([
			".boris/CONTEXT.md",
			"backlog/config.yml",
			"backlog/docs/DOC-1 - spec.md",
		]);
		for (const { path } of record.workflowState) {
			expect(await Bun.file(join(destination, path)).bytes()).toEqual(
				await Bun.file(join(targetDir, path)).bytes(),
			);
		}
		expect(await Bun.file(join(destination, "ignored.ts")).exists()).toBe(
			false,
		);
		const draftsStats = await stat(join(destination, "backlog", "drafts"));
		expect(draftsStats.isDirectory()).toBe(true);
	});

	it("refuses to materialize a tampered snapshot, copying nothing", async () => {
		const { targetDir, checkpointDir, destination } = await checkpointFixture();
		await recordCheckpoint(targetDir, checkpointDir, checkpointInputs);
		await Bun.write(
			join(checkpointDir, "workflow-state", "backlog", "config.yml"),
			"tampered\n",
		);
		await mkdir(destination, { recursive: true });

		expect(materializeCheckpoint(checkpointDir, destination)).rejects.toThrow(
			/backlog\/config.yml/u,
		);
		expect(await readdir(destination)).toEqual([]);
	});

	it("refuses a snapshot carrying a file the record does not list", async () => {
		const { targetDir, checkpointDir, destination } = await checkpointFixture();
		await recordCheckpoint(targetDir, checkpointDir, checkpointInputs);
		await Bun.write(
			join(checkpointDir, "workflow-state", "backlog", "planted.md"),
			"planted\n",
		);
		await mkdir(destination, { recursive: true });

		expect(materializeCheckpoint(checkpointDir, destination)).rejects.toThrow(
			/backlog\/planted.md/u,
		);
		expect(await readdir(destination)).toEqual([]);
	});

	it("refuses a record whose paths escape the destination", async () => {
		const { targetDir, checkpointDir, destination } = await checkpointFixture();
		const record = await recordCheckpoint(
			targetDir,
			checkpointDir,
			checkpointInputs,
		);
		await Bun.write(
			join(checkpointDir, "checkpoint.json"),
			JSON.stringify({
				...record,
				workflowState: [
					{ path: "../../../etc/hosts", sha256: "aa11".repeat(16) },
				],
			}),
		);
		await mkdir(destination, { recursive: true });

		expect(materializeCheckpoint(checkpointDir, destination)).rejects.toThrow();
		expect(await readdir(destination)).toEqual([]);
	});

	it("fails on an unreadable workflow path instead of recording it absent", async () => {
		const { targetDir, checkpointDir } = await checkpointFixture();
		await chmod(targetDir, 0o000);

		try {
			expect(
				recordCheckpoint(targetDir, checkpointDir, checkpointInputs),
			).rejects.toThrow(/permission denied|EACCES/iu);
		} finally {
			await chmod(targetDir, 0o755);
		}
	});

	it("orders recorded files by codepoint, not locale", async () => {
		const { targetDir, checkpointDir } = await checkpointFixture();

		const record = await recordCheckpoint(targetDir, checkpointDir, {
			...checkpointInputs,
			artifacts: [
				{ path: "a.md", sha256: "aa11".repeat(16) },
				{ path: "B.md", sha256: "bb22".repeat(16) },
			],
		});

		expect(record.artifacts.map(({ path }) => path)).toEqual(["B.md", "a.md"]);
	});

	it("snapshots only the workflow paths that exist", async () => {
		const { targetDir, checkpointDir } = await checkpointFixture();
		await rm(join(targetDir, ".boris"), { force: true, recursive: true });

		const record = await recordCheckpoint(
			targetDir,
			checkpointDir,
			checkpointInputs,
		);

		expect(
			record.workflowState.every(({ path }) => path.startsWith("backlog/")),
		).toBe(true);
	});
});

describe(initialCheckpointInputs.name, () => {
	const root = {
		taskSha: "task-sha",
		task: "Task text",
		productBrief: "Brief text",
		workflowFiles: [{ path: "backlog/config.yml", sha256: "aa11" }],
	} as const;

	it("checkpoints the run's initial state under the reserved name", () => {
		const inputs = initialCheckpointInputs(root, "sonnet", "high");

		expect(inputs.stage).toBe("initial");
		expect(inputs.targetSha).toBe("task-sha");
		expect(inputs.upstream).toBe(rootLineage(root));
		expect(inputs.corpusFiles).toEqual([]);
		expect(inputs.artifacts).toEqual([]);
		expect(inputs.effort).toBe("high");
	});

	it("serializes without an effort key when the run declared none", () => {
		const inputs = initialCheckpointInputs(root, "sonnet");

		expect(inputs.effort).toBeUndefined();
		expect(JSON.stringify(inputs)).not.toContain('"effort"');
	});
});

describe(corpusDifferences.name, () => {
	const wording = {
		modified: (path: string) => `${path} changed`,
		missingFromRight: (path: string) => `${path} removed`,
		missingFromLeft: (path: string) => `${path} added`,
	};
	const file = { path: "a", sha256: "hash" } as const;

	it("reports path-unique differences in sorted order", () => {
		const differences = corpusDifferences(
			[
				{ path: "b", sha256: "same" },
				{ path: "a", sha256: "old" },
			],
			[
				{ path: "c", sha256: "same" },
				{ path: "a", sha256: "new" },
			],
			wording,
		);

		expect(differences).toEqual(["a changed", "b removed", "c added"]);
	});

	it("rejects a duplicate path in the left corpus", () => {
		expect(() => corpusDifferences([file, file], [file], wording)).toThrow(
			/Duplicate corpus path: a/u,
		);
	});

	it("rejects a duplicate path in the right corpus", () => {
		expect(() => corpusDifferences([file], [file, file], wording)).toThrow(
			/Duplicate corpus path: a/u,
		);
	});
});

describe(deriveStaleness.name, () => {
	const claudeMd = { path: "CLAUDE.md", sha256: "aa11" } as const;
	const doctrine = {
		path: "skills/doctrine/SKILL.md",
		sha256: "dd44",
	} as const;

	function checkpoint(
		stage: string,
		upstream: string,
		corpusFiles: readonly { readonly path: string; readonly sha256: string }[],
	): CheckpointRecord {
		const inputs = {
			stage,
			targetSha: `${stage}-sha`,
			upstream,
			model: "sonnet",
			effort: "high",
			corpusFiles,
			artifacts: [],
		} as const;

		return {
			...inputs,
			lineage: lineageKey(inputs),
			workflowState: [],
		};
	}

	const initial = checkpoint("initial", "root-key", []);
	const planning = checkpoint("shape", initial.lineage, [
		claudeMd,
		doctrine,
		{ path: "skills/shape/SKILL.md", sha256: "bb22" },
	]);
	const build = checkpoint("build", planning.lineage, [
		claudeMd,
		doctrine,
		{ path: "skills/build/SKILL.md", sha256: "cc33" },
	]);
	const chain = [initial, planning, build] as const;

	function currentCorpus(
		...edits: readonly (readonly [string, readonly HashedFile[]])[]
	): Map<string, readonly HashedFile[]> {
		const corpus = new Map<string, readonly HashedFile[]>(
			chain
				.filter(({ stage }) => stage !== "initial")
				.map((record) => [record.stage, record.corpusFiles]),
		);
		for (const [stage, files] of edits) {
			corpus.set(stage, files);
		}

		return corpus;
	}

	const request = { model: "sonnet", effort: "high" } as const;

	it("reports every checkpoint fresh when nothing changed", () => {
		const staleness = deriveStaleness(chain, currentCorpus(), request);

		expect(staleness.map(({ stage, stale }) => [stage, stale])).toEqual([
			["initial", false],
			["shape", false],
			["build", false],
		]);
	});

	it("marks the edited stage and everything downstream stale, naming the file", () => {
		const staleness = deriveStaleness(
			chain,
			currentCorpus([
				"shape",
				[
					claudeMd,
					doctrine,
					{ path: "skills/shape/SKILL.md", sha256: "changed" },
				],
			]),
			request,
		);

		expect(staleness.map(({ stage, stale }) => [stage, stale])).toEqual([
			["initial", false],
			["shape", true],
			["build", true],
		]);
		expect(staleness[1]?.causes).toEqual(["skills/shape/SKILL.md changed"]);
		expect(staleness[2]?.causes).toEqual(["upstream stage shape is stale"]);
	});

	it("blames the first stale stage, not the nearest, further down the chain", () => {
		const review = checkpoint("review", build.lineage, [
			claudeMd,
			doctrine,
			{ path: "skills/review/SKILL.md", sha256: "ee55" },
		]);
		const longer = [initial, planning, build, review] as const;
		const edited: readonly HashedFile[] = [
			claudeMd,
			doctrine,
			{ path: "skills/shape/SKILL.md", sha256: "changed" },
		];
		const corpus = new Map<string, readonly HashedFile[]>(
			longer
				.filter(({ stage }) => stage !== "initial")
				.map((record) => [
					record.stage,
					record.stage === "shape" ? edited : record.corpusFiles,
				]),
		);

		const staleness = deriveStaleness(longer, corpus, request);

		expect(staleness.map(({ stale }) => stale)).toEqual([
			false,
			true,
			true,
			true,
		]);
		expect(staleness[3]?.causes).toEqual(["upstream stage shape is stale"]);
	});

	it("marks every stage checkpoint stale when a global instruction file changes", () => {
		const edited = { path: "CLAUDE.md", sha256: "edited" } as const;
		const staleness = deriveStaleness(
			chain,
			currentCorpus(
				[
					"shape",
					[edited, doctrine, { path: "skills/shape/SKILL.md", sha256: "bb22" }],
				],
				[
					"build",
					[edited, doctrine, { path: "skills/build/SKILL.md", sha256: "cc33" }],
				],
			),
			request,
		);

		expect(staleness.map(({ stale }) => stale)).toEqual([false, true, true]);
		expect(staleness[1]?.causes).toEqual(["CLAUDE.md changed"]);
	});

	it("marks every stage checkpoint stale when a global skill file changes", () => {
		const edited = {
			path: "skills/doctrine/SKILL.md",
			sha256: "edited",
		} as const;
		const staleness = deriveStaleness(
			chain,
			currentCorpus(
				[
					"shape",
					[claudeMd, edited, { path: "skills/shape/SKILL.md", sha256: "bb22" }],
				],
				[
					"build",
					[claudeMd, edited, { path: "skills/build/SKILL.md", sha256: "cc33" }],
				],
			),
			request,
		);

		expect(staleness.map(({ stale }) => stale)).toEqual([false, true, true]);
		expect(staleness[1]?.causes).toEqual(["skills/doctrine/SKILL.md changed"]);
	});

	it("marks every checkpoint including the initial one stale on a model change", () => {
		const staleness = deriveStaleness(chain, currentCorpus(), {
			model: "opus",
			effort: "high",
		});

		expect(staleness.map(({ stale }) => stale)).toEqual([true, true, true]);
		expect(staleness[0]?.causes).toEqual(["model sonnet is now opus"]);
	});

	it("marks every checkpoint including the initial one stale on an effort change", () => {
		const staleness = deriveStaleness(chain, currentCorpus(), {
			model: "sonnet",
			effort: "low",
		});

		expect(staleness.map(({ stale }) => stale)).toEqual([true, true, true]);
		expect(staleness[0]?.causes).toEqual(["effort high is now low"]);
	});

	it("names a corpus file the record has and the corpus no longer does", () => {
		const staleness = deriveStaleness(
			chain,
			currentCorpus(["shape", [claudeMd, doctrine]]),
			request,
		);

		expect(staleness[1]?.stale).toBe(true);
		expect(staleness[1]?.causes).toEqual(["skills/shape/SKILL.md removed"]);
	});

	it("names a corpus file the corpus has and the record does not", () => {
		const staleness = deriveStaleness(
			chain,
			currentCorpus([
				"shape",
				[
					claudeMd,
					doctrine,
					{ path: "skills/shape/SKILL.md", sha256: "bb22" },
					{ path: "skills/shape/references/new.md", sha256: "ee55" },
				],
			]),
			request,
		);

		expect(staleness[1]?.stale).toBe(true);
		expect(staleness[1]?.causes).toEqual([
			"skills/shape/references/new.md added",
		]);
	});
});

describe(rootLineage.name, () => {
	const base = {
		taskSha: "task-sha",
		task: "Task text",
		productBrief: "Brief text",
		workflowFiles: [{ path: "backlog/config.yml", sha256: "aa11" }],
	} as const;

	it("returns the same key for the same initial state", () => {
		expect(rootLineage({ ...base })).toBe(rootLineage({ ...base }));
	});

	it("changes when any part of the initial state changes", () => {
		const variants = [
			rootLineage({ ...base, taskSha: "other-sha" }),
			rootLineage({ ...base, task: "Other task" }),
			rootLineage({ ...base, productBrief: "Other brief" }),
			rootLineage({ ...base, workflowFiles: [] }),
		];

		expect(new Set([rootLineage(base), ...variants]).size).toBe(
			variants.length + 1,
		);
	});
});

describe(corpusLayoutRoots.name, () => {
	it("searches the project layout root before the user's", () => {
		expect(corpusLayoutRoots("/target")).toEqual([
			"/target/.claude",
			join(homedir(), ".claude"),
		]);
	});
});

describe(stageCorpusRoots.name, () => {
	it("searches project level before user level for the live install", () => {
		expect(stageCorpusRoots({ kind: "live", root: liveCorpusRoot() })).toEqual(
			corpusLayoutRoots(CONTROL_DIR),
		);
	});

	it.each(["directory", "chezmoi"] as const)(
		"searches only the resolved root for a %s corpus",
		(kind) => {
			expect(stageCorpusRoots({ kind, root: "/variants/brief" })).toEqual([
				"/variants/brief",
			]);
		},
	);
});
