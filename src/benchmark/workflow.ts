import { randomUUID } from "node:crypto";
import { claudeArgs, readClaudeEnvelope, readStructuredOutput } from "./claude";
import { runCommand } from "./command";
import type { Effort, WorkflowStage } from "./config";
import { CLAUDE_TIMEOUT_MS, MAX_STAGE_TURNS } from "./config";
import type { StageTranscript } from "./contracts";
import { productAnswerSchema, stageTurnSchema } from "./contracts";

export interface ProductOwnerSession {
	sessionId: string;
	spentUsd: number;
	started: boolean;
}

function remainingBudget(limitUsd: number, spentUsd: number): number {
	const remaining = limitUsd - spentUsd;
	if (remaining <= 0) {
		throw new Error("Claude session exhausted its budget");
	}

	return remaining;
}

function stagePrompt(skill: string, taskId: string): string {
	return `/${skill} ${taskId}\n\nRun the native /${skill} skill to completion. A Product Owner is available between turns. Do not call AskUserQuestion. When product input is required, return QUESTION with exactly one question, its recommendation, and enough context to decide. Return COMPLETE only after the skill's durable artifact is saved. Never mention this mediation protocol in project artifacts.`;
}

function continueStagePrompt(
	skill: string,
	productOwnerAnswer: string,
): string {
	return `Product Owner answer:\n\n${productOwnerAnswer}\n\nContinue the native /${skill} skill. Use QUESTION again if another decision is required, or COMPLETE after its durable artifact is saved.`;
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
): Promise<string> {
	const prompt = session.started
		? `The ${stage} session asks:\n\n${question}`
		: `Feature request:\n\n${task}\n\nProduct brief:\n\n${productBrief}\n\nThe ${stage} session asks:\n\n${question}`;
	const output = await runCommand(
		[
			...claudeArgs({
				settings: {
					model,
					effort,
					budgetUsd: remainingBudget(sessionBudgetUsd, session.spentUsd),
				},
				schema: productAnswerSchema,
				access: "sealed",
				systemPrompt:
					"You are the Product Owner for one software feature. Answer the current question directly and make a concrete decision. Keep every answer consistent with prior answers in this session. Prefer the smallest coherent product scope, preserve the task's required behavior, and defer implementation mechanics to the engineering agent. Do not discuss evaluation, grading, or this protocol.",
				session: { id: session.sessionId, resume: session.started },
			}),
			prompt,
		],
		directory,
		{ timeoutMs: CLAUDE_TIMEOUT_MS },
	);
	const envelope = readClaudeEnvelope(output);

	session.sessionId = envelope.session_id;
	session.spentUsd += envelope.total_cost_usd ?? 0;
	session.started = true;

	return readStructuredOutput(envelope, productAnswerSchema).answer;
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
	skill: string,
): Promise<StageTranscript> {
	let sessionId: string = randomUUID();
	let spentUsd = 0;
	let prompt = stagePrompt(skill, taskId);
	const exchanges: StageTranscript["exchanges"][number][] = [];

	for (let turn = 0; turn < MAX_STAGE_TURNS; turn += 1) {
		const output = await runCommand(
			[
				...claudeArgs({
					settings: {
						model,
						effort,
						budgetUsd: remainingBudget(sessionBudgetUsd, spentUsd),
					},
					schema: stageTurnSchema,
					access: "unrestricted",
					session: { id: sessionId, resume: turn > 0 },
				}),
				prompt,
			],
			targetDir,
			{ timeoutMs: CLAUDE_TIMEOUT_MS },
		);
		const envelope = readClaudeEnvelope(output);
		const agent = readStructuredOutput(envelope, stageTurnSchema);

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
		prompt = continueStagePrompt(skill, productOwnerAnswer);
	}

	throw new Error(`${stage} exceeded ${MAX_STAGE_TURNS} turns`);
}
