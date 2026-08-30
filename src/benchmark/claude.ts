import type { z } from "zod";
import type { Effort } from "./config";
import type { ClaudeEnvelope } from "./contracts";
import { claudeEnvelopeSchema, claudeJsonSchema } from "./contracts";

export interface SessionSettings {
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly budgetUsd: number;
}

export interface ClaudeInvocation {
	readonly settings: SessionSettings;
	readonly schema: z.ZodType;
	readonly access: "unrestricted" | "sealed";
	readonly systemPrompt?: string | undefined;
	readonly session?:
		| { readonly id: string; readonly resume: boolean }
		| undefined;
}

export function claudeArgs(invocation: ClaudeInvocation): string[] {
	const { settings, schema, access, systemPrompt, session } = invocation;

	return [
		"claude",
		"-p",
		...(access === "sealed"
			? ["--safe-mode", "--disable-slash-commands", "--strict-mcp-config"]
			: []),
		"--model",
		settings.model,
		...(settings.effort ? ["--effort", settings.effort] : []),
		"--max-budget-usd",
		String(settings.budgetUsd),
		"--output-format",
		"json",
		"--json-schema",
		claudeJsonSchema(schema),
		...(access === "sealed"
			? ["--tools", ""]
			: ["--dangerously-skip-permissions"]),
		...(systemPrompt === undefined ? [] : ["--system-prompt", systemPrompt]),
		...(session
			? [session.resume ? "--resume" : "--session-id", session.id]
			: ["--no-session-persistence"]),
	];
}

export function readClaudeEnvelope(output: string): ClaudeEnvelope {
	const envelope = claudeEnvelopeSchema.parse(JSON.parse(output));
	if (envelope.is_error === true) {
		throw new Error(envelope.result ?? "Claude session failed");
	}

	return envelope;
}

export function readStructuredOutput<T>(
	envelope: ClaudeEnvelope,
	schema: z.ZodType<T>,
): T {
	if (envelope.structured_output !== undefined) {
		return schema.parse(envelope.structured_output);
	}

	if (envelope.result !== undefined && envelope.result !== "") {
		return schema.parse(JSON.parse(envelope.result));
	}

	throw new Error("Claude response did not contain structured output");
}
