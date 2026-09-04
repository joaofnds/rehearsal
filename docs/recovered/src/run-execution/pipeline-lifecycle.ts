import type { PipelineLifecycleLauncher } from "./run-coordinator";
import type { SqliteStorage } from "../storage/sqlite-storage";
import type { TargetSetup } from "../target-repository/target-setup";
import type { StageEvidenceCollector } from "../workflow/stage-evidence-collector";
import type { StageJudgeRunner } from "../workflow/stage-judge-runner";
import type { WorkflowStageRunner } from "../workflow/workflow-stage-runner";

export class PipelineLifecycle implements PipelineLifecycleLauncher {
	constructor(
		private readonly storage: SqliteStorage,
		private readonly setup: TargetSetup,
		private readonly workflow: WorkflowStageRunner,
		private readonly evidence: StageEvidenceCollector,
		private readonly stageJudge: StageJudgeRunner,
	) {}

	async launch(input: {
		readonly attemptId: string;
		readonly authorizationId: string;
		readonly runId: string;
	}) {
		const context = this.storage.readPipelineLifecycleContext(
			input.runId,
			input.authorizationId,
		);
		const setup = await this.setup.run({
			instructions: context.instructions,
			runId: input.runId,
			targetRoot: context.targetRoot,
			targetSha: context.targetSha,
			task: context.task,
		});
		if (!setup?.taskId || !setup.setupSha) {
			throw new Error("Target setup did not produce durable task facts");
		}
		this.storage.setRunPhase(input.runId, "DISCUSS");
		const workflow = await this.workflow.runStage({
			authorizationId: input.authorizationId,
			initialAttemptId: input.attemptId,
			productBrief: context.productBrief,
			runId: input.runId,
			stage: "discuss",
			targetRoot: context.targetRoot,
			task: context.task,
			taskId: setup.taskId,
		});
		const evidenceIds = await this.evidence.collectPlanningStage({
			instructions: context.instructions,
			productBrief: context.productBrief,
			provenanceOperation: workflow.attemptId,
			rubric: context.rubrics.discuss,
			runId: input.runId,
			setupSha: setup.setupSha,
			stage: "discuss",
			targetRoot: context.targetRoot,
			task: context.task,
			taskId: setup.taskId,
			transcriptEvidenceId: workflow.evidenceId,
		});
		this.storage.setRunPhase(input.runId, "DISCUSS_JUDGE");
		await this.stageJudge.run({
			authorizationId: input.authorizationId,
			evidenceIds,
			runId: input.runId,
			stage: "discuss",
			targetRoot: context.targetRoot,
		});
	}
}
