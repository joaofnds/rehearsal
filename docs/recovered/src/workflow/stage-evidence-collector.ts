import { captureBaselineContext } from "../benchmark/checks";
import {
	assertPlanningStageCompleted,
	readTaskState,
} from "../benchmark/backlog";
import type { WorkflowStage } from "../benchmark/config";
import { EvidenceIngestion } from "../evidence/evidence-ingestion";
import type { SqliteStorage } from "../storage/sqlite-storage";

export class StageEvidenceCollector {
	private readonly evidence: EvidenceIngestion;

	constructor(storage: SqliteStorage) {
		this.evidence = new EvidenceIngestion(storage);
	}

	async collectPlanningStage(input: {
		readonly instructions: string;
		readonly productBrief: string;
		readonly provenanceOperation: string;
		readonly rubric: string;
		readonly runId: string;
		readonly setupSha: string;
		readonly stage: Exclude<WorkflowStage, "build">;
		readonly targetRoot: string;
		readonly task: string;
		readonly taskId: string;
		readonly transcriptEvidenceId: string;
	}) {
		const taskState = await readTaskState(input.targetRoot, input.taskId);
		const planning = await assertPlanningStageCompleted(
			input.targetRoot,
			input.taskId,
			input.setupSha,
			input.stage,
			taskState,
		);
		const baselineContext = await captureBaselineContext(input.targetRoot);
		const frozenInputId = `${input.runId}:${input.stage}`;
		const ingestText = (
			logicalSource:
				| "TASK"
				| "PRODUCT_BRIEF"
				| "INSTRUCTIONS"
				| "TASK_STATE"
				| "BASELINE_CONTEXT"
				| "STAGE_RUBRIC"
				| "STAGE_ARTIFACT",
			logicalPath: string,
			content: string,
			kind: "TEXT" | "JSON" = "TEXT",
		) =>
			this.evidence.ingest({
				bytes: new TextEncoder().encode(content),
				frozenInputId,
				kind,
				logicalPath,
				logicalSource,
				mediaType: kind === "JSON" ? "application/json" : "text/plain",
				provenanceOperation: input.provenanceOperation,
				runId: input.runId,
			});
		const sources = await Promise.all([
			ingestText("TASK", "backlog-seed.md", input.task),
			ingestText("PRODUCT_BRIEF", "product-brief.md", input.productBrief),
			ingestText("INSTRUCTIONS", "CLAUDE.md", input.instructions),
			ingestText("TASK_STATE", `${input.taskId}.json`, planning.taskState, "JSON"),
			ingestText(
				"BASELINE_CONTEXT",
				"repository-context.json",
				JSON.stringify(baselineContext),
				"JSON",
			),
			ingestText(
				"STAGE_RUBRIC",
				`rubrics/${input.stage}.json`,
				input.rubric,
				"JSON",
			),
			ingestText(
				"STAGE_ARTIFACT",
				planning.artifact.path,
				planning.artifact.content,
			),
		]);

		return [
			...sources.slice(0, 6).map(({ id }) => id),
			input.transcriptEvidenceId,
			sources[6]?.id as string,
		];
	}
}
