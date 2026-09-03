import { describe, expect, it } from "bun:test";
import { homedir } from "node:os";
import { mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";
import { resolveCorpusFile } from "#benchmark/corpus-file";
import type {
	ChezmoiCorpusSource,
	CommandRunner,
} from "#benchmark/corpus-source";
import {
	CorpusSourceError,
	corpusLayoutEntries,
	resolveCorpusSource,
} from "#benchmark/corpus-source";
import { TestResources } from "#benchmark/test-support";
import { failureOf } from "#cli/cli-test-support";

const resources = TestResources.forEachTest();

async function directoryCorpus(): Promise<string> {
	const root = await resources.createControlDirectory();
	await Bun.write(join(root, "output-styles/brief.md"), "variant\n");

	return root;
}

describe(resolveCorpusSource.name, () => {
	it("resolves a directory source to a directory-kind source rooted there", async () => {
		const root = await directoryCorpus();

		const source = await resolveCorpusSource(root);

		expect(source.kind).toBe("directory");
		expect(source.root).toBe(root);
	});

	it("resolves an absent source to the live install", async () => {
		const source = await resolveCorpusSource(undefined);

		expect(source.kind).toBe("live");
		expect(source.root).toBe(join(homedir(), ".claude"));
	});
});

describe("refusing a source that names no corpus", () => {
	it("refuses a directory that does not exist, naming the root", async () => {
		const failure = await failureOf(
			resolveCorpusSource("/no/such/corpus/directory"),
		);

		expect(failure).toBeInstanceOf(CorpusSourceError);
		expect(failure.message).toContain("/no/such/corpus/directory");
		expect(failure.message).toContain("chezmoi:<ref>");
	});

	it("refuses a directory holding none of the corpus layout entries, naming the root", async () => {
		const root = await resources.createControlDirectory();
		await Bun.write(join(root, "notes.md"), "not corpus\n");

		const failure = await failureOf(resolveCorpusSource(root));

		expect(failure).toBeInstanceOf(CorpusSourceError);
		expect(failure.message).toContain(root);
	});

	it.each(["CLAUDE.md", "skills/build/SKILL.md", "agents/reviewer.md"])(
		"accepts a directory holding %s alone",
		async (layoutPath) => {
			const root = await resources.createControlDirectory();
			await Bun.write(join(root, layoutPath), "corpus\n");

			const source = await resolveCorpusSource(root);

			expect(source.kind).toBe("directory");
		},
	);

	it("refuses chezmoi: with no ref, naming the source", async () => {
		const failure = await failureOf(resolveCorpusSource("chezmoi:"));

		expect(failure).toBeInstanceOf(CorpusSourceError);
		expect(failure.message).toContain("chezmoi:");
	});
});

describe("resolving a corpus file against a source", () => {
	it("reads a layout path from the directory source's root", async () => {
		const root = await directoryCorpus();

		expect(
			resolveCorpusFile(
				await resolveCorpusSource(root),
				"output-styles/brief.md",
			),
		).toBe(join(root, "output-styles/brief.md"));
	});

	it("reads a layout path from the live install when the source is live", async () => {
		expect(
			resolveCorpusFile(
				await resolveCorpusSource(undefined),
				"output-styles/brief.md",
			),
		).toBe(join(homedir(), ".claude/output-styles/brief.md"));
	});
});

interface RecordedCommand {
	readonly command: readonly string[];
	readonly cwd: string;
}

/**
 * The real shell decides whether a pipeline failed, so `fails` is how a test
 * says which command the shell would have returned nonzero for: `runCommand`
 * turns a nonzero exit into a rejection, and that is what the fake reproduces.
 */
class FakeCommandRunner {
	public readonly commands: RecordedCommand[] = [];

	public constructor(
		private readonly outputs: ReadonlyMap<string, string>,
		private readonly fails: (command: readonly string[]) => boolean = () =>
			false,
	) {}

	public readonly run = (
		command: readonly string[],
		cwd: string,
	): Promise<string> => {
		this.commands.push({ command: [...command], cwd });

		if (this.fails(command)) {
			return Promise.reject(new Error("git archive failed: exit 129"));
		}

		return Promise.resolve(this.outputs.get(command[0] ?? "") ?? "");
	};
}

const RESOLVED_COMMIT = "0123456789abcdef0123456789abcdef01234567";

describe("rendering a chezmoi corpus source", () => {
	function runner(): FakeCommandRunner {
		return new FakeCommandRunner(new Map([["git", `${RESOLVED_COMMIT}\n`]]));
	}

	async function rendered(
		source: string,
		run: CommandRunner,
	): Promise<ChezmoiCorpusSource> {
		const resolved = await resolveCorpusSource(source, {
			runCommand: run,
			dotfilesDirectory: "/dotfiles",
		});
		if (resolved.kind !== "chezmoi") {
			throw new Error(`Expected a chezmoi source, got ${resolved.kind}`);
		}

		return resolved;
	}

	it("archives the ref into a scratch source and applies it with both exclusions and no --verbose", async () => {
		const fake = runner();

		const source = await rendered("chezmoi:HEAD~1", fake.run);
		resources.track(source.root);
		resources.track(source.sourceDirectory);

		const commands = fake.commands.map((recorded) => recorded.command);
		const archive = commands.find((command) => command[0] === "sh");
		const apply = commands.find((command) => command[0] === "chezmoi");
		expect(archive).toEqual([
			"sh",
			"-c",
			`set -o pipefail; git -C '/dotfiles' archive 'HEAD~1' | tar -x -C '${source.sourceDirectory}'`,
		]);
		expect(apply).toEqual([
			"chezmoi",
			"apply",
			"--source",
			source.sourceDirectory,
			"--destination",
			source.root,
			"--exclude",
			"encrypted,scripts",
		]);
		expect(apply?.includes("--verbose")).toBe(false);
	});

	/**
	 * The ref is a flag value and the archive needs a pipe, so it reaches a
	 * shell. Unquoted, `HEAD; rm -rf ~` would run as a second command.
	 */
	it("quotes the ref it passes to the shell, so a ref cannot carry a second command", async () => {
		const fake = runner();

		const source = await rendered("chezmoi:HEAD; touch /tmp/pwned", fake.run);
		resources.track(source.root);
		resources.track(source.sourceDirectory);

		const archive = fake.commands
			.map((recorded) => recorded.command)
			.find((command) => command[0] === "sh");
		expect(archive?.[2]).toBe(
			`set -o pipefail; git -C '/dotfiles' archive 'HEAD; touch /tmp/pwned' | tar -x -C '${source.sourceDirectory}'`,
		);
	});

	/**
	 * Criterion 8 records the ref's resolved commit sha, and an unvalidated
	 * `rev-parse` result is whatever git echoed back: under the option
	 * injection it was the literal `--output=<path>`.
	 */
	it.each(["--output=/tmp/victim.txt", "not a sha", "abc123", ""])(
		"refuses %p as a resolved commit, which is not a sha",
		async (resolved) => {
			const fake = new FakeCommandRunner(new Map([["git", `${resolved}\n`]]));

			const failure = await failureOf(
				resolveCorpusSource("chezmoi:HEAD", {
					runCommand: fake.run,
					dotfilesDirectory: "/dotfiles",
				}),
			);

			expect(failure).toBeInstanceOf(CorpusSourceError);
			expect(failure.message).toContain("HEAD");
		},
	);

	/**
	 * `tar` succeeds on an empty stream, so without `pipefail` the pipeline
	 * reports tar's exit code and a failed archive renders an empty tree that
	 * the attempt then measures and records lineage over.
	 */
	it("fails the render when the archive step fails, rather than reporting tar's success", async () => {
		const fake = new FakeCommandRunner(
			new Map([["git", `${RESOLVED_COMMIT}\n`]]),
			(command) =>
				command[0] === "sh" &&
				(command[2] ?? "").startsWith("set -o pipefail; "),
		);

		const failure = await failureOf(
			resolveCorpusSource("chezmoi:HEAD", {
				runCommand: fake.run,
				dotfilesDirectory: "/dotfiles",
			}),
		);

		expect(failure.message).toContain("archive failed");
	});

	it("makes the pipeline's own failure the shell's exit status", async () => {
		const fake = runner();

		const source = await rendered("chezmoi:HEAD", fake.run);
		resources.track(source.root);
		resources.track(source.sourceDirectory);

		const archive = fake.commands
			.map((recorded) => recorded.command)
			.find((command) => command[0] === "sh");
		expect(archive?.[2]).toStartWith("set -o pipefail; ");
	});

	/**
	 * `git archive` parses its ref as an option, so a ref opening with a dash
	 * reaches argv as `--output=<path>` and truncates that file before failing.
	 * `git rev-parse` echoes such a string back and exits 0, so resolving it
	 * first does not catch it.
	 */
	it.each([
		"--output=/tmp/rehearsal-victim.txt",
		"--add-file=/etc/passwd",
		"--add-virtual-file=x:y",
		"-o/tmp/rehearsal-victim.txt",
	])("refuses the ref %s, which git would read as an option", async (ref) => {
		const fake = runner();

		const failure = await failureOf(
			resolveCorpusSource(`chezmoi:${ref}`, {
				runCommand: fake.run,
				dotfilesDirectory: "/dotfiles",
			}),
		);

		expect(failure).toBeInstanceOf(CorpusSourceError);
		expect(failure.message).toContain(ref);
		expect(fake.commands).toEqual([]);
	});

	it("resolves the ref to a commit, so a ref naming no commit is refused", async () => {
		const fake = runner();

		const source = await rendered("chezmoi:HEAD", fake.run);
		resources.track(source.root);
		resources.track(source.sourceDirectory);

		expect(
			fake.commands
				.map((recorded) => recorded.command)
				.find((command) => command[0] === "git"),
		).toEqual([
			"git",
			"-C",
			"/dotfiles",
			"rev-parse",
			"--verify",
			"--end-of-options",
			"HEAD^{commit}",
		]);
	});

	it("records the ref's resolved commit rather than the ref string", async () => {
		const fake = runner();

		const source = await rendered("chezmoi:HEAD", fake.run);
		resources.track(source.root);
		resources.track(source.sourceDirectory);

		expect(source.kind).toBe("chezmoi");
		expect(source.ref).toBe("HEAD");
		expect(source.commit).toBe(RESOLVED_COMMIT);
	});
});

describe(corpusLayoutEntries.name, () => {
	async function renderedHomeTree(): Promise<string> {
		const root = await resources.createControlDirectory();
		await Bun.write(join(root, ".agents/skills/style/SKILL.md"), "style\n");
		await Bun.write(join(root, ".agents/agents/reviewer.md"), "reviewer\n");
		await Bun.write(join(root, ".claude/output-styles/brief.md"), "brief\n");
		await mkdir(join(root, ".claude"), { recursive: true });
		await symlink(
			"/Users/joaofnds/.agents/skills",
			join(root, ".claude/skills"),
		);

		return root;
	}

	it("maps the rendered .agents and .claude paths onto corpus layout", async () => {
		const root = await renderedHomeTree();

		const entries = await corpusLayoutEntries({
			kind: "chezmoi",
			ref: "HEAD",
			commit: "abc",
			root,
			sourceDirectory: root,
		});

		expect(entries).toEqual([
			{
				layoutPath: "skills/style",
				sourcePath: join(root, ".agents/skills/style"),
			},
			{
				layoutPath: "agents/reviewer.md",
				sourcePath: join(root, ".agents/agents/reviewer.md"),
			},
			{
				layoutPath: "output-styles/brief.md",
				sourcePath: join(root, ".claude/output-styles/brief.md"),
			},
		]);
	});

	it("never reads through the .claude/skills symlink into the live corpus", async () => {
		const root = await renderedHomeTree();

		const entries = await corpusLayoutEntries({
			kind: "chezmoi",
			ref: "HEAD",
			commit: "abc",
			root,
			sourceDirectory: root,
		});

		expect(
			entries.every(
				(entry) => !entry.sourcePath.startsWith(join(root, ".claude/skills")),
			),
		).toBe(true);
	});

	it("lists a directory source's own layout entries", async () => {
		const root = await resources.createControlDirectory();
		await Bun.write(join(root, "output-styles/brief.md"), "variant\n");
		await Bun.write(join(root, "CLAUDE.md"), "instructions\n");

		const entries = await corpusLayoutEntries(await resolveCorpusSource(root));

		expect(entries.map((entry) => entry.layoutPath).toSorted()).toEqual([
			"CLAUDE.md",
			"output-styles/brief.md",
		]);
	});
});
