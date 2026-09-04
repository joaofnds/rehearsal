import { join } from "node:path";
import type { NestApplicationOptions } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { BenchmarkDefinitionService } from "../benchmark-definition/benchmark-definition-service";
import { ControlChangeService } from "../control-repository/control-change-set";
import type { ControlApplyBarrierEvent } from "../control-repository/control-repository-adapter";
import { ControlRepositoryAdapter } from "../control-repository/control-repository-adapter";
import {
	ClaudeInstructionReviewRunner,
	type InstructionReviewRunner,
} from "../control-repository/instruction-review-runner";
import { StreamingProcessRunner } from "../process/streaming-process-runner";
import { RunHistoryService } from "../run-archive/legacy-run-reader";
import { RunEventController } from "../run-execution/event-controller";
import { PipelineLifecycle } from "../run-execution/pipeline-lifecycle";
import { RestorationController } from "../run-execution/restoration-controller";
import {
	type PipelineLifecycleLauncher,
	RunCoordinator,
} from "../run-execution/run-coordinator";
import { StartupReconciliation } from "../run-execution/startup-reconciliation";
import { SqliteStorage } from "../storage/sqlite-storage";
import { TargetPreflight } from "../target-repository/target-preflight";
import {
	TargetSetup,
	type TargetSetupBarrier,
} from "../target-repository/target-setup";
import type { TargetRestorationBarrier } from "../target-repository/target-restoration";
import { EvidenceIngestion } from "../evidence/evidence-ingestion";
import { ClaudeSessionAdapter } from "../workflow/claude-session-adapter";
import { ProductOwnerRunner } from "../workflow/product-owner-runner";
import { StageEvidenceCollector } from "../workflow/stage-evidence-collector";
import type { JudgeInvocationPort } from "../workflow/stage-judge-runner";
import { StageJudgeRunner } from "../workflow/stage-judge-runner";
import type { StructuredSessionPort } from "../workflow/workflow-stage-runner";
import { WorkflowStageRunner } from "../workflow/workflow-stage-runner";
import { createAppModule } from "./app-module";

export interface BrowserLauncher {
	launch(url: URL): Promise<void>;
}

interface StartApplicationOptions {
	readonly browserLauncher?: BrowserLauncher;
	readonly controlApplyBarrier?: (
		event: ControlApplyBarrierEvent,
	) => Promise<void> | void;
	readonly controlDirectory: string;
	readonly logger?: NestApplicationOptions["logger"];
	readonly instructionReviewer?: InstructionReviewRunner;
	readonly judgeInvocations?: JudgeInvocationPort;
	readonly onBrowserLaunchFailure?: (error: unknown, url: URL) => void;
	readonly onReady?: (url: URL) => void;
	readonly pipelineLifecycle?: PipelineLifecycleLauncher;
	readonly restorationBarrier?: TargetRestorationBarrier;
	readonly storagePath: string;
	readonly structuredSessions?: StructuredSessionPort;
	readonly targetSetupBarrier?: TargetSetupBarrier;
}

export async function startApplication(options: StartApplicationOptions) {
	const storage = SqliteStorage.open(options.storagePath);

	try {
		const changes = new ControlChangeService(
			storage,
			new ControlRepositoryAdapter(
				options.controlDirectory,
				options.controlApplyBarrier,
			),
			options.instructionReviewer ??
				new ClaudeInstructionReviewRunner(options.controlDirectory),
		);
		const reconciliation = await changes.reconcile();
		const definitions = new BenchmarkDefinitionService(
			storage,
			options.controlDirectory,
		);
		await definitions.initialize(reconciliation);
		const history = new RunHistoryService(
			storage,
			join(options.controlDirectory, ".benchmark-runs"),
		);
		const preflight = new TargetPreflight(
			storage,
			definitions,
			options.controlDirectory,
		);
		const processes = new StreamingProcessRunner();
		const coordinator = new RunCoordinator(
			storage,
			preflight,
			processes,
			options.pipelineLifecycle,
		);
		const startupReconciliation = new StartupReconciliation(storage);
		startupReconciliation.reconcile();
		const restoration = new RestorationController(
			storage,
			options.restorationBarrier,
		);
		const application = await NestFactory.create(
			createAppModule(
				storage,
				definitions,
				changes,
				history,
				preflight,
				coordinator,
				processes,
				startupReconciliation,
				restoration,
			),
			{ logger: options.logger },
		);
		if (!options.pipelineLifecycle) {
			const events = application.get(RunEventController);
			const claude = new ClaudeSessionAdapter(processes, events);
			const sessions = options.structuredSessions ?? claude;
			const judges = options.judgeInvocations ?? claude;
			coordinator.setPipelineLifecycle(
				new PipelineLifecycle(
					storage,
					new TargetSetup(storage, options.targetSetupBarrier),
					new WorkflowStageRunner(
						storage,
						events,
						sessions,
						new ProductOwnerRunner(storage, events, sessions),
					),
					new StageEvidenceCollector(storage),
					new StageJudgeRunner(
						storage,
						new EvidenceIngestion(storage),
						judges,
					),
				),
			);
		}
		await application.listen(0, "127.0.0.1");
		const url = new URL(await application.getUrl());
		options.onReady?.(url);
		if (options.browserLauncher) {
			try {
				await options.browserLauncher.launch(url);
			} catch (error) {
				options.onBrowserLaunchFailure?.(error, url);
			}
		}

		return application;
	} catch (error) {
		storage.close();
		throw error;
	}
}
