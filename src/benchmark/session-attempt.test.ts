import { describe, expect, it } from "bun:test";
import {
	mkdir,
	mkdtemp,
	readdir,
	realpath,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { SessionCase } from "#benchmark/case";
import type { Immutable } from "#benchmark/contracts";
import { projectSlug } from "#benchmark/session-capture";
import { failureOf } from "#cli/cli-test-support";
import type { SessionCorpusSnapshot } from "#benchmark/session-corpus";
import { TestResources } from "#benchmark/test-support";
import type { SessionAttemptRequest } from "#benchmark/session-attempt";
import {
	forkTranscript,
	runSessionAttempt,
	sessionCaseArgs,
	SessionInputError,
} from "#benchmark/session-attempt";

const resources = TestResources.forEachTest();

const SOURCE_SESSION = "11111111-1111-1111-1111-111111111111";
const WRITTEN_SESSION = "99999999-9999-9999-9999-999999999999";

function envelope(result: string): string {
	return JSON.stringify({
		type: "result",
		subtype: "success",
		session_id: WRITTEN_SESSION,
		is_error: false,
		result,
		total_cost_usd: 0.0012,
		num_turns: 1,
		duration_ms: 900,
		duration_api_ms: 800,
		usage: {
			input_tokens: 12,
			output_tokens: 3,
			cache_read_input_tokens: 0,
			cache_creation_input_tokens: 0,
		},
	});
}

function transcriptLine(sessionId: string, text: string): string {
	return JSON.stringify({
		type: "assistant",
		sessionId,
		message: { content: [{ type: "text", text }] },
	});
}

function sessionCase(
	overrides: Immutable<Partial<SessionCase>> = {},
): SessionCase {
	return {
		kind: "session",
		declaration: {
			id: "probe",
			kind: "session",
			title: "Probe",
			prompt: "Reply with the single word OK.",
			tools: [],
			corpusFiles: [],
			checks: [{ kind: "word-band", max: 1 }],
		},
		fixturePath: undefined,
		transcriptPath: undefined,
		prompt: "Reply with the single word OK.",
		tools: [],
		settings: undefined,
		agents: undefined,
		corpusFiles: [],
		checks: [{ kind: "word-band", max: 1 }],
		...overrides,
	};
}

interface FakeRun {
	readonly command: readonly string[];
	readonly cwd: string;
	readonly seenFiles: readonly string[];
}

function namedSession(command: readonly string[]): string {
	const named = command.indexOf("--session-id");

	return (
		command[(named === -1 ? command.indexOf("--resume") : named) + 1] ?? ""
	);
}

/**
 * The provider writes the session file under the id the command line named it,
 * and the harness reads it back from the slug directory, so the fake does the
 * same. Nothing here depends on where that name sorts among the directory's
 * other entries.
 */
class FakeClaude {
	private readonly calls: FakeRun[] = [];

	public constructor(
		private readonly projects: string,
		private readonly reply: string,
	) {}

	public get runs(): readonly FakeRun[] {
		return this.calls;
	}

	public readonly run: SessionAttemptRequest["runClaude"] = async (
		command,
		cwd,
	) => {
		this.calls.push({
			command: [...command],
			cwd,
			seenFiles: await readdir(cwd, { recursive: true }),
		});
		const sessionId = namedSession(command);
		const slug = join(this.projects, projectSlug(await realpath(cwd)));
		await mkdir(slug, { recursive: true });
		await writeFile(
			join(slug, `${sessionId}.jsonl`),
			`${transcriptLine(sessionId, this.reply)}\n`,
		);

		return envelope(this.reply);
	};
}

function projectsRoot(): Promise<string> {
	return mkdtemp(join(tmpdir(), "rehearsal-attempt-projects-"));
}

function recordDirectory(): Promise<string> {
	return mkdtemp(join(tmpdir(), "rehearsal-attempt-record-"));
}

function request(
	overrides: Immutable<Partial<SessionAttemptRequest>> & {
		readonly projectsDirectory: string;
		readonly recordDirectory: string;
		readonly runClaude: SessionAttemptRequest["runClaude"];
	},
): SessionAttemptRequest {
	return {
		sessionCase: sessionCase(),
		settings: { model: "haiku", effort: "low", budgetUsd: 0.2 },
		...overrides,
	};
}

describe(sessionCaseArgs.name, () => {
	const settings = { model: "haiku", effort: "low", budgetUsd: 0.2 } as const;

	function args(
		overrides: Immutable<Partial<SessionCase>> = {},
		resume?: string,
	): readonly string[] {
		return sessionCaseArgs(
			sessionCase(overrides),
			settings,
			resume === undefined
				? { sessionId: WRITTEN_SESSION, resumed: false }
				: { sessionId: resume, resumed: true },
		);
	}

	function valueAfter(
		flags: readonly string[],
		flag: string,
	): string | undefined {
		const index = flags.indexOf(flag);

		return index === -1 ? undefined : flags[index + 1];
	}

	it("disables every tool with an empty --tools for an empty declared list", () => {
		expect(valueAfter(args(), "--tools")).toBe("");
	});

	it("joins the declared tool names into one --tools value", () => {
		expect(valueAfter(args({ tools: ["Read", "Bash"] }), "--tools")).toBe(
			"Read,Bash",
		);
	});

	it("passes the declared settings as inline JSON", () => {
		const flags = args({ settings: { outputStyle: "brief" } });

		expect(valueAfter(flags, "--settings")).toBe('{"outputStyle":"brief"}');
	});

	it("omits --settings when the case declares none", () => {
		expect(args()).not.toContain("--settings");
	});

	it("passes the declared agents as inline JSON", () => {
		const flags = args({ agents: { reviewer: { description: "r" } } });

		expect(valueAfter(flags, "--agents")).toBe(
			'{"reviewer":{"description":"r"}}',
		);
	});

	it("omits --agents when the case declares none", () => {
		expect(args()).not.toContain("--agents");
	});

	it("carries the session knobs, the JSON envelope, and the budget", () => {
		const flags = args();

		expect(valueAfter(flags, "--model")).toBe("haiku");
		expect(valueAfter(flags, "--effort")).toBe("low");
		expect(valueAfter(flags, "--max-budget-usd")).toBe("0.2");
		expect(valueAfter(flags, "--output-format")).toBe("json");
	});

	it("resumes the forked session when a transcript is declared", () => {
		expect(valueAfter(args({}, "fresh-uuid"), "--resume")).toBe("fresh-uuid");
	});

	it("omits --resume when no transcript is declared", () => {
		expect(args()).not.toContain("--resume");
	});

	it("names the session it is about to create when no transcript is declared", () => {
		expect(valueAfter(args(), "--session-id")).toBe(WRITTEN_SESSION);
	});

	it("omits --session-id when it resumes a forked session instead", () => {
		expect(args({}, "fresh-uuid")).not.toContain("--session-id");
	});

	it.each(["--no-session-persistence", "--json-schema"])(
		"never passes %s, which would discard the transcript or force a schema",
		(flag) => {
			expect(
				args({ tools: ["Read"], settings: { style: "brief" } }, "uuid"),
			).not.toContain(flag);
		},
	);
});

describe("the corpus overlay a session attempt installs", () => {
	async function snapshotHolding(
		layoutPath: string,
		contents: string,
	): Promise<SessionCorpusSnapshot> {
		const root = await resources.createControlDirectory();
		await Bun.write(join(root, layoutPath), contents);

		return {
			kind: "directory",
			root,
			origin: { kind: "directory", source: root },
			declaredPaths: [layoutPath],
		};
	}

	it("places the snapshot's output style where the session reads it", async () => {
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");

		await runSessionAttempt(
			request({
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: claude.run,
				corpusSnapshot: await snapshotHolding(
					"output-styles/brief.md",
					"marker style\n",
				),
			}),
		);

		expect(claude.runs[0]?.seenFiles).toContain(
			join(".claude", "output-styles", "brief.md"),
		);
	});

	it("selects the snapshot's output style with --settings", async () => {
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");

		await runSessionAttempt(
			request({
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: claude.run,
				corpusSnapshot: await snapshotHolding(
					"output-styles/brief.md",
					"marker style\n",
				),
			}),
		);

		const command = claude.runs[0]?.command ?? [];
		expect(
			JSON.parse(command[command.indexOf("--settings") + 1] ?? "{}"),
		).toEqual({ outputStyle: "brief" });
	});

	it("merges the style selection over the case's declared settings rather than replacing them", async () => {
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");

		await runSessionAttempt(
			request({
				sessionCase: sessionCase({
					settings: { permissions: { defaultMode: "plan" } },
				}),
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: claude.run,
				corpusSnapshot: await snapshotHolding(
					"output-styles/brief.md",
					"marker style\n",
				),
			}),
		);

		const command = claude.runs[0]?.command ?? [];
		expect(
			JSON.parse(command[command.indexOf("--settings") + 1] ?? "{}"),
		).toEqual({
			permissions: { defaultMode: "plan" },
			outputStyle: "brief",
		});
	});

	/**
	 * A corpus holds files no case declared, and the whole point of `--corpus` is
	 * a second style: selecting the first one found would run the attempt against
	 * a style the case never named while recording the declared one in lineage.
	 */
	it("selects and installs only the style the case declared, never a second one the corpus holds", async () => {
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");
		const root = await resources.createControlDirectory();
		await Bun.write(join(root, "output-styles/aardvark.md"), "undeclared\n");
		await Bun.write(join(root, "output-styles/brief.md"), "declared\n");

		await runSessionAttempt(
			request({
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: claude.run,
				corpusSnapshot: {
					kind: "directory",
					root,
					origin: { kind: "directory", source: root },
					declaredPaths: ["output-styles/brief.md"],
				},
			}),
		);

		const command = claude.runs[0]?.command ?? [];
		expect(
			JSON.parse(command[command.indexOf("--settings") + 1] ?? "{}"),
		).toEqual({ outputStyle: "brief" });
		expect(claude.runs[0]?.seenFiles).toContain(
			join(".claude", "output-styles", "brief.md"),
		);
		expect(claude.runs[0]?.seenFiles).not.toContain(
			join(".claude", "output-styles", "aardvark.md"),
		);
	});

	it("leaves the attempt directory bare when the corpus is the live install", async () => {
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");

		await runSessionAttempt(
			request({
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: claude.run,
			}),
		);

		expect(claude.runs[0]?.seenFiles).toEqual([]);
		expect(claude.runs[0]?.command).not.toContain("--settings");
	});
});

describe(forkTranscript.name, () => {
	it("rewrites every occurrence of the source session id and changes nothing else", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-fork-"));
		const source = join(directory, "source.jsonl");
		const forked = join(directory, "forked.jsonl");
		const bytes = [
			transcriptLine(SOURCE_SESSION, "first"),
			transcriptLine(SOURCE_SESSION, "second"),
		].join("\n");
		await writeFile(source, `${bytes}\n`);

		await forkTranscript(source, forked, SOURCE_SESSION, "fresh-uuid");

		expect(await Bun.file(forked).text()).toBe(
			`${bytes.replaceAll(SOURCE_SESSION, "fresh-uuid")}\n`,
		);
	});

	it("keeps a source that ends without a newline ending without one", async () => {
		const directory = await mkdtemp(join(tmpdir(), "rehearsal-fork-"));
		const source = join(directory, "source.jsonl");
		const forked = join(directory, "forked.jsonl");
		const bytes = [
			transcriptLine(SOURCE_SESSION, "first"),
			transcriptLine(SOURCE_SESSION, "second"),
		].join("\n");
		await writeFile(source, bytes);

		await forkTranscript(source, forked, SOURCE_SESSION, "fresh-uuid");

		expect(await Bun.file(forked).text()).toBe(
			bytes.replaceAll(SOURCE_SESSION, "fresh-uuid"),
		);
	});
});

function resumingCase(transcriptPath: string, sha256: string): SessionCase {
	const base = sessionCase({ transcriptPath });

	return {
		...base,
		declaration: {
			...base.declaration,
			transcript: {
				file: "prefix.jsonl",
				sha256,
				sourceSession: SOURCE_SESSION,
				cut: 1,
			},
		},
	};
}

async function writtenPrefix(text: string): Promise<PrefixOnDisk> {
	const directory = await mkdtemp(join(tmpdir(), "rehearsal-prefix-"));
	const path = join(directory, "prefix.jsonl");
	await writeFile(path, text);

	return {
		path,
		sha256: new Bun.CryptoHasher("sha256").update(text).digest("hex"),
	};
}

interface PrefixOnDisk {
	readonly path: string;
	readonly sha256: string;
}

/**
 * A resumed headless session keeps its session id and appends to the file it
 * resumed, so the slug listing gains no entry and the transcript to read back
 * is the forked file itself. Observed on claude 2.1.258.
 */
function appendingClaude(
	projects: string,
	reply: string,
): SessionAttemptRequest["runClaude"] {
	return async (command, cwd) => {
		const resumed = command[command.indexOf("--resume") + 1] ?? "";

		const slug = join(projects, projectSlug(await realpath(cwd)));
		const file = join(slug, `${resumed}.jsonl`);
		await writeFile(
			file,
			`${await Bun.file(file).text()}${transcriptLine(resumed, reply)}\n`,
		);

		return envelope(reply);
	};
}

describe(runSessionAttempt.name, () => {
	it("runs in a fresh directory that is neither the control repository nor the case directory", async () => {
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");

		await runSessionAttempt(
			request({
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: claude.run,
			}),
		);

		const [only] = claude.runs;
		expect(only?.cwd).not.toBe(resolve(import.meta.dir, "../.."));
		expect(only?.cwd).not.toContain("/cases/");
	});

	it("seeds the attempt directory from the case's fixture tree", async () => {
		const fixture = await mkdtemp(join(tmpdir(), "rehearsal-fixture-"));
		await mkdir(join(fixture, "docs"), { recursive: true });
		await writeFile(join(fixture, "docs", "note.md"), "planted\n");
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");

		await runSessionAttempt(
			request({
				sessionCase: sessionCase({ fixturePath: fixture }),
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: claude.run,
			}),
		);

		const [only] = claude.runs;
		expect(only?.seenFiles).toContain(join("docs", "note.md"));
	});

	/**
	 * A recursive copy preserves symlinks, so a fixture holding one to an
	 * absolute path would hand the session a live path out of the attempt
	 * directory: the session would read the machine's real file through a tree
	 * the harness promised was its own.
	 */
	it("refuses a fixture tree holding a symlink, naming it, before any provider call", async () => {
		const fixture = await mkdtemp(join(tmpdir(), "rehearsal-fixture-"));
		await mkdir(join(fixture, "docs"), { recursive: true });
		await symlink("/etc/hosts", join(fixture, "docs", "escape.md"));
		const projects = await projectsRoot();

		const failure = await failureOf(
			runSessionAttempt(
				request({
					sessionCase: sessionCase({ fixturePath: fixture }),
					projectsDirectory: projects,
					recordDirectory: await recordDirectory(),
					runClaude: () =>
						Promise.reject(new Error("a provider call must not happen")),
				}),
			),
		);

		expect(failure.message).toContain(join("docs", "escape.md"));
	});

	it("copies the transcript the provider wrote into the attempt record", async () => {
		const projects = await projectsRoot();
		const records = await recordDirectory();

		const attempt = await runSessionAttempt(
			request({
				projectsDirectory: projects,
				recordDirectory: records,
				runClaude: new FakeClaude(projects, "OK").run,
			}),
		);

		expect(attempt.reply).toBe("OK");
		expect(await Bun.file(attempt.transcriptFile).text()).toContain("OK");
	});

	it("leaves the projects slug directory holding no file the attempt created", async () => {
		const projects = await projectsRoot();

		const attempt = await runSessionAttempt(
			request({
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: new FakeClaude(projects, "OK").run,
			}),
		);

		const slug = join(projects, projectSlug(attempt.attemptDirectory));
		expect(await readdir(slug).catch(() => [])).toEqual([]);
	});

	it("copies the forked transcript when the resumed session appends to it rather than writing a new file", async () => {
		const prefix = await writtenPrefix(
			`${transcriptLine(SOURCE_SESSION, "the codeword is PLUMBAGO")}\n`,
		);
		const projects = await projectsRoot();

		const attempt = await runSessionAttempt(
			request({
				sessionCase: resumingCase(prefix.path, prefix.sha256),
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: appendingClaude(projects, "PLUMBAGO"),
			}),
		);

		expect(await Bun.file(attempt.transcriptFile).text()).toContain("PLUMBAGO");
	});

	it("refuses a transcript prefix whose bytes do not match the declared digest, naming the case and both digests", async () => {
		const prefix = await writtenPrefix(
			`${transcriptLine(SOURCE_SESSION, "bytes the declaration never hashed")}\n`,
		);
		const declared = "a".repeat(64);

		const failure = await failureOf(
			runSessionAttempt(
				request({
					sessionCase: resumingCase(prefix.path, declared),
					projectsDirectory: await projectsRoot(),
					recordDirectory: await recordDirectory(),
					runClaude: () =>
						Promise.reject(new Error("a provider call must not happen")),
				}),
			),
		);

		expect(failure).toBeInstanceOf(SessionInputError);
		expect(failure.message).toBe(
			`Case probe declares transcript prefix.jsonl at ${declared}, but ${prefix.path} hashes ${prefix.sha256}`,
		);
	});

	it("refuses a declared transcript prefix that is not on disk, naming the case and the file, before any provider call", async () => {
		const prefix = await writtenPrefix(
			`${transcriptLine(SOURCE_SESSION, "bytes that will not be there")}\n`,
		);
		await rm(prefix.path);

		const failure = await failureOf(
			runSessionAttempt(
				request({
					sessionCase: resumingCase(prefix.path, prefix.sha256),
					projectsDirectory: await projectsRoot(),
					recordDirectory: await recordDirectory(),
					runClaude: () =>
						Promise.reject(new Error("a provider call must not happen")),
				}),
			),
		);

		expect(failure).toBeInstanceOf(SessionInputError);
		expect(failure.message).toBe(
			`Case probe declares transcript prefix.jsonl, but no file is at ${prefix.path}. The prefix bytes are git-ignored run state; recapture them with \`rehearsal case capture\`.`,
		);
	});

	it("removes the transcript the provider wrote even when reading the envelope fails", async () => {
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");
		let attemptCwd = "";

		const failure = await failureOf(
			runSessionAttempt(
				request({
					projectsDirectory: projects,
					recordDirectory: await recordDirectory(),
					runClaude: async (command, cwd) => {
						attemptCwd = await realpath(cwd);
						await claude.run(command, cwd);

						return "not a claude envelope";
					},
				}),
			),
		);

		expect(failure).toBeInstanceOf(Error);
		expect(
			await readdir(join(projects, projectSlug(attemptCwd))).catch(() => []),
		).toEqual([]);
	});

	/**
	 * A max-turns or budget-exhausted termination returns an envelope with no
	 * `result` and `is_error` unset, which is not a reply of zero words: the
	 * smoke case's own checks (word band at most 1, no tool calls) both pass
	 * over the empty string.
	 */
	function replylessClaude(
		run: SessionAttemptRequest["runClaude"],
	): SessionAttemptRequest["runClaude"] {
		return async (command, cwd) => {
			await run(command, cwd);

			return JSON.stringify({
				type: "result",
				subtype: "error_max_turns",
				session_id: namedSession(command),
				is_error: false,
				total_cost_usd: 0.0012,
				num_turns: 30,
			});
		};
	}

	it("records an envelope with no result as no reply rather than as a passing empty one", async () => {
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");

		const attempt = await runSessionAttempt(
			request({
				sessionCase: sessionCase({
					checks: [
						{ kind: "word-band", max: 1 },
						{ kind: "tool-calls", max: 0 },
					],
				}),
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: replylessClaude(claude.run),
			}),
		);

		expect(attempt.outcome).toBe("NO_REPLY");
	});

	it("evaluates no check when the session produced no reply", async () => {
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");

		const attempt = await runSessionAttempt(
			request({
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: replylessClaude(claude.run),
			}),
		);

		expect(attempt.checks).toEqual([]);
	});

	/**
	 * The planted names bracket the provider's own file in codepoint order, so a
	 * subject that picks the attempt's transcript by sorting the new entries
	 * takes a planted one whichever direction it sorts. A test that plants only
	 * one name passes or fails on where that name happens to sort.
	 */
	const PLANTED_BEFORE = "0000-unrelated-live.jsonl";
	const PLANTED_AFTER = "zzzz-unrelated-live.jsonl";

	function plantingClaude(
		projects: string,
		run: SessionAttemptRequest["runClaude"],
	): SessionAttemptRequest["runClaude"] {
		return async (command, cwd) => {
			const slug = join(projects, projectSlug(await realpath(cwd)));
			await mkdir(slug, { recursive: true });
			await writeFile(join(slug, PLANTED_BEFORE), "{}\n");
			await writeFile(join(slug, PLANTED_AFTER), "{}\n");

			return run(command, cwd);
		};
	}

	it("keeps every file another session planted in the slug directory mid-run", async () => {
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");

		const attempt = await runSessionAttempt(
			request({
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: plantingClaude(projects, claude.run),
			}),
		);

		const slug = join(projects, projectSlug(attempt.attemptDirectory));
		const remaining = await readdir(slug);
		expect(remaining.toSorted()).toEqual([PLANTED_BEFORE, PLANTED_AFTER]);
	});

	it("records the transcript the provider's own session wrote, not a file planted beside it", async () => {
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");

		const attempt = await runSessionAttempt(
			request({
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: plantingClaude(projects, claude.run),
			}),
		);

		const [only] = claude.runs;
		expect(await Bun.file(attempt.transcriptFile).text()).toBe(
			`${transcriptLine(namedSession(only?.command ?? []), "OK")}\n`,
		);
	});

	it("leaves nothing behind when the provider writes its transcript and then throws", async () => {
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");
		let writtenTranscript = "";

		const failure = await failureOf(
			runSessionAttempt(
				request({
					projectsDirectory: projects,
					recordDirectory: await recordDirectory(),
					runClaude: async (command, cwd) => {
						await claude.run(command, cwd);
						const slug = join(projects, projectSlug(await realpath(cwd)));
						writtenTranscript = join(slug, `${namedSession(command)}.jsonl`);
						expect(await Bun.file(writtenTranscript).exists()).toBe(true);

						throw new Error("claude exited 1");
					},
				}),
			),
		);

		expect(failure.message).toBe("claude exited 1");
		expect(await Bun.file(writtenTranscript).exists()).toBe(false);
	});

	it("removes the slug directory itself once the attempt's files are gone", async () => {
		const projects = await projectsRoot();

		const attempt = await runSessionAttempt(
			request({
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: new FakeClaude(projects, "OK").run,
			}),
		);

		expect(await readdir(projects)).not.toContain(
			projectSlug(attempt.attemptDirectory),
		);
	});
});
