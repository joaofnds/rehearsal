import { z } from "zod";
import { MAX_STAGE_TURNS, type WorkflowStage } from "../benchmark/config";
import { EvidenceIngestion } from "../evidence/evidence-ingestion";
import type { RunEventController } from "../run-execution/event-controller";
import type { SqliteStorage } from "../storage/sqlite-storage";
import type { ProductOwnerRunner } from "./product-owner-runner";

const workflowTurnSchema = z.discriminatedUnion("status", [
	z.object({
		question: z.string().min(1),
		recommendation: z.string().min(1),
		status: z.literal("QUESTION"),
	}),
	z.object({
		status: z.literal("COMPLETE"),
		summary: z.string().min(1),
	}),
]);

export interface StructuredSessionInvocation {
	readonly attemptId: string;
	readonly cwd: string;
	readonly effort?: "low" | "medium" | "high" | "xhigh" | "max";
	readonly limitMicrousd: number;
	readonly model: string;
	readonly output: "WORKFLOW_TURN" | "PRODUCT_OWNER_ANSWER";
	readonly prompt: string;
	readonly resume: boolean;
	readonly role: "WORKFLOW" | "PRODUCT_OWNER";
	readonly runId: string;
	readonly sessionId?: string;
	readonly taskId?: string;
}

export interface StructuredSessionPort {
	invoke(input: StructuredSessionInvocation): Promise<{
		readonly costMicrousd: number;
		readonly sessionId: string;
		readonly value: unknown;
	}>;
}

export class WorkflowStageRunner {
	constructor(
		private readonly storage: SqliteStorage,
		private readonly events: RunEventController,
		private readonly sessions: StructuredSessionPort,
		private readonly productOwner: ProductOwnerRunner,
	) {}

	async runStage(input: {
		readonly authorizationId: string;
		readonly initialAttemptId?: string;
		readonly productBrief: string;
		readonly runId: string;
		readonly stage: WorkflowStage;
		readonly targetRoot?: string;
		readonly task: string;
		readonly taskId: string;
	}) {
		const attemptId =
			input.initialAttemptId ??
			this.storage.scheduleAuthorizedOperation({
				authorizationId: input.authorizationId,
				kind: "WORKFLOW",
				role: capitalize(input.stage),
				roleType: "WORKFLOW",
				runId: input.runId,
			}).attemptId;
		this.storage.startAuthorizedOperation(attemptId);
		const dispatch = this.storage.readAuthorizedOperation(attemptId);
		const startedAt = Date.now();
		let sessionId: string | undefined;
		let costMicrousd = 0;
		const exchanges: {
			answer?: string;
			answeredAt?: string;
			question?: string;
			questionedAt?: string;
			recommendation?: string;
		}[] = [];

		try {
			for (let turn = 0; turn < MAX_STAGE_TURNS; turn += 1) {
				const response = await this.sessions.invoke({
					...dispatch,
					attemptId,
					cwd: input.targetRoot ?? process.cwd(),
					output: "WORKFLOW_TURN",
					prompt:
						turn === 0
							? `/${input.stage} ${input.taskId}\n\nRun the native /${input.stage} skill to completion. Return a structured question and recommendation when product input is required.`
							: `Product Owner answer:\n\n${exchanges.at(-1)?.answer}\n\nContinue the native /${input.stage} skill and complete its durable artifact.`,
					resume: turn > 0,
					role: "WORKFLOW",
					runId: input.runId,
					taskId: input.taskId,
					...(sessionId ? { sessionId } : {}),
				});
				const workflow = workflowTurnSchema.parse(response.value);
				sessionId = response.sessionId;
				costMicrousd += response.costMicrousd;
				if (workflow.status === "COMPLETE") {
					const completedAt = new Date().toISOString();
					const transcript = JSON.stringify({
						completedAt,
						exchanges,
						stage: input.stage,
						summary: workflow.summary,
					});
					const evidence = await new EvidenceIngestion(this.storage).stage({
						bytes: new TextEncoder().encode(transcript),
						kind: "JSON",
						logicalPath: `${input.stage}.transcript.json`,
						logicalSource: "STAGE_TRANSCRIPT",
						mediaType: "application/json",
						provenanceOperation: attemptId,
						runId: input.runId,
					});
					this.storage.completeAuthorizedOperation(
						attemptId,
						{
							costMicrousd,
							durationMs: Date.now() - startedAt,
							sessionId,
							value: { summary: workflow.summary },
						},
						undefined,
						evidence.id,
					);
					this.events.publishCommitted(
						this.storage.recordWorkflowTurn(
							{
								costMicrousd: response.costMicrousd,
								kind: "COMPLETE",
								operationAttemptId: attemptId,
								role: "WORKFLOW",
								runId: input.runId,
								sessionId,
								stage: input.stage,
								summary: workflow.summary,
							},
							{
								sequence: nextEventSequence(this.storage, input.runId),
								stage: input.stage,
								summary: workflow.summary,
								timestamp: completedAt,
								type: "WORKFLOW_COMPLETED",
							},
						),
					);
					this.events.publish(input.runId, attemptId, {
						evidenceId: evidence.id,
						sequence: nextEventSequence(this.storage, input.runId),
						sha256: evidence.sha256,
						stage: input.stage,
						timestamp: completedAt,
						type: "EVIDENCE_SEALED",
					});
					return { attemptId, evidenceId: evidence.id };
				}
				const questionedAt = new Date().toISOString();
				this.events.publishCommitted(
					this.storage.recordWorkflowTurn(
						{
							costMicrousd: response.costMicrousd,
							kind: "QUESTION",
							operationAttemptId: attemptId,
							question: workflow.question,
							recommendation: workflow.recommendation,
							role: "WORKFLOW",
							runId: input.runId,
							sessionId,
							stage: input.stage,
						},
						{
							question: workflow.question,
							recommendation: workflow.recommendation,
							sequence: nextEventSequence(this.storage, input.runId),
							stage: input.stage,
							timestamp: questionedAt,
							type: "WORKFLOW_QUESTION",
						},
					),
				);

				const productOwnerAttempt = this.storage.scheduleAuthorizedOperation({
					authorizationId: input.authorizationId,
					kind: "PRODUCT_OWNER",
					role: `${capitalize(input.stage)} Product Owner`,
					roleType: "PRODUCT_OWNER",
					runId: input.runId,
				});
				this.storage.startAuthorizedOperation(productOwnerAttempt.attemptId);
				const productOwnerStartedAt = Date.now();
				const productOwner = await (async () => {
					try {
						const answer = await this.productOwner.answer({
							eventSequence: nextEventSequence(this.storage, input.runId),
							operationAttemptId: productOwnerAttempt.attemptId,
							productBrief: input.productBrief,
							question: workflow.question,
							runId: input.runId,
							stage: input.stage,
							targetRoot: input.targetRoot ?? process.cwd(),
							task: input.task,
							taskId: input.taskId,
						});
						this.storage.completeAuthorizedOperation(
							productOwnerAttempt.attemptId,
							{
								costMicrousd: answer.costMicrousd,
								durationMs: Date.now() - productOwnerStartedAt,
								sessionId: answer.sessionId,
								value: { answer: answer.answer },
							},
						);

						return answer;
					} catch (error) {
						this.storage.failAuthorizedOperation(
							productOwnerAttempt.attemptId,
							error instanceof Error ? error.message : String(error),
						);
						throw error;
					}
				})();
				exchanges.push({
					answer: productOwner.answer,
					answeredAt: productOwner.timestamp,
					question: workflow.question,
					questionedAt,
					recommendation: workflow.recommendation,
				});
			}

			throw new Error(`${input.stage} exceeded its maximum turn count`);
		} catch (error) {
			this.storage.failAuthorizedOperation(
				attemptId,
				error instanceof Error ? error.message : String(error),
			);
			throw error;
		}
	}
}

function capitalize(stage: WorkflowStage) {
	return `${stage[0]?.toUpperCase()}${stage.slice(1)}`;
}

function nextEventSequence(storage: SqliteStorage, runId: string) {
	return (storage.readRunEvents(runId).at(-1)?.sequence ?? 0) + 1;
}
