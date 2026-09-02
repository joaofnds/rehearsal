import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionCase } from "#benchmark/case";
import type { Immutable } from "#benchmark/contracts";
import type { SessionRunConfig } from "#benchmark/config";
import { parseSessionAttemptRecord } from "#benchmark/session-record";
import { projectSlug } from "#benchmark/session-capture";
import type { ClaudeRunner } from "#benchmark/session-attempt";
import { failureOf } from "#cli/cli-test-support";
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

function fakeClaude(projects: string, reply: string): ClaudeRunner {
	return async (_command, cwd) => {
		const slug = join(projects, projectSlug(await realpath(cwd)));
		await mkdir(slug, { recursive: true });
		await writeFile(
			join(slug, "aaaa-written.jsonl"),
			`${JSON.stringify({
				type: "assistant",
				message: { content: [{ type: "text", text: reply }] },
			})}\n`,
		);

		return JSON.stringify({
			session_id: "aaaa-written",
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
