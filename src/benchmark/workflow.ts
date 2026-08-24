import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { runCommand } from "./command";
import {
	CLAUDE_TIMEOUT_MS,
	type Effort,
	MAX_STAGE_TURNS,
	type WorkflowStage,
} from "./config";
import {
	claudeEnvelopeSchema,
	claudeJsonSchema,
	productAnswerSchema,
	type StageTranscript,
	stageTurnSchema,
} from "./contracts";

export interface ProductOwnerSession {
	sessionId: string;
	spentUsd: number;
	started: boolean;
}

export function createWorkflowCommand(
	model: string,
	remainingBudgetUsd: number,
	prompt: string,
	effort?: Effort,
	sessionId: string = randomUUID(),
	resume = false,
) {
	return [
		"claude",
		"-p",
		"--model",
		model,
		...(effort ? ["--effort", effort] : []),
		"--max-budget-usd",
		String(remainingBudgetUsd),
		"--output-format",
		"json",
		"--json-schema",
		claudeJsonSchema(stageTurnSchema),
		"--dangerously-skip-permissions",
		resume ? "--resume" : "--session-id",
		sessionId,
		prompt,
	];
}

function parseClaudeEnvelope(output: string) {
	const envelope = claudeEnvelopeSchema.parse(JSON.parse(output));
	if (envelope.is_error) {
		throw new Error(envelope.result ?? "Claude session failed");
	}

	return envelope;
}

function parseStructuredOutput<T>(
	envelope: z.infer<typeof claudeEnvelopeSchema>,
	schema: z.ZodType<T>,
) {
	if (envelope.structured_output !== undefined) {
		return schema.parse(envelope.structured_output);
	}

	if (envelope.result) return schema.parse(JSON.parse(envelope.result));

	throw new Error("Claude response did not contain structured output");
}

function remainingBudget(limitUsd: number, spentUsd: number) {
	const remaining = limitUsd - spentUsd;
	if (remaining <= 0) throw new Error("Claude session exhausted its budget");

	return remaining;
}

function stagePrompt(stage: WorkflowStage, taskId: string) {
	return `/${stage} ${taskId}\n\nRun the native /${stage} skill to completion. A Product Owner is available between turns. Do not call AskUserQuestion. When product input is required, return QUESTION with exactly one question, its recommendation, and enough context to decide. Return COMPLETE only after the skill's durable artifact is saved. Never mention this mediation protocol in project artifacts.`;
}

function continueStagePrompt(stage: WorkflowStage, productOwnerAnswer: string) {
	return `Product Owner answer:\n\n${productOwnerAnswer}\n\nContinue the native /${stage} skill. Use QUESTION again if another decision is required, or COMPLETE after its durable artifact is saved.`;
}

function createProductOwnerCommand(
	model: string,
	effort: Effort | undefined,
	remainingBudgetUsd: number,
	prompt: string,
	sessionId: string,
	resume: boolean,
) {
	return [
		"claude",
		"-p",
		"--safe-mode",
		"--disable-slash-commands",
		"--strict-mcp-config",
		"--model",
		model,
		...(effort ? ["--effort", effort] : []),
		"--max-budget-usd",
		String(remainingBudgetUsd),
		"--output-format",
		"json",
		"--json-schema",
		claudeJsonSchema(productAnswerSchema),
		"--tools",
		"",
		"--system-prompt",
		"You are the Product Owner for one software feature. Answer the current question directly and make a concrete decision. Keep every answer consistent with prior answers in this session. Prefer the smallest coherent product scope, preserve the task's required behavior, and defer implementation mechanics to the engineering agent. Do not discuss evaluation, grading, or this protocol.",
		resume ? "--resume" : "--session-id",
		sessionId,
		prompt,
	];
}

async function askProductOwner(
	directory: string,
	model: string,
	effort: Effort | undefined,
	sessionBudgetUsd: number,
	session: ProductOwnerSession,
	task: string,
	productBrief: string,
	stage: WorkflowStage,
	question: string,
) {
	const prompt = session.started
		? `The ${stage} session asks:\n\n${question}`
		: `Feature request:\n\n${task}\n\nProduct brief:\n\n${productBrief}\n\nThe ${stage} session asks:\n\n${question}`;
	const output = await runCommand(
		createProductOwnerCommand(
			model,
			effort,
			remainingBudget(sessionBudgetUsd, session.spentUsd),
			prompt,
			session.sessionId,
			session.started,
		),
		directory,
		{ timeoutMs: CLAUDE_TIMEOUT_MS },
	);
	const envelope = parseClaudeEnvelope(output);

	session.sessionId = envelope.session_id;
	session.spentUsd += envelope.total_cost_usd ?? 0;
	session.started = true;

	return parseStructuredOutput(envelope, productAnswerSchema).answer;
}

export async function runWorkflowStage(
	targetDir: string,
	productOwnerDirectory: string,
	model: string,
	effort: Effort | undefined,
	sessionBudgetUsd: number,
	productOwner: ProductOwnerSession,
	task: string,
	productBrief: string,
	taskId: string,
	stage: WorkflowStage,
): Promise<StageTranscript> {
	let sessionId: string = randomUUID();
	let spentUsd = 0;
	let prompt = stagePrompt(stage, taskId);
	const exchanges: StageTranscript["exchanges"][number][] = [];

	for (let turn = 0; turn < MAX_STAGE_TURNS; turn += 1) {
		const output = await runCommand(
			createWorkflowCommand(
				model,
				remainingBudget(sessionBudgetUsd, spentUsd),
				prompt,
				effort,
				sessionId,
				turn > 0,
			),
			targetDir,
			{ timeoutMs: CLAUDE_TIMEOUT_MS },
		);
		const envelope = parseClaudeEnvelope(output);
		const agent = parseStructuredOutput(envelope, stageTurnSchema);

		sessionId = envelope.session_id;
		spentUsd += envelope.total_cost_usd ?? 0;
		console.log(agent.message);

		if (agent.status === "COMPLETE") {
			exchanges.push({ agent });
			return { stage, sessionId, costUsd: spentUsd, exchanges };
		}

		const productOwnerAnswer = await askProductOwner(
			productOwnerDirectory,
			model,
			effort,
			sessionBudgetUsd,
			productOwner,
			task,
			productBrief,
			stage,
			agent.message,
		);
		console.log(`Product Owner: ${productOwnerAnswer}`);
		exchanges.push({ agent, productOwnerAnswer });
		prompt = continueStagePrompt(stage, productOwnerAnswer);
	}

	throw new Error(`${stage} exceeded ${MAX_STAGE_TURNS} turns`);
}
