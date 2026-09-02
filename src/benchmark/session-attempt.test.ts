import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { SessionCase } from "#benchmark/case";
import type { Immutable } from "#benchmark/contracts";
import { projectSlug } from "#benchmark/session-capture";
import type { SessionAttemptRequest } from "#benchmark/session-attempt";
import {
	forkTranscript,
	runSessionAttempt,
	sessionCaseArgs,
} from "#benchmark/session-attempt";

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

/**
 * The provider writes the session file for the run it just performed, and the
 * harness reads it back from the slug directory, so the fake writes one too.
 * A resumed run is given a further session id, which is why the file it writes
 * is never the one the fork wrote.
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
		const slug = join(this.projects, projectSlug(await realpath(cwd)));
		await mkdir(slug, { recursive: true });
		await writeFile(
			join(slug, `${WRITTEN_SESSION}.jsonl`),
			`${transcriptLine(WRITTEN_SESSION, this.reply)}\n`,
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
		return sessionCaseArgs(sessionCase(overrides), settings, resume);
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

	it.each(["--no-session-persistence", "--json-schema"])(
		"never passes %s, which would discard the transcript or force a schema",
		(flag) => {
			expect(
				args({ tools: ["Read"], settings: { style: "brief" } }, "uuid"),
			).not.toContain(flag);
		},
	);
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
});

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

	it("keeps a file another session planted in the slug directory mid-run", async () => {
		const projects = await projectsRoot();
		const claude = new FakeClaude(projects, "OK");

		const attempt = await runSessionAttempt(
			request({
				projectsDirectory: projects,
				recordDirectory: await recordDirectory(),
				runClaude: async (command, cwd) => {
					const slug = join(projects, projectSlug(await realpath(cwd)));
					await mkdir(slug, { recursive: true });
					await writeFile(join(slug, "joao-was-here.jsonl"), "{}\n");

					return claude.run(command, cwd);
				},
			}),
		);

		const slug = join(projects, projectSlug(attempt.attemptDirectory));
		expect(await readdir(slug)).toEqual(["joao-was-here.jsonl"]);
	});
});
