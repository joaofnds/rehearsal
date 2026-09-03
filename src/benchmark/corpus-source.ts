import { mkdtemp, readdir, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runCommand } from "./command";
import { pathExists } from "./file-presence";

export class CorpusSourceError extends Error {
	public override name = "CorpusSourceError";
}

export interface LiveCorpusSource {
	readonly kind: "live";
	readonly root: string;
}

export interface DirectoryCorpusSource {
	readonly kind: "directory";
	readonly root: string;
}

/**
 * A rendered chezmoi source keeps its scratch directories so the render can be
 * deleted once its bytes are snapshotted: the render is the whole home layout,
 * of which only the corpus kinds are read.
 */
export interface ChezmoiCorpusSource {
	readonly kind: "chezmoi";
	readonly root: string;
	readonly ref: string;
	readonly commit: string;
	readonly sourceDirectory: string;
}

/**
 * Where an attempt's corpus bytes come from, parsed once so nothing downstream
 * learns whether they were rendered, copied, or read from the live install:
 * `root` is the only thing hashing and installing ever see.
 */
export type ResolvedCorpusSource =
	| LiveCorpusSource
	| DirectoryCorpusSource
	| ChezmoiCorpusSource;

export type CommandRunner = (
	command: readonly string[],
	cwd: string,
) => Promise<string>;

export interface CorpusSourceDependencies {
	readonly runCommand: CommandRunner;
	readonly dotfilesDirectory: string;
}

export function liveCorpusRoot(): string {
	return join(homedir(), ".claude");
}

export function defaultCorpusSourceDependencies(): CorpusSourceDependencies {
	return {
		runCommand: (command, cwd) => runCommand(command, cwd),
		dotfilesDirectory: join(homedir(), "code", "dotfiles"),
	};
}

const CHEZMOI_SCHEME = "chezmoi:";

/**
 * The entries a directory must hold at least one of to be a corpus. Without
 * this a mistyped path resolves to an empty corpus, and every declared file
 * then fails one at a time instead of the source failing once.
 */
const CORPUS_LAYOUT_ENTRIES: readonly string[] = [
	"CLAUDE.md",
	"skills",
	"output-styles",
	"agents",
];

async function holdsCorpusLayout(root: string): Promise<boolean> {
	for (const entry of CORPUS_LAYOUT_ENTRIES) {
		if (await pathExists(join(root, entry))) {
			return true;
		}
	}

	return false;
}

async function directorySource(source: string): Promise<DirectoryCorpusSource> {
	const root = resolve(source);
	if (!(await pathExists(root))) {
		throw new CorpusSourceError(
			`Corpus source ${root} is neither an existing directory nor a chezmoi:<ref> source`,
		);
	}
	if (!(await holdsCorpusLayout(root))) {
		throw new CorpusSourceError(
			`Corpus source ${root} holds no corpus layout entry: expected one of ${CORPUS_LAYOUT_ENTRIES.join(", ")}`,
		);
	}

	return { kind: "directory", root };
}

/**
 * `git archive` reads its ref positionally but still parses it as an option
 * first, so `--output=<path>` truncates that path before failing, and
 * `git rev-parse` echoes the same string back and exits 0 rather than catching
 * it. Refusing a leading dash before either command runs is what closes the
 * argv layer; quoting only ever closed the shell layer.
 */
function optionRefRefusal(ref: string): CorpusSourceError | undefined {
	if (!ref.startsWith("-")) {
		return undefined;
	}

	return new CorpusSourceError(
		`Corpus source chezmoi:${ref} names a ref opening with a dash, which git reads as an option rather than a ref`,
	);
}

/**
 * The archive needs a pipe, so it goes through a shell, and the ref is a flag
 * value: unquoted, `HEAD; rm -rf ~` would run as a second command. Single
 * quotes make a POSIX shell take every byte literally, and the only byte that
 * can end them is a quote itself.
 */
function shellQuoted(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`;
}

function scratchDirectory(prefix: string): Promise<string> {
	return mkdtemp(join(tmpdir(), prefix));
}

/**
 * `--verbose` stalls chezmoi 2.72.0 through a pipe and the gpg-encrypted file
 * blocks on a passphrase without `--exclude encrypted`, so neither the flag nor
 * the exclusions are a preference: without them the render hangs an autonomous
 * run.
 */
async function renderChezmoi(
	ref: string,
	dependencies: CorpusSourceDependencies,
): Promise<ChezmoiCorpusSource> {
	const { runCommand: run, dotfilesDirectory } = dependencies;
	const revParse = await run(
		[
			"git",
			"-C",
			dotfilesDirectory,
			"rev-parse",
			"--verify",
			"--end-of-options",
			`${ref}^{commit}`,
		],
		tmpdir(),
	);
	const commit = revParse.trim();
	const sourceDirectory = await scratchDirectory("rehearsal-chezmoi-source-");
	const root = await scratchDirectory("rehearsal-chezmoi-render-");

	try {
		await run(
			[
				"sh",
				"-c",
				`git -C ${shellQuoted(dotfilesDirectory)} archive ${shellQuoted(ref)} | tar -x -C ${shellQuoted(sourceDirectory)}`,
			],
			tmpdir(),
		);
		await run(
			[
				"chezmoi",
				"apply",
				"--source",
				sourceDirectory,
				"--destination",
				root,
				"--exclude",
				"encrypted,scripts",
			],
			tmpdir(),
		);
	} catch (error) {
		await rm(sourceDirectory, { force: true, recursive: true });
		await rm(root, { force: true, recursive: true });

		throw error;
	}

	return { kind: "chezmoi", ref, commit, root, sourceDirectory };
}

/**
 * One corpus file or skill directory a source holds, named by where it lands in
 * corpus layout and where its bytes are read from. The snapshot copies these,
 * so nothing after it reads the source tree again.
 */
export interface CorpusLayoutEntry {
	readonly layoutPath: string;
	readonly sourcePath: string;
}

async function entriesUnder(
	directory: string,
	layoutPrefix: string,
): Promise<CorpusLayoutEntry[]> {
	const names = await readdir(directory).catch(() => []);

	return names
		.toSorted((left, right) => left.localeCompare(right))
		.map((name) => ({
			layoutPath: `${layoutPrefix}/${name}`,
			sourcePath: join(directory, name),
		}));
}

/**
 * A chezmoi render is the whole home layout, and its `.claude/skills`,
 * `.claude/agents`, and `.claude/CLAUDE.md` are symlinks into the live
 * `~/.agents`: following one would hash and install the live corpus while
 * claiming to have rendered a ref, so the real files under `.agents` are read
 * instead. The render carries no project CLAUDE.md.
 */
const CHEZMOI_LAYOUT: readonly (readonly [string, string])[] = [
	[".agents/skills", "skills"],
	[".agents/agents", "agents"],
	[".claude/output-styles", "output-styles"],
];

const INSTALLED_LAYOUT: readonly (readonly [string, string])[] = [
	["skills", "skills"],
	["agents", "agents"],
	["output-styles", "output-styles"],
];

/**
 * Every corpus file a source holds, in corpus layout. This is where a source's
 * shape stops mattering: the snapshot copies these entries and nothing after it
 * knows whether they were rendered or read from an install.
 */
export async function corpusLayoutEntries(
	source: ResolvedCorpusSource,
): Promise<readonly CorpusLayoutEntry[]> {
	const layout = source.kind === "chezmoi" ? CHEZMOI_LAYOUT : INSTALLED_LAYOUT;
	const entries: CorpusLayoutEntry[] = [];

	for (const [sourceRelative, layoutPrefix] of layout) {
		entries.push(
			...(await entriesUnder(join(source.root, sourceRelative), layoutPrefix)),
		);
	}

	const instructions = join(source.root, "CLAUDE.md");
	if (source.kind !== "chezmoi" && (await pathExists(instructions))) {
		entries.unshift({ layoutPath: "CLAUDE.md", sourcePath: instructions });
	}

	return entries;
}

/**
 * The source string is parsed once here, at the boundary, so a caller that
 * holds a resolved source cannot be holding a directory that does not exist or
 * a chezmoi ref that was never named.
 */
export function resolveCorpusSource(
	source: string | undefined,
	dependencies: CorpusSourceDependencies = defaultCorpusSourceDependencies(),
): Promise<ResolvedCorpusSource> {
	if (source === undefined) {
		return Promise.resolve({ kind: "live", root: liveCorpusRoot() });
	}
	if (source.startsWith(CHEZMOI_SCHEME)) {
		const ref = source.slice(CHEZMOI_SCHEME.length);
		if (ref === "") {
			return Promise.reject(
				new CorpusSourceError(
					`Corpus source ${source} names no chezmoi ref: use chezmoi:<ref>`,
				),
			);
		}

		const refusal = optionRefRefusal(ref);
		if (refusal !== undefined) {
			return Promise.reject(refusal);
		}

		return renderChezmoi(ref, dependencies);
	}

	return directorySource(source);
}
