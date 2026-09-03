import { randomUUID } from "node:crypto";
import {
	claudeArgs,
	readClaudeCallMetrics,
	readClaudeEnvelope,
	readStructuredOutput,
} from "./claude";
import { runCommand } from "./command";
import type { Effort, WorkflowStage } from "./config";
import { CLAUDE_TIMEOUT_MS, MAX_STAGE_TURNS } from "./config";
import type {
	ClaudeCallMetrics,
	ProviderCall,
	StageTranscript,
} from "./contracts";
import { productAnswerSchema, stageTurnSchema } from "./contracts";

export interface ProductOwnerSnapshot {
	readonly sessionId: string;
	readonly spentUsd: number;
	readonly providerCalls: readonly ProviderCall[];
}

export interface ProductOwner {
	readonly ask: (stage: WorkflowStage, question: string) => Promise<string>;
	readonly snapshot: () => ProductOwnerSnapshot;
}

export interface ProductOwnerConfiguration {
	readonly directory: string;
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly sessionBudgetUsd: number;
	readonly task: string;
	readonly productBrief: string;
}

export type ClaudeCommand = (
	command: readonly string[],
	directory: string,
	options: { readonly timeoutMs: number },
) => Promise<string>;

export interface WorkflowStageRequest {
	readonly targetDir: string;
	readonly model: string;
	readonly effort?: Effort | undefined;
	readonly sessionBudgetUsd: number;
	readonly productOwner: ProductOwner;
	readonly taskId: string;
	readonly stage: WorkflowStage;
	readonly skill: string;
	readonly settingSources?: "project" | undefined;
}

export class WorkflowExecutionError extends Error {
	public readonly providerCalls: readonly ProviderCall[];

	public constructor(props: {
		readonly cause: unknown;
		readonly providerCalls: readonly ProviderCall[];
	}) {
		super("Worker execution failed", { cause: props.cause });
		this.name = "WorkflowExecutionError";
		this.providerCalls = props.providerCalls;
	}
}

function providerCall(metrics: ClaudeCallMetrics | undefined): ProviderCall {
	return metrics === undefined ? {} : { metrics };
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

/**
 * One Product Owner session answers every question in a run, so later
 * answers retain earlier decisions. The session state lives only in this
 * closure; callers receive answers and a cost snapshot, never the mutation.
 */
export function createProductOwner(
	configuration: ProductOwnerConfiguration,
	runClaude: ClaudeCommand = runCommand,
): ProductOwner {
	let sessionId: string = randomUUID();
	let spentUsd = 0;
	const providerCalls: ProviderCall[] = [];
	let started = false;

	return {
		ask: async (stage, question) => {
			const prompt = started
				? `The ${stage} session asks:\n\n${question}`
				: `Feature request:\n\n${configuration.task}\n\nProduct brief:\n\n${configuration.productBrief}\n\nThe ${stage} session asks:\n\n${question}`;
			const output = await runClaude(
				[
					...claudeArgs({
						settings: {
							model: configuration.model,
							effort: configuration.effort,
							budgetUsd: remainingBudget(
								configuration.sessionBudgetUsd,
								spentUsd,
							),
						},
						schema: productAnswerSchema,
						access: "sealed",
						systemPrompt:
							"You are the Product Owner for one software feature. Answer the current question directly and make a concrete decision. Keep every answer consistent with prior answers in this session. Prefer the smallest coherent product scope, preserve the task's required behavior, and defer implementation mechanics to the engineering agent. Do not discuss evaluation, grading, or this protocol.",
						session: { id: sessionId, resume: started },
					}),
					prompt,
				],
				configuration.directory,
				{ timeoutMs: CLAUDE_TIMEOUT_MS },
			);
			const envelope = readClaudeEnvelope(output);

			sessionId = envelope.session_id;
			spentUsd += envelope.total_cost_usd ?? 0;
			providerCalls.push(providerCall(readClaudeCallMetrics(envelope)));
			started = true;

			return readStructuredOutput(envelope, productAnswerSchema).answer;
		},
		snapshot: () => ({
			sessionId,
			spentUsd,
			providerCalls: [...providerCalls],
		}),
	};
}

export async function runWorkflowStage(
	request: WorkflowStageRequest,
	runClaude: ClaudeCommand = runCommand,
): Promise<StageTranscript> {
	const {
		targetDir,
		model,
		effort,
		sessionBudgetUsd,
		productOwner,
		taskId,
		stage,
		skill,
		settingSources,
	} = request;
	let sessionId: string = randomUUID();
	let spentUsd = 0;
	const providerCalls: ProviderCall[] = [];
	let prompt = stagePrompt(skill, taskId);
	const exchanges: StageTranscript["exchanges"][number][] = [];

	for (let turn = 0; turn < MAX_STAGE_TURNS; turn += 1) {
		const budgetUsd = remainingBudget(sessionBudgetUsd, spentUsd);
		let envelope;
		let agent;
		try {
			const output = await runClaude(
				[
					...claudeArgs({
						settings: {
							model,
							effort,
							budgetUsd,
						},
						schema: stageTurnSchema,
						access: "unrestricted",
						session: { id: sessionId, resume: turn > 0 },
						settingSources,
					}),
					prompt,
				],
				targetDir,
				{ timeoutMs: CLAUDE_TIMEOUT_MS },
			);
			envelope = readClaudeEnvelope(output);
			agent = readStructuredOutput(envelope, stageTurnSchema);
		} catch (error) {
			throw new WorkflowExecutionError({
				cause: error,
				providerCalls: [...providerCalls, {}],
			});
		}

		sessionId = envelope.session_id;
		spentUsd += envelope.total_cost_usd ?? 0;
		providerCalls.push(providerCall(readClaudeCallMetrics(envelope)));
		console.log(agent.message);

		if (agent.status === "COMPLETE") {
			exchanges.push({ agent });
			return { stage, sessionId, costUsd: spentUsd, providerCalls, exchanges };
		}

		const productOwnerAnswer = await productOwner.ask(stage, agent.message);
		console.log(`Product Owner: ${productOwnerAnswer}`);
		exchanges.push({ agent, productOwnerAnswer });
		prompt = continueStagePrompt(skill, productOwnerAnswer);
	}

	throw new Error(`${stage} exceeded ${MAX_STAGE_TURNS} turns`);
}
