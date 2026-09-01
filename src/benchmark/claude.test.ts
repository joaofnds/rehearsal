import { describe, expect, it } from "bun:test";
import {
	claudeArgs,
	readClaudeCallMetrics,
	readClaudeEnvelope,
	readStructuredOutput,
} from "./claude";
import {
	claudeJsonSchema,
	judgeGradeSchema,
	productAnswerSchema,
	stageTurnSchema,
} from "./contracts";

describe(readClaudeEnvelope.name, () => {
	it("returns the parsed session envelope", () => {
		const envelope = readClaudeEnvelope(
			JSON.stringify({ session_id: "session-1", total_cost_usd: 0.5 }),
		);

		expect(envelope.session_id).toBe("session-1");
		expect(envelope.total_cost_usd).toBe(0.5);
	});

	it("throws the session's own error message on an error envelope", () => {
		expect(() =>
			readClaudeEnvelope(
				JSON.stringify({
					session_id: "session-1",
					is_error: true,
					result: "session exhausted its budget",
				}),
			),
		).toThrow("session exhausted its budget");
	});
});

describe(readClaudeCallMetrics.name, () => {
	it("maps complete provider usage without converting fields", () => {
		const envelope = readClaudeEnvelope(
			JSON.stringify({
				session_id: "session-1",
				total_cost_usd: 0.5,
				num_turns: 7,
				duration_ms: 1200,
				duration_api_ms: 900,
				usage: {
					input_tokens: 100,
					output_tokens: 20,
					cache_read_input_tokens: 30,
					cache_creation_input_tokens: 40,
				},
			}),
		);

		expect(readClaudeCallMetrics(envelope)).toEqual({
			costUsd: 0.5,
			inputTokens: 100,
			outputTokens: 20,
			cacheReadTokens: 30,
			cacheWriteTokens: 40,
			turns: 7,
			durationMs: 1200,
			apiDurationMs: 900,
		});
	});

	it("preserves missing required metrics as absence", () => {
		const envelope = readClaudeEnvelope(
			JSON.stringify({ session_id: "session-1", total_cost_usd: 0.5 }),
		);

		expect(readClaudeCallMetrics(envelope)).toBeUndefined();
	});
});

describe(readStructuredOutput.name, () => {
	it("reads the structured output field", () => {
		const envelope = readClaudeEnvelope(
			JSON.stringify({
				session_id: "session-1",
				structured_output: { answer: "ship it" },
			}),
		);

		const output = readStructuredOutput(envelope, productAnswerSchema);

		expect(output.answer).toBe("ship it");
	});

	it("parses the result text when structured output is absent", () => {
		const envelope = readClaudeEnvelope(
			JSON.stringify({
				session_id: "session-1",
				result: JSON.stringify({ answer: "ship it" }),
			}),
		);

		const output = readStructuredOutput(envelope, productAnswerSchema);

		expect(output.answer).toBe("ship it");
	});

	it("rejects an envelope with no output", () => {
		const envelope = readClaudeEnvelope(
			JSON.stringify({ session_id: "session-1" }),
		);

		expect(() => readStructuredOutput(envelope, productAnswerSchema)).toThrow(
			"did not contain structured output",
		);
	});
});

describe(claudeArgs.name, () => {
	it("grants a workflow session native customizations without permission prompts", () => {
		const command = claudeArgs({
			settings: { model: "sonnet", effort: "high", budgetUsd: 5 },
			schema: stageTurnSchema,
			access: "unrestricted",
			session: { id: "session-1", resume: false },
		});

		expect(command).toEqual([
			"claude",
			"-p",
			"--model",
			"sonnet",
			"--effort",
			"high",
			"--max-budget-usd",
			"5",
			"--output-format",
			"json",
			"--json-schema",
			claudeJsonSchema(stageTurnSchema),
			"--dangerously-skip-permissions",
			"--session-id",
			"session-1",
		]);
	});

	it("seals a judge session away from tools, skills, and persistence", () => {
		const command = claudeArgs({
			settings: { model: "sonnet", budgetUsd: 5 },
			schema: judgeGradeSchema,
			access: "sealed",
			systemPrompt: "You are a judge.",
		});

		expect(command).toEqual([
			"claude",
			"-p",
			"--safe-mode",
			"--disable-slash-commands",
			"--strict-mcp-config",
			"--model",
			"sonnet",
			"--max-budget-usd",
			"5",
			"--output-format",
			"json",
			"--json-schema",
			claudeJsonSchema(judgeGradeSchema),
			"--tools",
			"",
			"--system-prompt",
			"You are a judge.",
			"--no-session-persistence",
		]);
	});

	it("resumes an existing session", () => {
		const command = claudeArgs({
			settings: { model: "sonnet", budgetUsd: 5 },
			schema: stageTurnSchema,
			access: "unrestricted",
			session: { id: "session-1", resume: true },
		});

		expect(command).toContain("--resume");
		expect(command).not.toContain("--session-id");
	});
});
