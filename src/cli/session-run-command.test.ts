import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionCase } from "#benchmark/case";
import type { Immutable } from "#benchmark/contracts";
import type { SessionRunConfig } from "#benchmark/config";
import { parseSessionAttemptRecord } from "#benchmark/session-record";
import { projectSlug } from "#benchmark/session-capture";
import type { ClaudeRunner } from "#benchmark/session-attempt";
import { failureOf } from "#cli/cli-test-support";
import { UsageError } from "#cli/commands";
import { RefusedPreconditionError } from "#cli/interactive-stdin";
import { runSessionDebugAttempt } from "#cli/session-run-command";

const config: SessionRunConfig = {
	caseId: "smoke",
	model: "haiku",
	effort: "low",
	judgeModel: "opus",
	judgeEffort: "low",
	sessionBudgetUsd: 0.2,
};

function sessionCase(
	overrides: Immutable<Partial<SessionCase>> = {},
): SessionCase {
	return {
		kind: "session",
		declaration: {
			id: "smoke",
			kind: "session",
			title: "Smoke",
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

/**
 * The provider writes its session file under the id the command line named,
 * which is what lets the harness account for the file it must remove.
 */
function fakeClaude(projects: string, reply: string): ClaudeRunner {
	return async (command, cwd) => {
		const sessionId = command[command.indexOf("--session-id") + 1] ?? "";
		const slug = join(projects, projectSlug(await realpath(cwd)));
		await mkdir(slug, { recursive: true });
		await writeFile(
			join(slug, `${sessionId}.jsonl`),
			`${JSON.stringify({
				type: "assistant",
				message: { content: [{ type: "text", text: reply }] },
			})}\n`,
		);

		return JSON.stringify({
			session_id: sessionId,
			is_error: false,
			result: reply,
			total_cost_usd: 0.0011,
			num_turns: 1,
			duration_ms: 800,
			duration_api_ms: 700,
			usage: {
				input_tokens: 10,
				output_tokens: 2,
				cache_read_input_tokens: 0,
				cache_creation_input_tokens: 0,
			},
		});
	};
}

function temporary(prefix: string): Promise<string> {
	return mkdtemp(join(tmpdir(), prefix));
}

describe(runSessionDebugAttempt.name, () => {
	it("writes one record carrying the reply, the transcript path, the metrics, and a result per check", async () => {
		const runs = await temporary("rehearsal-runs-");
		const projects = await temporary("rehearsal-projects-");

		const outcome = await runSessionDebugAttempt({
			sessionCase: sessionCase(),
			config,
			runsDirectory: runs,
			runClaude: fakeClaude(projects, "OK"),
			projectsDirectory: projects,
		});

		expect(outcome.record).toMatchObject({
			schemaVersion: 1,
			caseId: "smoke",
			model: "haiku",
			effort: "low",
			reply: "OK",
			outcome: "SUCCESSFUL",
			checks: [{ kind: "word-band", status: "PASS" }],
		});
		expect(outcome.record.metrics?.costUsd).toBe(0.0011);
		expect(await Bun.file(outcome.record.transcriptFile).text()).toContain(
			"OK",
		);
	});

	it("prints a record that parses with the schema that wrote it", async () => {
		const runs = await temporary("rehearsal-runs-");
		const projects = await temporary("rehearsal-projects-");

		const outcome = await runSessionDebugAttempt({
			sessionCase: sessionCase(),
			config,
			runsDirectory: runs,
			runClaude: fakeClaude(projects, "OK"),
			projectsDirectory: projects,
		});

		const written = parseSessionAttemptRecord(
			await Bun.file(outcome.recordFile).text(),
		);
		expect(written).toEqual(outcome.record);
	});

	it("reports the attempt unsuccessful when a check fails", async () => {
		const runs = await temporary("rehearsal-runs-");
		const projects = await temporary("rehearsal-projects-");

		const outcome = await runSessionDebugAttempt({
			sessionCase: sessionCase(),
			config,
			runsDirectory: runs,
			runClaude: fakeClaude(projects, "OK sure thing"),
			projectsDirectory: projects,
		});

		expect(outcome.record.outcome).toBe("UNSUCCESSFUL");
		expect(outcome.record.checks[0]?.status).toBe("FAIL");
	});

	it("refuses a fixture tree holding a symlink, before any provider call", async () => {
		const runs = await temporary("rehearsal-runs-");
		const projects = await temporary("rehearsal-projects-");
		const fixture = await temporary("rehearsal-fixture-");
		await symlink("/etc/hosts", join(fixture, "escape.md"));

		const failure = await failureOf(
			runSessionDebugAttempt({
				sessionCase: sessionCase({ fixturePath: fixture }),
				config,
				runsDirectory: runs,
				runClaude: () =>
					Promise.reject(new Error("a provider call must not happen")),
				projectsDirectory: projects,
			}),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure.message).toContain("escape.md");
	});

	it("refuses a declared corpus file that does not resolve, before any provider call", async () => {
		const runs = await temporary("rehearsal-runs-");
		const projects = await temporary("rehearsal-projects-");

		const failure = await failureOf(
			runSessionDebugAttempt({
				sessionCase: sessionCase({
					corpusFiles: ["output-styles/no-such-style.md"],
				}),
				config,
				runsDirectory: runs,
				runClaude: () =>
					Promise.reject(new Error("a provider call must not happen")),
				projectsDirectory: projects,
			}),
		);

		expect(failure).toBeInstanceOf(RefusedPreconditionError);
		expect(failure.message).toContain("no-such-style.md");
	});
});

describe("running a session case against a corpus source", () => {
	async function corpusDirectory(brief: string): Promise<string> {
		const root = await temporary("rehearsal-corpus-");
		await Bun.write(join(root, "output-styles/brief.md"), brief);

		return root;
	}

	function styledCase(): SessionCase {
		return sessionCase({
			corpusFiles: ["output-styles/brief.md"],
			declaration: {
				id: "smoke",
				kind: "session",
				title: "Smoke",
				prompt: "Reply with the single word OK.",
				tools: [],
				corpusFiles: ["output-styles/brief.md"],
				checks: [{ kind: "word-band", max: 1 }],
			},
		});
	}

	async function attemptWith(
		corpus: string | undefined,
	): Promise<Awaited<ReturnType<typeof runSessionDebugAttempt>>> {
		const projects = await temporary("rehearsal-projects-");
		const runsDirectory = await temporary("rehearsal-runs-");

		return runSessionDebugAttempt({
			sessionCase: styledCase(),
			config: corpus === undefined ? config : { ...config, corpus },
			runsDirectory,
			runClaude: fakeClaude(projects, "OK"),
			projectsDirectory: projects,
		});
	}

	it("records the corpus source's bytes rather than the live install's", async () => {
		const outcome = await attemptWith(await corpusDirectory("marker brief\n"));

		expect(outcome.record.corpusFiles[0]?.sha256).toBe(
			new Bun.CryptoHasher("sha256").update("marker brief\n").digest("hex"),
		);
	});

	/**
	 * Criterion 8's purpose is that two runs at one ref are comparable and a
	 * moved ref is visible, which only holds if the record on disk says where
	 * the bytes came from.
	 */
	it("records the directory source the corpus came from", async () => {
		const root = await corpusDirectory("marker brief\n");

		const outcome = await attemptWith(root);

		expect(outcome.record.corpusOrigin).toEqual({
			kind: "directory",
			source: root,
		});
	});

	it("records the live install as the origin when no source is named", async () => {
		const outcome = await attemptWith(undefined);

		expect(outcome.record.corpusOrigin).toEqual({ kind: "live" });
	});

	it("writes the origin to the record file, not only to the value it returns", async () => {
		const root = await corpusDirectory("marker brief\n");

		const outcome = await attemptWith(root);

		expect(
			parseSessionAttemptRecord(await Bun.file(outcome.recordFile).text())
				.corpusOrigin,
		).toEqual({ kind: "directory", source: root });
	});

	it("changes the lineage when the source's declared bytes differ", async () => {
		const first = await attemptWith(await corpusDirectory("one brief\n"));
		const second = await attemptWith(await corpusDirectory("another brief\n"));

		expect(second.record.lineage).not.toBe(first.record.lineage);
	});

	it("leaves the lineage unchanged when two sources resolve to identical bytes", async () => {
		const first = await attemptWith(await corpusDirectory("same brief\n"));
		const second = await attemptWith(await corpusDirectory("same brief\n"));

		expect(second.record.lineage).toBe(first.record.lineage);
	});

	it("records the live install's bytes and their live paths when no source is named", async () => {
		const outcome = await attemptWith(undefined);

		expect(outcome.record.corpusFiles[0]?.resolvedPath).toBe(
			join(homedir(), ".claude/output-styles/brief.md"),
		);
		expect(outcome.record.corpusFiles[0]?.sha256).toBe(
			new Bun.CryptoHasher("sha256")
				.update(
					await Bun.file(
						join(homedir(), ".claude/output-styles/brief.md"),
					).bytes(),
				)
				.digest("hex"),
		);
	});

	/**
	 * Every smoke attempt recorded before --corpus existed carries this lineage.
	 * A change to it would mean the flag silently rewrote what a run absent the
	 * flag measures, which is the one thing this card promised it would not do.
	 */
	it("records the lineage the smoke case carried before --corpus existed", async () => {
		const projects = await temporary("rehearsal-projects-");

		const outcome = await runSessionDebugAttempt({
			sessionCase: sessionCase(),
			config,
			runsDirectory: await temporary("rehearsal-runs-"),
			runClaude: fakeClaude(projects, "OK"),
			projectsDirectory: projects,
		});

		expect(outcome.record.lineage).toBe(
			"d875e2ac2844c6af8c60bff300d74ec72b0f07b592da123276c571ce78cac2ba",
		);
	});

	/**
	 * A source string the parser cannot turn into a corpus is an unparseable
	 * value, which the exit codes call a usage error; a corpus that resolves but
	 * cannot be delivered is the refused precondition.
	 */
	it.each(["/no/such/corpus", "chezmoi:"])(
		"reports %s as a usage error, before any provider call",
		async (corpus) => {
			const failure = await failureOf(attemptWith(corpus));

			expect(failure).toBeInstanceOf(UsageError);
			expect(failure.message).toContain(corpus);
		},
	);
});
