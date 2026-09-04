import {
	type Effort,
	WORKFLOW_STAGES,
	type WorkflowStage,
} from "../benchmark/config";
import {
	type StreamingProcessInput,
	StreamingProcessRunner,
} from "../process/streaming-process-runner";
import type { WorkflowBaseline } from "../target-repository/workflow-baseline";
import { captureWorkflowBaseline } from "../target-repository/workflow-baseline";
import type { FinalJudgeRunner } from "../workflow/final-judge-runner";
import type { StageJudgeRunner } from "../workflow/stage-judge-runner";
import type { WorkflowStageRunner } from "../workflow/workflow-stage-runner";
import type { RunExecution } from "./run-state";

const workflowPhases = {
	build: "BUILD",
	discuss: "DISCUSS",
	grill: "GRILL",
	plan: "PLAN",
} as const;

const judgePhases = {
	build: "BUILD_JUDGE",
	discuss: "DISCUSS_JUDGE",
	grill: "GRILL_JUDGE",
	plan: "PLAN_JUDGE",
} as const;

interface RunStateStore {
	confirmPipelineAuthorization(
		previewId: string,
		baseline?: WorkflowBaseline,
	): {
		readonly attempt: {
			readonly id: string;
			readonly role: string;
			readonly state: "INTENDED";
		};
		readonly authorizationId: string;
		readonly runId: string;
		readonly shouldDispatch: boolean;
	};
	confirmRunOperation(input: {
		readonly attemptId: string;
		readonly expectedRunRevision: number;
		readonly runId: string;
	}): void;
	beginEmergencyInterrupt(input: {
		readonly expectedRunRevision: number;
		readonly previewId: string;
		readonly runId: string;
	}): {
		readonly attemptId: string;
		readonly pid: number;
		readonly startIdentity: string;
	};
	completeEmergencyInterrupt(input: {
		readonly attemptId: string;
		readonly previewId: string;
		readonly runId: string;
	}): void;
	createRunExecution(input: {
		readonly controlSha: string;
		readonly id: string;
		readonly maximumTotalMicrousd: number;
		readonly targetRoot: string;
		readonly targetSha: string;
	}): RunExecution;
	createRunOperationPreview(input: {
		readonly allowanceMicrousd: number;
		readonly effort?: Effort;
		readonly kind: string;
		readonly model: string;
		readonly role: string;
		readonly runId: string;
	}): { readonly attemptId: string; readonly runRevision: number };
	createPipelinePreview(preflightId: string): {
		readonly maximumTotalMicrousd: number;
		readonly previewId: string;
		readonly roles: readonly {
			readonly effort?: string;
			readonly label: string;
			readonly limitMicrousd: number;
			readonly model: string;
		}[];
	};
	createEmergencyInterruptPreview(runId: string): {
		readonly attemptId: string;
		readonly control: "EMERGENCY_INTERRUPT";
		readonly pid: number;
		readonly previewId: string;
		readonly runRevision: number;
		readonly startIdentity: string;
	};
	readPipelinePreview(previewId: string): {
		readonly preflight_id: string;
		readonly state: "AWAITING_CONFIRMATION" | "CONFIRMED" | "CANCELLED";
	} | null;
	readRunExecution(runId: string): RunExecution;
	requestGracefulStop(input: {
		readonly expectedRunRevision: number;
		readonly runId: string;
	}): void;
	scheduleAuthorizedOperation(input: {
		readonly authorizationId: string;
		readonly evidenceIds?: readonly string[];
		readonly kind: string;
		readonly role: string;
		readonly roleType:
			| "WORKFLOW"
			| "PRODUCT_OWNER"
			| "STAGE_JUDGE"
			| "FINAL_JUDGE";
		readonly runId: string;
	}): { readonly attemptId: string; readonly authorizationId: string };
	setRunPhase(
		runId: string,
		phase:
			| "DISCUSS"
			| "DISCUSS_JUDGE"
			| "GRILL"
			| "GRILL_JUDGE"
			| "PLAN"
			| "PLAN_JUDGE"
			| "BUILD"
			| "BUILD_JUDGE"
			| "FINAL_GRADE",
	): void;
	shouldStopGracefully(runId: string): boolean;
	startAuthorizedOperation(attemptId: string): void;
}

interface CurrentPreflightChecker {
	validateCurrent(
		preflightId: string,
	): Promise<{ readonly targetRoot: string }>;
}

export interface PipelineLifecycleLauncher {
	launch(input: {
		readonly attemptId: string;
		readonly authorizationId: string;
		readonly runId: string;
	}): Promise<void>;
}

export class RunCoordinator {
	private readonly backgroundFailures = new Map<string, unknown>();
	private readonly backgroundRuns = new Map<string, Promise<void>>();

	constructor(
		private readonly state: RunStateStore,
		private readonly preflights?: CurrentPreflightChecker,
		private readonly processes = new StreamingProcessRunner(),
		private pipelineLifecycle?: PipelineLifecycleLauncher,
	) {}

	setPipelineLifecycle(pipelineLifecycle: PipelineLifecycleLauncher) {
		this.pipelineLifecycle = pipelineLifecycle;
	}

	readBackgroundFailure(runId: string) {
		return this.backgroundFailures.get(runId);
	}

	createRun(input: Parameters<RunStateStore["createRunExecution"]>[0]) {
		return this.state.createRunExecution(input);
	}

	createOperationPreview(
		input: Parameters<RunStateStore["createRunOperationPreview"]>[0],
	) {
		return this.state.createRunOperationPreview(input);
	}

	confirmOperation(input: Parameters<RunStateStore["confirmRunOperation"]>[0]) {
		this.state.confirmRunOperation(input);
	}

	readRun(runId: string) {
		return this.state.readRunExecution(runId);
	}

	gracefulStop(input: Parameters<RunStateStore["requestGracefulStop"]>[0]) {
		this.state.requestGracefulStop(input);

		return {
			control: "GRACEFUL_STOP" as const,
			outcome: "GRACEFUL_USER_STOP" as const,
			runId: input.runId,
		};
	}

	createEmergencyInterruptPreview(runId: string) {
		return this.state.createEmergencyInterruptPreview(runId);
	}

	confirmEmergencyInterrupt(
		input: Parameters<RunStateStore["beginEmergencyInterrupt"]>[0],
	) {
		const target = this.state.beginEmergencyInterrupt(input);
		this.processes.interrupt(target);
		this.state.completeEmergencyInterrupt({
			attemptId: target.attemptId,
			previewId: input.previewId,
			runId: input.runId,
		});

		return {
			attemptId: target.attemptId,
			attemptState: "UNCERTAIN" as const,
			control: "EMERGENCY_INTERRUPT" as const,
			outcome: "EMERGENCY_INTERRUPTION" as const,
			runId: input.runId,
		};
	}

	runProcess(
		input: StreamingProcessInput & {
			readonly attemptId: string;
			readonly runId: string;
		},
	) {
		this.state.startAuthorizedOperation(input.attemptId);
		const { attemptId: _attemptId, runId: _runId, ...processInput } = input;

		return this.processes.run(processInput);
	}

	createPipelinePreview(preflightId: string) {
		return this.state.createPipelinePreview(preflightId);
	}

	async confirmPipeline(previewId: string) {
		const preview = this.state.readPipelinePreview(previewId);
		if (!preview || preview.state === "CANCELLED") {
			throw new Error("Pipeline preview is missing or stale");
		}
		let baseline: WorkflowBaseline | undefined;
		if (preview.state === "AWAITING_CONFIRMATION") {
			if (!this.preflights) throw new Error("Preflight checker is unavailable");
			const preflight = await this.preflights.validateCurrent(
				preview.preflight_id,
			);
			baseline = await captureWorkflowBaseline(preflight.targetRoot);
		}
		const { shouldDispatch, ...authorization } =
			this.state.confirmPipelineAuthorization(previewId, baseline);
		if (shouldDispatch) this.launchPipeline(authorization);

		return authorization;
	}

	private launchPipeline(input: {
		readonly attempt: { readonly id: string };
		readonly authorizationId: string;
		readonly runId: string;
	}) {
		if (!this.pipelineLifecycle || this.backgroundRuns.has(input.runId)) return;
		const launched = Promise.resolve().then(() =>
			this.pipelineLifecycle?.launch({
				attemptId: input.attempt.id,
				authorizationId: input.authorizationId,
				runId: input.runId,
			}),
		);
		this.backgroundRuns.set(
			input.runId,
			launched
				.then(() => undefined)
				.catch((error) => this.backgroundFailures.set(input.runId, error)),
		);
	}

	scheduleAuthorizedOperation(
		input: Parameters<RunStateStore["scheduleAuthorizedOperation"]>[0],
	) {
		return this.state.scheduleAuthorizedOperation(input);
	}

	async runJudgeLifecycle(
		input: {
			readonly authorizationId: string;
			readonly finalEvidenceIds: readonly string[];
			readonly initialWorkflowAttemptId: string;
			readonly productBrief: string;
			readonly runId: string;
			readonly stageEvidenceIds: Record<WorkflowStage, readonly string[]>;
			readonly task: string;
			readonly taskId: string;
			readonly targetRoot?: string;
		},
		runners: {
			readonly finalJudge: FinalJudgeRunner;
			readonly stageJudge: StageJudgeRunner;
			readonly workflow: WorkflowStageRunner;
		},
	) {
		for (const stage of WORKFLOW_STAGES) {
			if (this.state.shouldStopGracefully(input.runId)) {
				return { status: "GRACEFUL_STOPPED" as const };
			}
			this.state.setRunPhase(input.runId, workflowPhases[stage]);
			const workflow = await runners.workflow.runStage({
				authorizationId: input.authorizationId,
				...(stage === "discuss"
					? { initialAttemptId: input.initialWorkflowAttemptId }
					: {}),
				productBrief: input.productBrief,
				runId: input.runId,
				stage,
				targetRoot: input.targetRoot,
				task: input.task,
				taskId: input.taskId,
			});
			if (this.state.shouldStopGracefully(input.runId)) {
				return { status: "GRACEFUL_STOPPED" as const };
			}
			this.state.setRunPhase(input.runId, judgePhases[stage]);
			const scorecard = await runners.stageJudge.run({
				authorizationId: input.authorizationId,
				evidenceIds: [...input.stageEvidenceIds[stage], workflow.evidenceId],
				runId: input.runId,
				stage,
				targetRoot: input.targetRoot,
			});
			if (this.state.shouldStopGracefully(input.runId)) {
				return { status: "GRACEFUL_STOPPED" as const };
			}
			if (scorecard.status === "JUDGE_FAILED") return scorecard;
			if (scorecard.verdict === "STOP") {
				return {
					grade: scorecard.grade,
					origin: scorecard.origin,
					stage,
					status: "STAGE_STOPPED" as const,
				};
			}
		}

		this.state.setRunPhase(input.runId, "FINAL_GRADE");
		const final = await runners.finalJudge.run({
			authorizationId: input.authorizationId,
			evidenceIds: input.finalEvidenceIds,
			runId: input.runId,
			targetRoot: input.targetRoot,
		});
		if (this.state.shouldStopGracefully(input.runId)) {
			return { status: "GRACEFUL_STOPPED" as const };
		}
		return final;
	}
}
