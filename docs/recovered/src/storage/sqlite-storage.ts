import { Database, SQLiteError } from "bun:sqlite";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { effortSchema, type WorkflowStage } from "../benchmark/config";
import {
	controlDefinitionPathSchema,
	type DefinitionPart,
	DefinitionRevisionConflictError,
} from "../benchmark-definition/benchmark-definition-schema";
import type { FrozenControlPath } from "../control-repository/control-repository-adapter";
import {
	type EvidenceObject,
	evidenceObjectSchema,
} from "../evidence/evidence-object";
import {
	ControlChangeConflictError,
	DefinitionMutationLockedError,
	transitionOperationAttempt,
} from "../operations/operation-attempt";
import { normalizedRunSummarySchema } from "../run-archive/legacy-run-reader";
import { assertAllowanceAvailable } from "../run-execution/budget-ledger";
import { type RunEvent, runEventSchema } from "../run-execution/run-event";
import {
	ActiveRunConflictError,
	RunBudgetExceededError,
	type RunConfiguration,
	RunControlConflictError,
	type RunExecution,
	RunRevisionConflictError,
	runConfigurationSchema,
	runExecutionSchema,
} from "../run-execution/run-state";
import type {
	StartupRecoveryAction,
	StartupRecoveryProof,
} from "../run-execution/startup-reconciliation";
import type {
	WorkflowBaseline,
	WorkflowBaselineEntry,
} from "../target-repository/workflow-baseline";
import { localFoundationMigration } from "./migrations/0001-local-foundation";
import { durableRunsMigration } from "./migrations/0002-durable-runs";
import { runPreflightsMigration } from "./migrations/0003-run-preflights";
import { pipelineAuthorizationsMigration } from "./migrations/0004-pipeline-authorizations";
import { workflowBaselinesMigration } from "./migrations/0005-workflow-baselines";
import { runEventsMigration } from "./migrations/0006-run-events";
import { workflowTranscriptsMigration } from "./migrations/0007-workflow-transcripts";
import { judgeLifecycleMigration } from "./migrations/0008-judge-lifecycle";
import { evidenceConvergenceMigration } from "./migrations/0009-evidence-convergence";
import { runLifecycleContextMigration } from "./migrations/0010-run-lifecycle-context";
import { applySqliteMigrations } from "./sqlite-migrations";

export const APPLICATION_ID = 0x544f5053;

interface WorkflowTurnRecord {
	readonly answer?: string;
	readonly costMicrousd: number;
	readonly kind: "QUESTION" | "ANSWER" | "COMPLETE";
	readonly operationAttemptId: string;
	readonly question?: string;
	readonly recommendation?: string;
	readonly role: "WORKFLOW" | "PRODUCT_OWNER";
	readonly runId: string;
	readonly sessionId: string;
	readonly stage: WorkflowStage;
	readonly summary?: string;
}

const diagnosticsSchema = z.object({
	applicationId: z.number(),
	busyTimeout: z.number(),
	cellSizeCheck: z.number(),
	foreignKeys: z.number(),
	journalMode: z.string(),
	lockingMode: z.string(),
	mmapSize: z.number(),
	synchronous: z.number(),
	trustedSchema: z.number(),
});

export type StorageDiagnostics = z.infer<typeof diagnosticsSchema>;
export type RunLifecycleState =
	| "ACTIVE"
	| "AWAITING_JUDGE"
	| "AWAITING_HUMAN_REVIEW"
	| "AWAITING_CALIBRATION_CONFIRMATION"
	| "RESTORING"
	| "RESTORED"
	| "COMPLETE"
	| "UNCERTAIN";

export class StorageOwnershipError extends Error {
	readonly code = "STORAGE_OWNERSHIP_CONFLICT" as const;
}

export class PreferenceConflictError extends Error {
	readonly code = "PREFERENCE_VERSION_CONFLICT" as const;
}

export class SqliteStorage {
	private closed = false;

	private constructor(private readonly database: Database) {}

	static open(path: string) {
		mkdirSync(dirname(path), { mode: 0o700, recursive: true });
		chmodSync(dirname(path), 0o700);
		const database = new Database(path, { create: true, strict: true });

		try {
			database.run("PRAGMA journal_mode = DELETE");
			database.run("PRAGMA synchronous = EXTRA");
			database.run("PRAGMA foreign_keys = ON");
			database.run("PRAGMA trusted_schema = OFF");
			database.run("PRAGMA cell_size_check = ON");
			database.run("PRAGMA busy_timeout = 5000");
			database.run("PRAGMA locking_mode = EXCLUSIVE");
			database.run("PRAGMA mmap_size = 0");
			database.run("BEGIN EXCLUSIVE");
			database.run("COMMIT");
			chmodSync(path, 0o600);

			const storage = new SqliteStorage(database);
			const applicationId = storage.readNumber("application_id");
			if (applicationId !== 0 && applicationId !== APPLICATION_ID) {
				throw new Error(`Unexpected SQLite application ID: ${applicationId}`);
			}
			if (applicationId === 0) {
				database.run(`PRAGMA application_id = ${APPLICATION_ID}`);
			}
			applySqliteMigrations(database, path, [
				localFoundationMigration,
				durableRunsMigration,
				runPreflightsMigration,
				pipelineAuthorizationsMigration,
				workflowBaselinesMigration,
				runEventsMigration,
				workflowTranscriptsMigration,
				judgeLifecycleMigration,
				evidenceConvergenceMigration,
				runLifecycleContextMigration,
			]);
			storage.verify();
			database.run("PRAGMA optimize = 0x10002");

			return storage;
		} catch (error) {
			database.close(true);
			if (
				error instanceof SQLiteError &&
				(error.code?.startsWith("SQLITE_BUSY") ||
					error.code?.startsWith("SQLITE_LOCKED"))
			) {
				throw new StorageOwnershipError(
					"Private application storage is already owned by another process",
					{ cause: error },
				);
			}
			throw error;
		}
	}

	readDiagnostics(): StorageDiagnostics {
		return diagnosticsSchema.parse({
			applicationId: this.readNumber("application_id"),
			busyTimeout: this.readNumber("busy_timeout"),
			cellSizeCheck: this.readNumber("cell_size_check"),
			foreignKeys: this.readNumber("foreign_keys"),
			journalMode: this.readString("journal_mode"),
			lockingMode: this.readString("locking_mode"),
			mmapSize: this.readNumber("mmap_size"),
			synchronous: this.readNumber("synchronous"),
			trustedSchema: this.readNumber("trusted_schema"),
		});
	}

	readThemePreference() {
		return (
			z
				.object({
					theme: z.enum(["system", "light", "dark"]),
					version: z.number().int().positive(),
				})
				.nullable()
				.parse(
					this.database
						.query(
							"SELECT version, theme FROM application_preferences WHERE singleton = 1",
						)
						.get(),
				) ?? { theme: "system" as const, version: 0 }
		);
	}

	updateThemePreference(input: {
		readonly expectedVersion: number;
		readonly theme: "system" | "light" | "dark";
	}) {
		const current = this.readThemePreference();
		if (current.version !== input.expectedVersion) {
			throw new PreferenceConflictError("Theme preference version is stale");
		}
		const version = current.version + 1;
		this.database
			.query(
				`INSERT INTO application_preferences (singleton, version, theme, updated_at)
				VALUES (1, ?, ?, ?)
				ON CONFLICT(singleton) DO UPDATE SET version = excluded.version,
					theme = excluded.theme, updated_at = excluded.updated_at`,
			)
			.run(version, input.theme, new Date().toISOString());
		return { theme: input.theme, version };
	}

	readSchemaVersion() {
		return this.readNumber("user_version");
	}

	readEffectiveDefinition() {
		const revision = z
			.object({
				control_branch: z.string(),
				control_sha: z.string(),
				control_state: z.enum(["READY", "CONTROL_DIVERGED"]),
				id: z.string(),
				revision: z.number().int().positive(),
			})
			.nullable()
			.parse(
				this.database
					.query(
						`SELECT revision.id, revision.revision, revision.control_sha,
							revision.control_branch, effective.control_state
						FROM effective_definition effective
						JOIN definition_revisions revision
							ON revision.id = effective.definition_revision_id
						WHERE effective.singleton = 1`,
					)
					.get(),
			);
		if (!revision) return undefined;

		return {
			controlBranch: revision.control_branch,
			controlSha: revision.control_sha,
			controlState: revision.control_state,
			parts: this.readDefinitionParts(revision.id),
			revision: revision.revision,
		};
	}

	readActiveRunLifecycle() {
		return z
			.object({
				lifecycle_state: z.enum([
					"ACTIVE",
					"AWAITING_JUDGE",
					"AWAITING_HUMAN_REVIEW",
					"AWAITING_CALIBRATION_CONFIRMATION",
					"RESTORING",
					"RESTORED",
					"COMPLETE",
					"UNCERTAIN",
				]),
			})
			.nullable()
			.parse(
				this.database
					.query(
						`SELECT run.lifecycle_state FROM active_run_slot slot
						JOIN runs run ON run.id = slot.run_id WHERE slot.singleton = 1`,
					)
					.get(),
			)?.lifecycle_state;
	}

	recordRunPreflight(input: {
		readonly configuration: unknown;
		readonly controlRoot: string;
		readonly controlSha: string;
		readonly definitionRevision: number;
		readonly id: string;
		readonly prerequisites: unknown;
		readonly targetRoot: string;
		readonly targetSha: string;
	}) {
		const definition = z
			.object({ id: z.string() })
			.parse(
				this.database
					.query(
						"SELECT id FROM definition_revisions WHERE revision = ? AND kind = 'EFFECTIVE'",
					)
					.get(input.definitionRevision),
			);
		this.database
			.query(
				`INSERT INTO run_preflights
					(id, definition_revision_id, status, configuration_json,
					 control_root, control_sha, target_root, target_sha,
					 prerequisites_json, created_at)
				VALUES (?, ?, 'SUCCEEDED', ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				input.id,
				definition.id,
				JSON.stringify(input.configuration),
				input.controlRoot,
				input.controlSha,
				input.targetRoot,
				input.targetSha,
				JSON.stringify(input.prerequisites),
				new Date().toISOString(),
			);
	}

	cancelRunPreflight(preflightId: string) {
		const result = this.database
			.query(
				`UPDATE run_preflights SET status = 'CANCELLED', cancelled_at = ?
				WHERE id = ? AND status = 'SUCCEEDED'`,
			)
			.run(new Date().toISOString(), preflightId);

		return result.changes === 1;
	}

	readRunPreflight(preflightId: string) {
		const row = z
			.object({
				configuration_json: z.string(),
				control_root: z.string(),
				control_sha: z.string(),
				definition_revision_id: z.string(),
				revision: z.number().int().positive(),
				status: z.enum(["SUCCEEDED", "CANCELLED"]),
				target_root: z.string(),
				target_sha: z.string(),
			})
			.nullable()
			.parse(
				this.database
					.query(
						`SELECT preflight.status, preflight.configuration_json,
							preflight.control_root, preflight.control_sha,
							preflight.target_root, preflight.target_sha,
							preflight.definition_revision_id, revision.revision
						FROM run_preflights preflight
						JOIN definition_revisions revision
							ON revision.id = preflight.definition_revision_id
						WHERE preflight.id = ?`,
					)
					.get(preflightId),
			);
		if (!row) return undefined;

		return {
			configuration: runConfigurationSchema.parse(
				JSON.parse(row.configuration_json),
			),
			controlRoot: row.control_root,
			controlSha: row.control_sha,
			definitionRevision: row.revision,
			definitionRevisionId: row.definition_revision_id,
			status: row.status,
			targetRoot: row.target_root,
			targetSha: row.target_sha,
		};
	}

	createPipelinePreview(preflightId: string) {
		const preflight = this.readRunPreflight(preflightId);
		if (preflight?.status !== "SUCCEEDED") {
			throw new RunRevisionConflictError(
				"A current successful preflight is required",
			);
		}
		const previewId = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		const preview = {
			controlSha: preflight.controlSha,
			definitionRevision: preflight.definitionRevision,
			maximumTotalMicrousd: preflight.configuration.maximumTotalMicrousd,
			previewId,
			roles: pipelineRoles(preflight.configuration),
			targetSha: preflight.targetSha,
		};
		this.database
			.query(
				`INSERT INTO pipeline_previews
					(id, preflight_id, state, preview_json, created_at, updated_at)
				VALUES (?, ?, 'AWAITING_CONFIRMATION', ?, ?, ?)`,
			)
			.run(
				previewId,
				preflightId,
				JSON.stringify(preview),
				timestamp,
				timestamp,
			);

		return preview;
	}

	readPipelinePreview(previewId: string) {
		return z
			.object({
				preflight_id: z.string(),
				state: z.enum(["AWAITING_CONFIRMATION", "CONFIRMED", "CANCELLED"]),
			})
			.nullable()
			.parse(
				this.database
					.query(
						"SELECT preflight_id, state FROM pipeline_previews WHERE id = ?",
					)
					.get(previewId),
			);
	}

	readPipelineLifecycleContext(runId: string, authorizationId: string) {
		const authorization = z
			.object({
				definition_revision_id: z.string(),
				target_root: z.string(),
				target_sha: z.string(),
			})
			.parse(
				this.database
					.query(
						`SELECT definition_revision_id, target_root, target_sha
						FROM pipeline_authorizations WHERE id = ? AND run_id = ?`,
					)
					.get(authorizationId, runId),
			);
		const parts = this.readDefinitionParts(authorization.definition_revision_id);
		const byPath = new Map(parts.map((part) => [part.path, part.content]));
		const readPart = (path: DefinitionPart["path"]) => {
			const content = byPath.get(path);
			if (content === undefined) {
				throw new Error(`Authorized definition is missing ${path}`);
			}

			return content;
		};

		return {
			instructions: readPart("CLAUDE.md"),
			productBrief: readPart("product-brief.md"),
			rubrics: {
				build: readPart("rubrics/build.json"),
				discuss: readPart("rubrics/discuss.json"),
				grill: readPart("rubrics/grill.json"),
				plan: readPart("rubrics/plan.json"),
			},
			targetRoot: authorization.target_root,
			targetSha: authorization.target_sha,
			task: readPart("backlog-seed.md"),
		};
	}

	createTargetSetupIntent(input: {
		readonly expectedDescription: string;
		readonly expectedTitle: string;
		readonly instructionSha256: string;
		readonly originalBranch: string;
		readonly originalSha: string;
		readonly originalStatus: string;
		readonly preTaskIds: readonly string[];
		readonly runId: string;
		readonly targetRoot: string;
	}) {
		const attemptId = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`INSERT INTO operation_attempts
						(id, kind, state, run_id, lifecycle_revision, preview_json,
						 intent_json, role, created_at, updated_at)
					VALUES (?, 'TARGET_SETUP', 'INTENDED', ?, 1, ?, ?, 'Target setup', ?, ?)`,
				)
				.run(
					attemptId,
					input.runId,
					JSON.stringify({ role: "Target setup" }),
					JSON.stringify({ action: "CONFIGURE_TARGET" }),
					timestamp,
					timestamp,
				);
			this.database
				.query(
					`INSERT INTO target_setup_operations
						(run_id, operation_attempt_id, pre_task_ids_json, expected_title,
						 expected_description, instruction_sha256, target_root,
						 original_branch, original_sha, original_status,
						 expected_commit_subject, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
						'chore: configure project instructions', ?, ?)`,
				)
				.run(
					input.runId,
					attemptId,
					JSON.stringify([...input.preTaskIds].sort()),
					input.expectedTitle,
					input.expectedDescription,
					input.instructionSha256,
					input.targetRoot,
					input.originalBranch,
					input.originalSha,
					input.originalStatus,
					timestamp,
					timestamp,
				);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}

		return this.readTargetSetup(input.runId);
	}

	readTargetSetup(runId: string) {
		const row = z
			.object({
				expected_commit_subject: z.string(),
				expected_description: z.string(),
				expected_title: z.string(),
				instruction_sha256: z.string().length(64),
				operation_attempt_id: z.string(),
				original_branch: z.string(),
				original_sha: z.string(),
				original_status: z.string(),
				pre_task_ids_json: z.string(),
				setup_sha: z.string().nullable(),
				state: z.enum([
					"INTENDED",
					"RUNNING",
					"SUCCEEDED",
					"FAILED",
					"UNCERTAIN",
				]),
				target_root: z.string(),
				task_id: z.string().nullable(),
			})
			.nullable()
			.parse(
				this.database
					.query(
						`SELECT setup.*, attempt.state
						FROM target_setup_operations setup
						JOIN operation_attempts attempt
							ON attempt.id = setup.operation_attempt_id
						WHERE setup.run_id = ?`,
					)
					.get(runId),
			);
		if (!row) return undefined;

		return {
			expectedCommitSubject: row.expected_commit_subject,
			expectedDescription: row.expected_description,
			expectedTitle: row.expected_title,
			instructionSha256: row.instruction_sha256,
			operationAttemptId: row.operation_attempt_id,
			originalBranch: row.original_branch,
			originalSha: row.original_sha,
			originalStatus: row.original_status,
			preTaskIds: z.array(z.string()).parse(JSON.parse(row.pre_task_ids_json)),
			runId,
			setupSha: row.setup_sha ?? undefined,
			state: row.state,
			targetRoot: row.target_root,
			taskId: row.task_id ?? undefined,
		};
	}

	startTargetSetup(runId: string) {
		const result = this.database
			.query(
				`UPDATE operation_attempts SET state = 'RUNNING', updated_at = ?
				WHERE id = (SELECT operation_attempt_id FROM target_setup_operations
					WHERE run_id = ?) AND state = 'INTENDED'`,
			)
			.run(new Date().toISOString(), runId);
		if (result.changes !== 1) throw new Error("Target setup is not intended");
	}

	retryTargetSetup(runId: string) {
		const result = this.database
			.query(
				`UPDATE operation_attempts SET state = 'RUNNING', terminal_json = NULL,
					updated_at = ? WHERE id = (
						SELECT operation_attempt_id FROM target_setup_operations WHERE run_id = ?
					) AND state = 'UNCERTAIN'`,
			)
			.run(new Date().toISOString(), runId);
		if (result.changes !== 1) throw new Error("Target setup is not uncertain");
	}

	completeTargetSetup(input: {
		readonly observed: unknown;
		readonly runId: string;
		readonly setupSha: string;
		readonly taskId: string;
	}) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const updated = this.database
				.query(
					`UPDATE operation_attempts SET state = 'SUCCEEDED', terminal_json = ?,
						updated_at = ? WHERE id = (
							SELECT operation_attempt_id FROM target_setup_operations WHERE run_id = ?
						) AND state = 'RUNNING'`,
				)
				.run(
					JSON.stringify({ setupSha: input.setupSha, taskId: input.taskId }),
					timestamp,
					input.runId,
				);
			if (updated.changes !== 1) throw new Error("Target setup is not running");
			this.database
				.query(
					`UPDATE target_setup_operations SET task_id = ?, setup_sha = ?,
						observed_json = ?, updated_at = ? WHERE run_id = ?`,
				)
				.run(
					input.taskId,
					input.setupSha,
					JSON.stringify(input.observed),
					timestamp,
					input.runId,
				);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	finishTargetSetupFailure(input: {
		readonly message: string;
		readonly observed: unknown;
		readonly runId: string;
		readonly state: "FAILED" | "UNCERTAIN";
	}) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`UPDATE operation_attempts SET state = ?, terminal_json = ?, updated_at = ?
					WHERE id = (SELECT operation_attempt_id FROM target_setup_operations
						WHERE run_id = ?) AND state IN ('INTENDED', 'RUNNING')`,
				)
				.run(
					input.state,
					JSON.stringify({ message: input.message }),
					timestamp,
					input.runId,
				);
			this.database
				.query(
					`UPDATE target_setup_operations SET observed_json = ?, updated_at = ?
					WHERE run_id = ?`,
				)
				.run(JSON.stringify(input.observed), timestamp, input.runId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	readOperationEvidence(attemptId: string) {
		return z
			.array(
				z.object({
					byteLength: z.number().int().nonnegative(),
					frozenInputId: z.string(),
					id: z.string(),
					kind: z.enum(["TEXT", "JSON", "EVENT_STREAM", "DIFF"]),
					logicalPath: z.string(),
					logicalSource: z.string(),
					mediaType: z.string(),
					provenanceOperation: z.string(),
					runId: z.string(),
					sha256: z.string().length(64),
					state: z.literal("SEALED"),
				}),
			)
			.parse(
				this.database
					.query(
						`SELECT object.id, object.run_id AS runId,
							object.frozen_input_id AS frozenInputId,
							object.provenance_operation AS provenanceOperation,
							object.logical_source AS logicalSource,
							object.logical_path AS logicalPath, object.kind,
							object.media_type AS mediaType, object.state,
							object.byte_length AS byteLength, object.sha256
						FROM operation_attempt_evidence manifest
						JOIN sealed_evidence_objects object ON object.id = manifest.evidence_id
						WHERE manifest.operation_attempt_id = ? ORDER BY manifest.ordinal`,
					)
					.all(attemptId),
			);
	}

	confirmPipelineAuthorization(previewId: string, baseline?: WorkflowBaseline) {
		const runId = crypto.randomUUID();
		const authorizationId = crypto.randomUUID();
		const attemptId = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const row = z
				.object({
					configuration_json: z.string(),
					control_sha: z.string(),
					definition_revision_id: z.string(),
					preflight_id: z.string(),
					state: z.enum(["AWAITING_CONFIRMATION", "CONFIRMED", "CANCELLED"]),
					status: z.literal("SUCCEEDED"),
					target_root: z.string(),
					target_sha: z.string(),
				})
				.parse(
					this.database
						.query(
							`SELECT preview.state, preflight.id AS preflight_id,
								preflight.status, preflight.configuration_json,
								preflight.control_sha, preflight.target_root,
								preflight.target_sha, preflight.definition_revision_id
							FROM pipeline_previews preview
							JOIN run_preflights preflight ON preflight.id = preview.preflight_id
							WHERE preview.id = ?`,
						)
						.get(previewId),
				);
			if (row.state === "CONFIRMED") {
				const existing = z
					.object({
						attempt_id: z.string(),
						authorization_id: z.string(),
						run_id: z.string(),
					})
					.parse(
						this.database
							.query(
								`SELECT authorization.id AS authorization_id,
									authorization.run_id, attempt.id AS attempt_id
								FROM pipeline_previews preview
								JOIN pipeline_authorizations authorization
									ON authorization.preflight_id = preview.preflight_id
								JOIN operation_attempts attempt
									ON attempt.pipeline_authorization_id = authorization.id
								WHERE preview.id = ? AND preview.state = 'CONFIRMED'
									AND attempt.kind = 'WORKFLOW' AND attempt.role = 'Discuss'
									AND attempt.lifecycle_revision = 1`,
							)
							.get(previewId),
					);
				this.database.run("COMMIT");

				return {
					attempt: {
						id: existing.attempt_id,
						role: "Discuss",
						state: "INTENDED" as const,
					},
					authorizationId: existing.authorization_id,
					runId: existing.run_id,
					shouldDispatch: false,
				};
			}
			if (row.state !== "AWAITING_CONFIRMATION" || !baseline) {
				throw new Error("Pipeline preview is missing or stale");
			}
			const configuration = runConfigurationSchema.parse(
				JSON.parse(row.configuration_json),
			);
			const slot = z
				.object({ run_id: z.string().nullable() })
				.parse(
					this.database
						.query("SELECT run_id FROM active_run_slot WHERE singleton = 1")
						.get(),
				);
			if (slot.run_id !== null) {
				throw new ActiveRunConflictError("Another Run owns the active slot");
			}
			assertAllowanceAvailable({
				actualCostMicrousd: 0,
				allowanceMicrousd: configuration.paidRoles.workflow.limitMicrousd,
				maximumTotalMicrousd: configuration.maximumTotalMicrousd,
				reservedMicrousd: 0,
			});

			this.database
				.query(
					`INSERT INTO runs
						(id, schema_version, lifecycle_state, definition_revision_id,
						 summary_json, created_at, updated_at, revision, phase,
						 restoration_state, control_sha, target_root, target_sha,
						 maximum_total_microusd, reserved_microusd, actual_cost_microusd)
					VALUES (?, 4, 'ACTIVE', ?, ?, ?, ?, 1, 'SETUP', 'PENDING',
						?, ?, ?, ?, ?, 0)`,
				)
				.run(
					runId,
					row.definition_revision_id,
					JSON.stringify({ model: configuration.paidRoles.workflow.model }),
					timestamp,
					timestamp,
					row.control_sha,
					row.target_root,
					row.target_sha,
					configuration.maximumTotalMicrousd,
					configuration.paidRoles.workflow.limitMicrousd,
				);
			this.insertWorkflowBaseline(runId, baseline, timestamp);
			this.database
				.query("UPDATE active_run_slot SET run_id = ? WHERE singleton = 1")
				.run(runId);
			this.database
				.query(
					`INSERT INTO pipeline_authorizations
						(id, run_id, preflight_id, definition_revision_id,
						 maximum_total_microusd, configuration_json, control_sha,
						 target_root, target_sha, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					authorizationId,
					runId,
					row.preflight_id,
					row.definition_revision_id,
					configuration.maximumTotalMicrousd,
					JSON.stringify(configuration),
					row.control_sha,
					row.target_root,
					row.target_sha,
					timestamp,
				);
			const insertRole = this.database.query(
				`INSERT INTO pipeline_authorization_roles
					(authorization_id, role, model, effort, limit_microusd)
				VALUES (?, ?, ?, ?, ?)`,
			);
			for (const role of pipelineRoles(configuration)) {
				insertRole.run(
					authorizationId,
					role.role,
					role.model,
					role.effort ?? null,
					role.limitMicrousd,
				);
			}
			this.database
				.query(
					`INSERT INTO operation_attempts
						(id, kind, state, run_id, lifecycle_revision, preview_json,
						 confirmation_json, intent_json, role,
						 pipeline_authorization_id, created_at, updated_at)
					VALUES (?, 'WORKFLOW', 'INTENDED', ?, 1, ?, ?, ?, 'Discuss', ?, ?, ?)`,
				)
				.run(
					attemptId,
					runId,
					JSON.stringify({ role: "Discuss" }),
					JSON.stringify({ authorizationId }),
					JSON.stringify({ action: "DISPATCH_AFTER_BASELINE" }),
					authorizationId,
					timestamp,
					timestamp,
				);
			this.database
				.query(
					`INSERT INTO paid_operation_attempts
						(operation_attempt_id, model, effort, hard_limit_microusd,
						 reserved_microusd)
					VALUES (?, ?, ?, ?, ?)`,
				)
				.run(
					attemptId,
					configuration.paidRoles.workflow.model,
					configuration.paidRoles.workflow.effort ?? null,
					configuration.paidRoles.workflow.limitMicrousd,
					configuration.paidRoles.workflow.limitMicrousd,
				);
			this.database
				.query(
					"UPDATE pipeline_previews SET state = 'CONFIRMED', updated_at = ? WHERE id = ?",
				)
				.run(timestamp, previewId);
			this.database.run("COMMIT");

			return {
				attempt: { id: attemptId, role: "Discuss", state: "INTENDED" as const },
				authorizationId,
				runId,
				shouldDispatch: true,
			};
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

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
	}) {
		const attemptId = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const control = z
				.object({ lifecycle_state: z.string() })
				.parse(
					this.database
						.query("SELECT lifecycle_state FROM runs WHERE id = ?")
						.get(input.runId),
				);
			if (control.lifecycle_state !== "ACTIVE") {
				throw new RunControlConflictError(
					"Run does not allow another paid operation",
				);
			}
			if (input.evidenceIds) {
				const readEvidence = this.database.query(
					"SELECT state FROM sealed_evidence_objects WHERE id = ? AND run_id = ?",
				);
				for (const evidenceId of input.evidenceIds) {
					const evidence = z
						.object({ state: z.literal("SEALED") })
						.parse(readEvidence.get(evidenceId, input.runId));
					if (evidence.state !== "SEALED") {
						throw new Error("Judge evidence must be sealed");
					}
				}
			}
			const row = z
				.object({
					actual_cost_microusd: z.number().int().nonnegative(),
					effort: effortSchema.nullable(),
					limit_microusd: z.number().int().positive(),
					maximum_total_microusd: z.number().int().positive(),
					model: z.string(),
					reserved_microusd: z.number().int().nonnegative(),
					revision: z.number().int().positive(),
				})
				.parse(
					this.database
						.query(
							`SELECT role.model, role.effort, role.limit_microusd,
								run.maximum_total_microusd, run.reserved_microusd,
								run.actual_cost_microusd, run.revision
							FROM pipeline_authorizations authorization
							JOIN pipeline_authorization_roles role
								ON role.authorization_id = authorization.id
							JOIN runs run ON run.id = authorization.run_id
							WHERE authorization.id = ? AND authorization.run_id = ?
								AND role.role = ?`,
						)
						.get(input.authorizationId, input.runId, input.roleType),
				);
			assertAllowanceAvailable({
				actualCostMicrousd: row.actual_cost_microusd,
				allowanceMicrousd: row.limit_microusd,
				maximumTotalMicrousd: row.maximum_total_microusd,
				reservedMicrousd: row.reserved_microusd,
			});
			this.database
				.query(
					`INSERT INTO operation_attempts
						(id, kind, state, run_id, lifecycle_revision, preview_json,
						 confirmation_json, intent_json, role,
						 pipeline_authorization_id, created_at, updated_at)
					VALUES (?, ?, 'INTENDED', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					attemptId,
					input.kind,
					input.runId,
					row.revision + 1,
					JSON.stringify({ role: input.role }),
					JSON.stringify({ authorizationId: input.authorizationId }),
					JSON.stringify({ action: "DISPATCH" }),
					input.role,
					input.authorizationId,
					timestamp,
					timestamp,
				);
			if (input.evidenceIds) {
				const insertEvidence = this.database.query(
					`INSERT INTO operation_attempt_evidence
						(operation_attempt_id, ordinal, evidence_id) VALUES (?, ?, ?)`,
				);
				for (const [ordinal, evidenceId] of input.evidenceIds.entries()) {
					insertEvidence.run(attemptId, ordinal, evidenceId);
				}
			}
			this.database
				.query(
					`INSERT INTO paid_operation_attempts
						(operation_attempt_id, model, effort, hard_limit_microusd,
						 reserved_microusd)
					VALUES (?, ?, ?, ?, ?)`,
				)
				.run(
					attemptId,
					row.model,
					row.effort,
					row.limit_microusd,
					row.limit_microusd,
				);
			this.database
				.query(
					`UPDATE runs SET revision = revision + 1,
						reserved_microusd = reserved_microusd + ?, updated_at = ?
					WHERE id = ?`,
				)
				.run(row.limit_microusd, timestamp, input.runId);
			this.database.run("COMMIT");

			return { attemptId, authorizationId: input.authorizationId };
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	readOperationAuthorizations(runId: string) {
		return z
			.array(
				z.object({
					authorizationId: z.string(),
					role: z.string(),
					state: z.enum([
						"AWAITING_CONFIRMATION",
						"INTENDED",
						"RUNNING",
						"SUCCEEDED",
						"FAILED",
						"CANCELLED",
						"UNCERTAIN",
					]),
				}),
			)
			.parse(
				this.database
					.query(
						`SELECT pipeline_authorization_id AS authorizationId, role, state
						FROM operation_attempts WHERE run_id = ?
							AND pipeline_authorization_id IS NOT NULL ORDER BY rowid`,
					)
					.all(runId),
			);
	}

	requestGracefulStop(input: {
		readonly expectedRunRevision: number;
		readonly runId: string;
	}) {
		const timestamp = new Date().toISOString();
		const result = this.database
			.query(
				`UPDATE runs SET lifecycle_state = 'AWAITING_HUMAN_REVIEW',
					phase = 'AWAITING_HUMAN_REVIEW',
					terminal_outcome = 'GRACEFUL_USER_STOP',
					failure_category = 'GRACEFUL_USER_STOP', revision = revision + 1,
					updated_at = ?
				WHERE id = ? AND revision = ? AND lifecycle_state = 'ACTIVE'`,
			)
			.run(timestamp, input.runId, input.expectedRunRevision);
		if (result.changes !== 1) {
			throw new RunRevisionConflictError(
				"Run is stale or no longer accepts a graceful stop",
			);
		}
	}

	shouldStopGracefully(runId: string) {
		return (
			z
				.object({ terminal_outcome: z.string().nullable() })
				.parse(
					this.database
						.query("SELECT terminal_outcome FROM runs WHERE id = ?")
						.get(runId),
				).terminal_outcome === "GRACEFUL_USER_STOP"
		);
	}

	createEmergencyInterruptPreview(runId: string) {
		const previewId = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const run = z
				.object({
					lifecycle_state: z.literal("ACTIVE"),
					revision: z.number().int().positive(),
				})
				.parse(
					this.database
						.query("SELECT lifecycle_state, revision FROM runs WHERE id = ?")
						.get(runId),
				);
			const attempt = z.object({ id: z.string() }).parse(
				this.database
					.query(
						`SELECT attempt.id FROM operation_attempts attempt
							JOIN paid_operation_attempts paid
								ON paid.operation_attempt_id = attempt.id
							WHERE attempt.run_id = ? AND attempt.state = 'RUNNING'
							ORDER BY attempt.updated_at DESC LIMIT 1`,
					)
					.get(runId),
			);
			const started = z
				.object({
					payload_json: z.string(),
					sequence: z.number().int().positive(),
				})
				.parse(
					this.database
						.query(
							`SELECT sequence, payload_json FROM run_events
							WHERE run_id = ? AND operation_attempt_id = ?
								AND type = 'PROCESS_STARTED'
							ORDER BY sequence DESC LIMIT 1`,
						)
						.get(runId, attempt.id),
				);
			const terminal = this.database
				.query(
					`SELECT 1 FROM run_events WHERE run_id = ? AND operation_attempt_id = ?
						AND type = 'PROCESS_TERMINAL' AND sequence > ? LIMIT 1`,
				)
				.get(runId, attempt.id, started.sequence);
			if (terminal) {
				throw new RunControlConflictError(
					"The recorded process has already terminated",
				);
			}
			const processEvent = runEventSchema.parse(
				JSON.parse(started.payload_json),
			);
			if (processEvent.type !== "PROCESS_STARTED") {
				throw new RunControlConflictError(
					"Recorded process identity is invalid",
				);
			}
			const runRevision = run.revision + 1;
			const preview = {
				attemptId: attempt.id,
				control: "EMERGENCY_INTERRUPT" as const,
				pid: processEvent.pid,
				previewId,
				runRevision,
				startIdentity: processEvent.startIdentity,
			};
			this.database
				.query(
					`INSERT INTO operation_attempts
						(id, kind, state, run_id, lifecycle_revision, preview_json,
						 role, created_at, updated_at)
					VALUES (?, 'EMERGENCY_INTERRUPT', 'AWAITING_CONFIRMATION', ?, ?, ?,
						'Emergency interrupt', ?, ?)`,
				)
				.run(
					previewId,
					runId,
					runRevision,
					JSON.stringify(preview),
					timestamp,
					timestamp,
				);
			this.database
				.query("UPDATE runs SET revision = ?, updated_at = ? WHERE id = ?")
				.run(runRevision, timestamp, runId);
			this.database.run("COMMIT");

			return preview;
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			if (error instanceof RunControlConflictError) throw error;
			throw new RunControlConflictError(
				"No recorded current child is available to interrupt",
				{ cause: error },
			);
		}
	}

	beginEmergencyInterrupt(input: {
		readonly expectedRunRevision: number;
		readonly previewId: string;
		readonly runId: string;
	}) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const run = z
				.object({
					lifecycle_state: z.literal("ACTIVE"),
					revision: z.number().int().positive(),
				})
				.parse(
					this.database
						.query("SELECT lifecycle_state, revision FROM runs WHERE id = ?")
						.get(input.runId),
				);
			if (run.revision !== input.expectedRunRevision) {
				throw new RunRevisionConflictError("Run revision is stale");
			}
			const command = z
				.object({
					preview_json: z.string(),
					state: z.literal("AWAITING_CONFIRMATION"),
				})
				.parse(
					this.database
						.query(
							`SELECT state, preview_json FROM operation_attempts
							WHERE id = ? AND run_id = ? AND kind = 'EMERGENCY_INTERRUPT'`,
						)
						.get(input.previewId, input.runId),
				);
			const target = z
				.object({
					attemptId: z.string(),
					pid: z.number().int().positive(),
					startIdentity: z.string().min(1),
				})
				.parse(JSON.parse(command.preview_json));
			const current = this.database
				.query(
					"SELECT 1 FROM operation_attempts WHERE id = ? AND run_id = ? AND state = 'RUNNING'",
				)
				.get(target.attemptId, input.runId);
			if (!current) {
				throw new RunControlConflictError(
					"The previewed operation is no longer running",
				);
			}
			this.database
				.query(
					`UPDATE operation_attempts SET state = 'RUNNING', confirmation_json = ?,
						intent_json = ?, updated_at = ? WHERE id = ?`,
				)
				.run(
					JSON.stringify({ confirmed: true }),
					JSON.stringify({ action: "INTERRUPT_RECORDED_CHILD" }),
					timestamp,
					input.previewId,
				);
			this.database
				.query(
					"UPDATE runs SET revision = revision + 1, updated_at = ? WHERE id = ?",
				)
				.run(timestamp, input.runId);
			this.database.run("COMMIT");

			return target;
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	completeEmergencyInterrupt(input: {
		readonly attemptId: string;
		readonly previewId: string;
		readonly runId: string;
	}) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const target = this.database
				.query(
					"UPDATE operation_attempts SET state = 'UNCERTAIN', terminal_json = ?, updated_at = ? WHERE id = ? AND run_id = ? AND state = 'RUNNING'",
				)
				.run(
					JSON.stringify({ reason: "EMERGENCY_INTERRUPTION" }),
					timestamp,
					input.attemptId,
					input.runId,
				);
			const command = this.database
				.query(
					"UPDATE operation_attempts SET state = 'SUCCEEDED', terminal_json = ?, updated_at = ? WHERE id = ? AND run_id = ? AND state = 'RUNNING'",
				)
				.run(
					JSON.stringify({ interruptedAttemptId: input.attemptId }),
					timestamp,
					input.previewId,
					input.runId,
				);
			if (target.changes !== 1 || command.changes !== 1) {
				throw new RunControlConflictError(
					"Emergency interruption state is no longer current",
				);
			}
			this.database
				.query(
					`UPDATE runs SET lifecycle_state = 'UNCERTAIN',
						terminal_outcome = 'EMERGENCY_INTERRUPTION',
						failure_category = 'EMERGENCY_INTERRUPTION', revision = revision + 1,
						updated_at = ? WHERE id = ?`,
				)
				.run(timestamp, input.runId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	readRunFailure(runId: string) {
		const row = z
			.object({
				failure_category: z.string().nullable(),
				terminal_outcome: z.string().nullable(),
			})
			.parse(
				this.database
					.query(
						"SELECT terminal_outcome, failure_category FROM runs WHERE id = ?",
					)
					.get(runId),
			);

		return {
			failureCategory: row.failure_category,
			terminalOutcome: row.terminal_outcome,
		};
	}

	startAuthorizedOperation(attemptId: string) {
		const timestamp = new Date().toISOString();
		const result = this.database
			.query(
				`UPDATE operation_attempts SET state = 'RUNNING', updated_at = ?
				WHERE id = ? AND state = 'INTENDED' AND pipeline_authorization_id IS NOT NULL`,
			)
			.run(timestamp, attemptId);
		if (result.changes !== 1) {
			throw new RunRevisionConflictError(
				"Authorized operation is not ready to start",
			);
		}
	}

	readAuthorizedOperation(attemptId: string) {
		const row = z
			.object({
				effort: effortSchema.nullable(),
				hard_limit_microusd: z.number().int().positive(),
				model: z.string().min(1),
			})
			.parse(
				this.database
					.query(
						`SELECT paid.model, paid.effort, paid.hard_limit_microusd
						FROM operation_attempts attempt
						JOIN paid_operation_attempts paid
							ON paid.operation_attempt_id = attempt.id
						WHERE attempt.id = ? AND attempt.pipeline_authorization_id IS NOT NULL`,
					)
					.get(attemptId),
			);

		return {
			effort: row.effort ?? undefined,
			limitMicrousd: row.hard_limit_microusd,
			model: row.model,
		};
	}

	completeAuthorizedOperation(
		attemptId: string,
		result: {
			readonly costMicrousd: number;
			readonly durationMs: number;
			readonly sessionId: string;
			readonly value: unknown;
		},
		judge?:
			| {
					readonly grade: "A" | "B" | "C" | "D" | "F";
					readonly kind: "STAGE";
					readonly origin: "MODEL" | "AUTHORITATIVE_HARNESS";
					readonly result: unknown;
					readonly runId: string;
					readonly stage: "discuss" | "grill" | "plan" | "build";
					readonly verdict: "CONTINUE" | "STOP";
			  }
			| {
					readonly kind: "FINAL";
					readonly origin: "MODEL" | "AUTHORITATIVE_HARNESS";
					readonly result: unknown;
					readonly runId: string;
					readonly verdict: "PASS" | "FAIL";
			  },
		terminalEvidenceId?: string,
	) {
		const timestamp = new Date().toISOString();
		if (terminalEvidenceId) this.readEvidenceBytes(terminalEvidenceId);
		this.database.run("BEGIN IMMEDIATE");
		try {
			const attempt = z
				.object({
					hard_limit_microusd: z.number().int().positive(),
					reserved_microusd: z.number().int().nonnegative(),
					run_id: z.string(),
					state: z.literal("RUNNING"),
				})
				.parse(
					this.database
						.query(
							`SELECT attempt.state, attempt.run_id, paid.hard_limit_microusd,
								paid.reserved_microusd
							FROM operation_attempts attempt
							JOIN paid_operation_attempts paid
								ON paid.operation_attempt_id = attempt.id
							WHERE attempt.id = ?`,
						)
						.get(attemptId),
				);
			if (result.costMicrousd > attempt.hard_limit_microusd) {
				throw new RunBudgetExceededError(
					"Operation actual cost exceeds its authorized hard limit",
				);
			}
			this.database
				.query(
					`UPDATE operation_attempts SET state = 'SUCCEEDED', terminal_json = ?,
						updated_at = ? WHERE id = ? AND state = 'RUNNING'`,
				)
				.run(JSON.stringify(result.value), timestamp, attemptId);
			this.database
				.query(
					`UPDATE paid_operation_attempts SET reserved_microusd = 0,
						actual_cost_microusd = ?, duration_ms = ?, session_id = ?,
						redacted_result_json = ? WHERE operation_attempt_id = ?`,
				)
				.run(
					result.costMicrousd,
					result.durationMs,
					result.sessionId,
					JSON.stringify(result.value),
					attemptId,
				);
			this.database
				.query(
					`UPDATE runs SET reserved_microusd = reserved_microusd - ?,
						actual_cost_microusd = actual_cost_microusd + ?,
						revision = revision + 1, updated_at = ? WHERE id = ?`,
				)
				.run(
					attempt.reserved_microusd,
					result.costMicrousd,
					timestamp,
					attempt.run_id,
				);
			if (terminalEvidenceId) {
				const sealed = this.database
					.query(
						`UPDATE sealed_evidence_objects SET state = 'SEALED', sealed_at = ?
						WHERE id = ? AND run_id = ? AND state = 'STAGING'`,
					)
					.run(timestamp, terminalEvidenceId, attempt.run_id);
				if (sealed.changes !== 1) {
					throw new Error("Terminal evidence is not ready to seal");
				}
				const ordinal = z
					.object({ ordinal: z.number().int().nonnegative() })
					.parse(
						this.database
							.query(
								`SELECT coalesce(max(ordinal), -1) + 1 AS ordinal
								FROM operation_attempt_evidence WHERE operation_attempt_id = ?`,
							)
							.get(attemptId),
					).ordinal;
				this.database
					.query(
						`INSERT INTO operation_attempt_evidence
							(operation_attempt_id, ordinal, evidence_id) VALUES (?, ?, ?)`,
					)
					.run(attemptId, ordinal, terminalEvidenceId);
			}
			if (judge?.kind === "STAGE") {
				this.database
					.query(
						`INSERT INTO stage_judge_results
							(operation_attempt_id, run_id, stage, grade, verdict, origin,
							 result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.run(
						attemptId,
						judge.runId,
						judge.stage,
						judge.grade,
						judge.verdict,
						judge.origin,
						JSON.stringify(judge.result),
						timestamp,
					);
				if (judge.verdict === "STOP") {
					this.database
						.query(
							`UPDATE runs SET lifecycle_state = 'AWAITING_HUMAN_REVIEW',
								terminal_outcome = ?, failure_category = ?, updated_at = ?
							WHERE id = ? AND lifecycle_state = 'ACTIVE'`,
						)
						.run(
							judge.origin === "MODEL"
								? "CANDIDATE_QUALITY_STOP"
								: "AUTHORITATIVE_HARNESS_STOP",
							judge.origin === "MODEL"
								? "CANDIDATE_QUALITY"
								: "AUTHORITATIVE_HARNESS_EVIDENCE",
							timestamp,
							judge.runId,
						);
				} else {
					const nextPhase = {
						build: "FINAL_GRADE",
						discuss: "GRILL",
						grill: "PLAN",
						plan: "BUILD",
					}[judge.stage];
					this.database
						.query(
							"UPDATE runs SET phase = ?, updated_at = ? WHERE id = ? AND lifecycle_state = 'ACTIVE'",
						)
						.run(nextPhase, timestamp, judge.runId);
				}
			}
			if (judge?.kind === "FINAL") {
				this.database
					.query(
						`INSERT INTO final_judge_results
							(operation_attempt_id, run_id, verdict, origin, result_json, created_at)
							VALUES (?, ?, ?, ?, ?, ?)`,
					)
					.run(
						attemptId,
						judge.runId,
						judge.verdict,
						judge.origin,
						JSON.stringify(judge.result),
						timestamp,
					);
				const failed = judge.verdict === "FAIL";
				this.database
					.query(
						`UPDATE runs SET phase = 'AWAITING_HUMAN_REVIEW',
							lifecycle_state = 'AWAITING_HUMAN_REVIEW', terminal_outcome = ?,
							failure_category = ?, updated_at = ?
						WHERE id = ? AND lifecycle_state = 'ACTIVE'`,
					)
					.run(
						failed
							? judge.origin === "MODEL"
								? "CANDIDATE_QUALITY_STOP"
								: "AUTHORITATIVE_HARNESS_STOP"
							: "COMPLETED",
						failed
							? judge.origin === "MODEL"
								? "CANDIDATE_QUALITY"
								: "AUTHORITATIVE_HARNESS_EVIDENCE"
							: null,
						timestamp,
						judge.runId,
					);
			}
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	failJudgeOperation(input: {
		readonly attemptId: string;
		readonly failure:
			| "INVOCATION_FAILURE"
			| "TIMEOUT"
			| "MALFORMED_OUTPUT"
			| "INVALID_TYPED_CITATION";
		readonly message: string;
		readonly runId: string;
		readonly stage?: "discuss" | "grill" | "plan" | "build";
	}) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const attempt = z
				.object({
					kind: z.enum(["STAGE_JUDGE", "FINAL_JUDGE"]),
					reserved_microusd: z.number().int().nonnegative(),
				})
				.parse(
					this.database
						.query(
							`SELECT attempt.kind, paid.reserved_microusd
							FROM operation_attempts attempt
							JOIN paid_operation_attempts paid
								ON paid.operation_attempt_id = attempt.id
							WHERE attempt.id = ? AND attempt.run_id = ? AND attempt.state = 'RUNNING'`,
						)
						.get(input.attemptId, input.runId),
				);
			this.database
				.query(
					`UPDATE operation_attempts SET state = 'FAILED', terminal_json = ?,
						updated_at = ? WHERE id = ?`,
				)
				.run(
					JSON.stringify({ failure: input.failure, message: input.message }),
					timestamp,
					input.attemptId,
				);
			this.database
				.query(
					"UPDATE paid_operation_attempts SET reserved_microusd = 0 WHERE operation_attempt_id = ?",
				)
				.run(input.attemptId);
			this.database
				.query(
					`UPDATE runs SET reserved_microusd = reserved_microusd - ?,
						terminal_outcome = CASE WHEN terminal_outcome = 'GRACEFUL_USER_STOP'
							THEN terminal_outcome ELSE 'JUDGE_FAILURE' END,
						failure_category = CASE WHEN terminal_outcome = 'GRACEFUL_USER_STOP'
							THEN failure_category ELSE 'JUDGE_FAILURE' END,
						phase = CASE WHEN terminal_outcome = 'GRACEFUL_USER_STOP'
							THEN phase ELSE 'TERMINAL' END,
						revision = revision + 1, updated_at = ? WHERE id = ?`,
				)
				.run(attempt.reserved_microusd, timestamp, input.runId);
			if (attempt.kind === "STAGE_JUDGE") {
				if (!input.stage)
					throw new Error("Failed Stage Judge is missing its stage");
				this.database
					.query(
						`INSERT INTO stage_judge_results
							(operation_attempt_id, run_id, stage, failure_kind, created_at)
							VALUES (?, ?, ?, ?, ?)`,
					)
					.run(
						input.attemptId,
						input.runId,
						input.stage,
						input.failure,
						timestamp,
					);
			} else {
				this.database
					.query(
						`INSERT INTO final_judge_results
							(operation_attempt_id, run_id, failure_kind, created_at)
							VALUES (?, ?, ?, ?)`,
					)
					.run(input.attemptId, input.runId, input.failure, timestamp);
			}
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	failAuthorizedOperation(attemptId: string, message: string) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const attempt = z
				.object({
					reserved_microusd: z.number().int().nonnegative(),
					run_id: z.string(),
				})
				.parse(
					this.database
						.query(
							`SELECT attempt.run_id, paid.reserved_microusd
							FROM operation_attempts attempt
							JOIN paid_operation_attempts paid
								ON paid.operation_attempt_id = attempt.id
							WHERE attempt.id = ? AND attempt.state = 'RUNNING'`,
						)
						.get(attemptId),
				);
			this.database
				.query(
					`UPDATE operation_attempts SET state = 'FAILED', terminal_json = ?,
						updated_at = ? WHERE id = ?`,
				)
				.run(JSON.stringify({ message }), timestamp, attemptId);
			this.database
				.query(
					"UPDATE paid_operation_attempts SET reserved_microusd = 0 WHERE operation_attempt_id = ?",
				)
				.run(attemptId);
			this.database
				.query(
					`UPDATE runs SET reserved_microusd = reserved_microusd - ?,
						terminal_outcome = CASE WHEN terminal_outcome = 'GRACEFUL_USER_STOP'
							THEN terminal_outcome ELSE 'INFRASTRUCTURE_FAILURE' END,
						failure_category = CASE WHEN terminal_outcome = 'GRACEFUL_USER_STOP'
							THEN failure_category ELSE 'INFRASTRUCTURE_FAILURE' END,
						phase = CASE WHEN terminal_outcome = 'GRACEFUL_USER_STOP'
							THEN phase ELSE 'TERMINAL' END,
						revision = revision + 1, updated_at = ? WHERE id = ?`,
				)
				.run(attempt.reserved_microusd, timestamp, attempt.run_id);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

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
	) {
		this.database
			.query("UPDATE runs SET phase = ?, updated_at = ? WHERE id = ?")
			.run(phase, new Date().toISOString(), runId);
	}

	private insertWorkflowBaseline(
		runId: string,
		baseline: WorkflowBaseline,
		timestamp: string,
	) {
		const baselineId = crypto.randomUUID();
		const insertRoot = this.database.query(
			`INSERT INTO workflow_baseline_roots
				(baseline_id, ordinal, path, status, mode)
			VALUES (?, ?, ?, ?, ?)`,
		);
		const insertEntry = this.database.query(
			`INSERT INTO workflow_baseline_entries
				(id, baseline_id, root_path, ordinal, path, type, mode,
				 byte_length, sha256, link_target)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		);
		const insertChunk = this.database.query(
			`INSERT INTO workflow_baseline_chunks (entry_id, ordinal, bytes)
			VALUES (?, ?, ?)`,
		);
		this.database
			.query(
				`INSERT INTO workflow_baselines
						(id, run_id, state, sha256, created_at)
					VALUES (?, ?, 'CAPTURING', ?, ?)`,
			)
			.run(baselineId, runId, baseline.sealedSha256, timestamp);
		for (const [rootOrdinal, root] of baseline.roots.entries()) {
			insertRoot.run(
				baselineId,
				rootOrdinal,
				root.path,
				root.status,
				root.mode ?? null,
			);
			for (const [entryOrdinal, entry] of root.entries.entries()) {
				const entryId = crypto.randomUUID();
				insertEntry.run(
					entryId,
					baselineId,
					root.path,
					entryOrdinal,
					entry.path,
					entry.type,
					entry.mode,
					entry.length,
					entry.sha256,
					entry.linkTarget ?? null,
				);
				for (const [chunkOrdinal, bytes] of chunks(entry.bytes).entries()) {
					insertChunk.run(entryId, chunkOrdinal, bytes);
				}
			}
		}
		this.database
			.query(
				"UPDATE workflow_baselines SET state = 'SEALED', sealed_at = ? WHERE id = ?",
			)
			.run(timestamp, baselineId);
		const linked = this.database
			.query(
				"UPDATE runs SET workflow_baseline_id = ?, updated_at = ? WHERE id = ? AND workflow_baseline_id IS NULL",
			)
			.run(baselineId, timestamp, runId);
		if (linked.changes !== 1) {
			throw new RunRevisionConflictError(
				"Run is missing or already has a workflow baseline",
			);
		}
	}

	readWorkflowBaseline(runId: string): WorkflowBaseline | undefined {
		const baseline = z
			.object({ id: z.string(), sha256: z.string().length(64) })
			.nullable()
			.parse(
				this.database
					.query(
						`SELECT baseline.id, baseline.sha256
						FROM runs run JOIN workflow_baselines baseline
							ON baseline.id = run.workflow_baseline_id
						WHERE run.id = ? AND baseline.state = 'SEALED'`,
					)
					.get(runId),
			);
		if (!baseline) return undefined;

		const roots = z
			.array(
				z.object({
					mode: z.number().int().nonnegative().nullable(),
					path: z.enum(["backlog", ".boris"]),
					status: z.enum(["ABSENT", "PRESENT"]),
				}),
			)
			.parse(
				this.database
					.query(
						`SELECT path, status, mode FROM workflow_baseline_roots
						WHERE baseline_id = ? ORDER BY ordinal`,
					)
					.all(baseline.id),
			);

		return {
			roots: roots.map((root) => ({
				entries: this.readWorkflowBaselineEntries(baseline.id, root.path),
				...(root.mode === null ? {} : { mode: root.mode }),
				path: root.path,
				status: root.status,
			})),
			sealedSha256: baseline.sha256,
		};
	}

	appendRunEvent(
		runId: string,
		operationAttemptId: string | undefined,
		event: RunEvent,
	) {
		this.database.run("BEGIN IMMEDIATE");
		try {
			const durable = this.insertRunEvent(runId, operationAttemptId, event);
			this.database.run("COMMIT");

			return durable;
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	readRunEvents(runId: string, afterSequence = 0, limit = 200) {
		const boundedLimit = Math.max(1, Math.min(limit, 500));

		return z
			.array(
				z.object({
					created_at: z.string(),
					operation_attempt_id: z.string().nullable(),
					payload_json: z.string(),
					run_id: z.string(),
					sequence: z.number().int().positive(),
					type: z.enum([
						"PROCESS_STARTED",
						"PROCESS_OUTPUT",
						"PROCESS_EVIDENCE_GAP",
						"PROCESS_TERMINAL",
						"WORKFLOW_QUESTION",
						"PRODUCT_OWNER_ANSWER",
						"WORKFLOW_COMPLETED",
						"EVIDENCE_SEALED",
					]),
				}),
			)
			.parse(
				this.database
					.query(
						`SELECT run_id, sequence, operation_attempt_id, type,
							payload_json, created_at
						FROM run_events WHERE run_id = ? AND sequence > ?
						ORDER BY sequence LIMIT ?`,
					)
					.all(runId, afterSequence, boundedLimit),
			)
			.map((row) => {
				const payload = runEventSchema.parse(JSON.parse(row.payload_json));
				if (payload.type !== row.type) {
					throw new Error("Run event type does not match its payload");
				}

				return {
					operationAttemptId: row.operation_attempt_id ?? undefined,
					payload,
					runId: row.run_id,
					sequence: row.sequence,
					timestamp: row.created_at,
					type: payload.type,
				};
			});
	}

	recordWorkflowTurn(input: WorkflowTurnRecord, event: RunEvent) {
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.insertWorkflowTurn(input);
			const durable = this.insertRunEvent(
				input.runId,
				input.operationAttemptId,
				event,
			);
			this.database.run("COMMIT");

			return durable;
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	readWorkflowTurns(runId: string, stage: string) {
		return z
			.array(
				z.object({
					answer: z.string().nullable(),
					costMicrousd: z.number().int().nonnegative(),
					createdAt: z.string(),
					kind: z.enum(["QUESTION", "ANSWER", "COMPLETE"]),
					question: z.string().nullable(),
					recommendation: z.string().nullable(),
					role: z.enum(["WORKFLOW", "PRODUCT_OWNER"]),
					sessionId: z.string(),
					stage: z.string(),
					summary: z.string().nullable(),
				}),
			)
			.parse(
				this.database
					.query(
						`SELECT stage, kind, session_role AS role, session_id AS sessionId,
							cost_microusd AS costMicrousd, question, recommendation,
							answer, summary, created_at AS createdAt
						FROM workflow_turns WHERE run_id = ? AND stage = ? ORDER BY ordinal`,
					)
					.all(runId, stage),
			);
	}

	createEvidenceObject(input: EvidenceObject & { readonly bytes: Uint8Array }) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`INSERT INTO sealed_evidence_objects
						(id, run_id, frozen_input_id, provenance_operation, logical_source,
						 logical_path, kind, media_type, state, byte_length, sha256, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'STAGING', ?, ?, ?)`,
				)
				.run(
					input.id,
					input.runId,
					input.frozenInputId,
					input.provenanceOperation,
					input.logicalSource,
					input.logicalPath,
					input.kind,
					input.mediaType,
					input.byteLength,
					input.sha256,
					timestamp,
				);
			const insertChunk = this.database.query(
				`INSERT INTO sealed_evidence_chunks (evidence_id, ordinal, bytes)
				VALUES (?, ?, ?)`,
			);
			for (const [ordinal, bytes] of chunks(input.bytes).entries()) {
				insertChunk.run(input.id, ordinal, bytes);
			}
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	sealEvidenceObject(evidenceId: string) {
		const object = this.readEvidenceObject(evidenceId);
		if (object.state !== "STAGING") {
			throw new Error("Evidence object is already sealed");
		}
		this.readEvidenceBytes(evidenceId);
		const timestamp = new Date().toISOString();
		const result = this.database
			.query(
				`UPDATE sealed_evidence_objects SET state = 'SEALED', sealed_at = ?
				WHERE id = ? AND state = 'STAGING'`,
			)
			.run(timestamp, evidenceId);
		if (result.changes !== 1) throw new Error("Evidence seal state changed");

		return this.readEvidenceObject(evidenceId);
	}

	readEvidenceObject(evidenceId: string): EvidenceObject {
		const row = z
			.object({
				byte_length: z.number().int().nonnegative(),
				frozen_input_id: z.string(),
				id: z.string(),
				kind: z.string(),
				logical_path: z.string(),
				logical_source: z.string(),
				media_type: z.string(),
				provenance_operation: z.string(),
				run_id: z.string(),
				sha256: z.string(),
				state: z.string(),
			})
			.parse(
				this.database
					.query(
						`SELECT id, run_id, frozen_input_id, provenance_operation,
							logical_source, logical_path, kind, media_type, state,
							byte_length, sha256 FROM sealed_evidence_objects WHERE id = ?`,
					)
					.get(evidenceId),
			);

		return evidenceObjectSchema.parse({
			byteLength: row.byte_length,
			frozenInputId: row.frozen_input_id,
			id: row.id,
			kind: row.kind,
			logicalPath: row.logical_path,
			logicalSource: row.logical_source,
			mediaType: row.media_type,
			provenanceOperation: row.provenance_operation,
			runId: row.run_id,
			sha256: row.sha256,
			state: row.state,
		});
	}

	readEvidenceBytes(evidenceId: string) {
		const object = this.readEvidenceObject(evidenceId);
		const bytes = combineBytes(
			z
				.array(z.object({ bytes: z.instanceof(Uint8Array) }))
				.parse(
					this.database
						.query(
							`SELECT bytes FROM sealed_evidence_chunks
							WHERE evidence_id = ? ORDER BY ordinal`,
						)
						.all(evidenceId),
				)
				.map((chunk) => chunk.bytes),
		);
		if (
			bytes.byteLength !== object.byteLength ||
			createHash("sha256").update(bytes).digest("hex") !== object.sha256
		) {
			throw new Error("Evidence object does not match its sealed identity");
		}

		return bytes;
	}

	private insertRunEvent(
		runId: string,
		operationAttemptId: string | undefined,
		event: RunEvent,
	) {
		const sequence = z
			.object({ sequence: z.number().int().positive() })
			.parse(
				this.database
					.query(
						"SELECT coalesce(max(sequence), 0) + 1 AS sequence FROM run_events WHERE run_id = ?",
					)
					.get(runId),
			).sequence;
		const timestamp = new Date().toISOString();
		this.database
			.query(
				`INSERT INTO run_events
					(run_id, sequence, operation_attempt_id, type, payload_json, created_at)
				VALUES (?, ?, ?, ?, ?, ?)`,
			)
			.run(
				runId,
				sequence,
				operationAttemptId ?? null,
				event.type,
				JSON.stringify(event),
				timestamp,
			);

		return {
			operationAttemptId,
			payload: event,
			runId,
			sequence,
			timestamp,
			type: event.type,
		};
	}

	private insertWorkflowTurn(input: WorkflowTurnRecord) {
		const ordinal = z.object({ ordinal: z.number().int().positive() }).parse(
			this.database
				.query(
					`SELECT coalesce(max(ordinal), 0) + 1 AS ordinal
					FROM workflow_turns WHERE run_id = ? AND stage = ?`,
				)
				.get(input.runId, input.stage),
		).ordinal;
		this.database
			.query(
				`INSERT INTO workflow_turns
					(id, run_id, stage, ordinal, kind, session_role, session_id,
					 cost_microusd, question, recommendation, answer, summary, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				crypto.randomUUID(),
				input.runId,
				input.stage,
				ordinal,
				input.kind,
				input.role,
				input.sessionId,
				input.costMicrousd,
				input.question ?? null,
				input.recommendation ?? null,
				input.answer ?? null,
				input.summary ?? null,
				new Date().toISOString(),
			);
	}

	private readWorkflowBaselineEntries(
		baselineId: string,
		rootPath: "backlog" | ".boris",
	): WorkflowBaselineEntry[] {
		const rows = z
			.array(
				z.object({
					byte_length: z.number().int().nonnegative(),
					id: z.string(),
					link_target: z.string().nullable(),
					mode: z.number().int().nonnegative(),
					path: z.string(),
					sha256: z.string().length(64),
					type: z.enum(["DIRECTORY", "FILE", "SYMLINK"]),
				}),
			)
			.parse(
				this.database
					.query(
						`SELECT id, path, type, mode, byte_length, sha256, link_target
						FROM workflow_baseline_entries
						WHERE baseline_id = ? AND root_path = ? ORDER BY ordinal`,
					)
					.all(baselineId, rootPath),
			);

		return rows.map((row) => ({
			...(row.type === "FILE"
				? {
						bytes: combineBytes(
							z
								.array(z.object({ bytes: z.instanceof(Uint8Array) }))
								.parse(
									this.database
										.query(
											"SELECT bytes FROM workflow_baseline_chunks WHERE entry_id = ? ORDER BY ordinal",
										)
										.all(row.id),
								)
								.map((chunk) => chunk.bytes),
						),
					}
				: {}),
			length: row.byte_length,
			...(row.link_target === null ? {} : { linkTarget: row.link_target }),
			mode: row.mode,
			path: row.path,
			sha256: row.sha256,
			type: row.type,
		}));
	}

	createRunExecution(input: {
		readonly controlSha: string;
		readonly id: string;
		readonly maximumTotalMicrousd: number;
		readonly targetRoot: string;
		readonly targetSha: string;
	}): RunExecution {
		const effective = z
			.object({ definition_revision_id: z.string() })
			.parse(
				this.database
					.query(
						"SELECT definition_revision_id FROM effective_definition WHERE singleton = 1",
					)
					.get(),
			);
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const slot = z
				.object({ run_id: z.string().nullable() })
				.parse(
					this.database
						.query("SELECT run_id FROM active_run_slot WHERE singleton = 1")
						.get(),
				);
			if (slot.run_id !== null) {
				throw new ActiveRunConflictError("Another Run owns the active slot");
			}
			this.database
				.query(
					`INSERT INTO runs
						(id, schema_version, lifecycle_state, definition_revision_id,
						 summary_json, created_at, updated_at, revision, phase,
						 restoration_state, control_sha, target_root, target_sha,
						 maximum_total_microusd, reserved_microusd, actual_cost_microusd)
					VALUES (?, 2, 'ACTIVE', ?, '{}', ?, ?, 1, 'PREFLIGHT',
						'NOT_REQUIRED', ?, ?, ?, ?, 0, 0)`,
				)
				.run(
					input.id,
					effective.definition_revision_id,
					timestamp,
					timestamp,
					input.controlSha,
					input.targetRoot,
					input.targetSha,
					input.maximumTotalMicrousd,
				);
			this.database
				.query("UPDATE active_run_slot SET run_id = ? WHERE singleton = 1")
				.run(input.id);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}

		return this.readRunExecution(input.id);
	}

	createRunOperationPreview(input: {
		readonly allowanceMicrousd: number;
		readonly effort?: z.infer<typeof effortSchema>;
		readonly kind: string;
		readonly model: string;
		readonly role: string;
		readonly runId: string;
	}) {
		const attemptId = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const revision = this.incrementRunRevision(input.runId);
			this.database
				.query(
					`INSERT INTO operation_attempts
						(id, kind, state, run_id, lifecycle_revision, preview_json,
						 role, created_at, updated_at)
					VALUES (?, ?, 'AWAITING_CONFIRMATION', ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					attemptId,
					input.kind,
					input.runId,
					revision,
					JSON.stringify({
						allowanceMicrousd: input.allowanceMicrousd,
						effort: input.effort,
						model: input.model,
						role: input.role,
					}),
					input.role,
					timestamp,
					timestamp,
				);
			this.database
				.query(
					`INSERT INTO paid_operation_attempts
						(operation_attempt_id, model, effort, hard_limit_microusd,
						 reserved_microusd)
					VALUES (?, ?, ?, ?, 0)`,
				)
				.run(
					attemptId,
					input.model,
					input.effort ?? null,
					input.allowanceMicrousd,
				);
			this.database.run("COMMIT");

			return { attemptId, runRevision: revision };
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	confirmRunOperation(input: {
		readonly attemptId: string;
		readonly expectedRunRevision: number;
		readonly runId: string;
	}) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const run = z
				.object({
					actual_cost_microusd: z.number().int().nonnegative(),
					maximum_total_microusd: z.number().int().positive(),
					reserved_microusd: z.number().int().nonnegative(),
					revision: z.number().int().positive(),
				})
				.parse(
					this.database
						.query(
							`SELECT revision, maximum_total_microusd, reserved_microusd,
								actual_cost_microusd FROM runs WHERE id = ?`,
						)
						.get(input.runId),
				);
			if (run.revision !== input.expectedRunRevision) {
				throw new RunRevisionConflictError("Run revision is stale");
			}
			const attempt = z
				.object({
					hard_limit_microusd: z.number().int().positive(),
					state: z.literal("AWAITING_CONFIRMATION"),
				})
				.parse(
					this.database
						.query(
							`SELECT attempt.state, paid.hard_limit_microusd
							FROM operation_attempts attempt
							JOIN paid_operation_attempts paid
								ON paid.operation_attempt_id = attempt.id
							WHERE attempt.id = ? AND attempt.run_id = ?`,
						)
						.get(input.attemptId, input.runId),
				);
			const remaining =
				run.maximum_total_microusd -
				run.actual_cost_microusd -
				run.reserved_microusd;
			if (attempt.hard_limit_microusd > remaining) {
				throw new RunBudgetExceededError(
					"Operation allowance exceeds the remaining authorized budget",
				);
			}

			const next = transitionOperationAttempt(attempt.state, "INTENDED");
			this.database
				.query(
					`UPDATE runs SET revision = revision + 1,
						reserved_microusd = reserved_microusd + ?, updated_at = ?
					WHERE id = ?`,
				)
				.run(attempt.hard_limit_microusd, timestamp, input.runId);
			this.database
				.query(
					`UPDATE operation_attempts SET state = ?, confirmation_json = ?,
						intent_json = ?, updated_at = ? WHERE id = ?`,
				)
				.run(
					next,
					JSON.stringify({ confirmed: true }),
					JSON.stringify({ action: "DISPATCH" }),
					timestamp,
					input.attemptId,
				);
			this.database
				.query(
					"UPDATE paid_operation_attempts SET reserved_microusd = hard_limit_microusd WHERE operation_attempt_id = ?",
				)
				.run(input.attemptId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	findRunExecution(runId: string) {
		const row = z
			.object({ id: z.string() })
			.nullable()
			.parse(
				this.database.query("SELECT id FROM runs WHERE id = ?").get(runId),
			);
		if (!row) return undefined;

		return this.readRunExecution(runId);
	}

	readRunExecution(runId: string): RunExecution {
		const run = z
			.object({
				actual_cost_microusd: z.number().int().nonnegative(),
				failure_category: z.string().nullable(),
				lifecycle_state: z.string(),
				maximum_total_microusd: z.number().int().positive(),
				phase: z.string(),
				reserved_microusd: z.number().int().nonnegative(),
				restoration_state: z.string(),
				revision: z.number().int().positive(),
				terminal_outcome: z.string().nullable(),
			})
			.nullable()
			.parse(
				this.database
					.query(
						`SELECT revision, phase, restoration_state, lifecycle_state,
							terminal_outcome, failure_category,
							maximum_total_microusd, reserved_microusd,
							actual_cost_microusd FROM runs WHERE id = ?`,
					)
					.get(runId),
			);
		if (!run) throw new Error(`Run not found: ${runId}`);
		const attempts = z
			.array(
				z.object({
					hard_limit_microusd: z.number().int().positive(),
					id: z.string(),
					kind: z.string(),
					reserved_microusd: z.number().int().nonnegative(),
					role: z.string(),
					state: z.string(),
				}),
			)
			.parse(
				this.database
					.query(
						`SELECT attempt.id, attempt.kind, attempt.state, attempt.role,
							paid.hard_limit_microusd, paid.reserved_microusd
						FROM operation_attempts attempt
						JOIN paid_operation_attempts paid
							ON paid.operation_attempt_id = attempt.id
						WHERE attempt.run_id = ? ORDER BY attempt.created_at`,
					)
					.all(runId),
			);

		return runExecutionSchema.parse({
			actualCostMicrousd: run.actual_cost_microusd,
			attempts: attempts.map((attempt) => ({
				allowanceMicrousd: attempt.hard_limit_microusd,
				id: attempt.id,
				kind: attempt.kind,
				reservedMicrousd: attempt.reserved_microusd,
				role: attempt.role,
				state: attempt.state,
			})),
			failureCategory: run.failure_category,
			lifecycleState: run.lifecycle_state,
			maximumTotalMicrousd: run.maximum_total_microusd,
			phase: run.phase,
			reservedMicrousd: run.reserved_microusd,
			restorationState: run.restoration_state,
			revision: run.revision,
			terminalOutcome: run.terminal_outcome,
		});
	}

	readRunOperationAttemptAudits(runId: string) {
		const rows = z
			.array(
				z.object({
					actual_cost_microusd: z.number().int().nonnegative().nullable(),
					duration_ms: z.number().int().nonnegative().nullable(),
					effort: effortSchema.nullable(),
					hard_limit_microusd: z.number().int().positive().nullable(),
					id: z.string(),
					kind: z.string(),
					model: z.string().min(1).nullable(),
					process_event_json: z.string().nullable(),
					preview_json: z.string(),
					role: z.string().min(1),
					session_id: z.string().nullable(),
					state: z.string(),
				}),
			)
			.parse(
				this.database
					.query(
						`SELECT attempt.id, attempt.kind, attempt.role, attempt.state,
							attempt.preview_json,
							paid.model, paid.effort, paid.hard_limit_microusd,
							paid.actual_cost_microusd, paid.duration_ms, paid.session_id,
							(
								SELECT event.payload_json FROM run_events event
								WHERE event.run_id = attempt.run_id
									AND event.operation_attempt_id = attempt.id
									AND event.type = 'PROCESS_STARTED'
								ORDER BY event.sequence DESC LIMIT 1
							) AS process_event_json
						FROM operation_attempts attempt
						LEFT JOIN paid_operation_attempts paid
							ON paid.operation_attempt_id = attempt.id
						WHERE attempt.run_id = ? ORDER BY attempt.rowid`,
					)
					.all(runId),
			);

		return rows.map((row) => {
			const processEvent = row.process_event_json
				? z
						.object({
							pid: z.number().int().positive(),
							startIdentity: z.string(),
						})
						.parse(JSON.parse(row.process_event_json))
				: null;
			const previewProcess = z
				.object({
					pid: z.number().int().positive(),
					startIdentity: z.string(),
				})
				.safeParse(JSON.parse(row.preview_json));
			const process =
				processEvent ?? (previewProcess.success ? previewProcess.data : null);

			return {
				actualCostMicrousd: row.actual_cost_microusd ?? "UNAVAILABLE",
				durationMs: row.duration_ms ?? "UNAVAILABLE",
				effort: row.effort ?? "UNAVAILABLE",
				id: row.id,
				identity: row.session_id
					? { type: "SESSION" as const, value: row.session_id }
					: process
						? { ...process, type: "PROCESS" as const }
						: { type: "UNAVAILABLE" as const },
				kind: row.kind,
				limitMicrousd: row.hard_limit_microusd ?? "UNAVAILABLE",
				model: row.model ?? "UNAVAILABLE",
				role: row.role,
				status: row.state,
			};
		});
	}

	readStartupReconciliationCandidates() {
		return z
			.array(
				z.object({
					attempt_id: z.string(),
					has_process_identity: z.number().int().min(0).max(1),
					kind: z.string(),
					run_id: z.string(),
					state: z.enum(["INTENDED", "RUNNING"]),
				}),
			)
			.parse(
				this.database
					.query(
						`SELECT attempt.id AS attempt_id, attempt.kind, attempt.run_id, attempt.state,
							EXISTS (
								SELECT 1 FROM run_events event
								WHERE event.run_id = attempt.run_id
									AND event.operation_attempt_id = attempt.id
									AND event.type = 'PROCESS_STARTED'
							) AS has_process_identity
						FROM operation_attempts attempt
						JOIN active_run_slot slot ON slot.run_id = attempt.run_id
						WHERE attempt.state IN ('INTENDED', 'RUNNING')
						ORDER BY attempt.created_at`,
					)
					.all(),
			)
			.map((row) => ({
				attemptId: row.attempt_id,
				hasProcessIdentity: row.has_process_identity === 1,
				kind: row.kind,
				runId: row.run_id,
				state: row.state,
			}));
	}

	markStartupAttemptUncertain(input: {
		readonly attemptId: string;
		readonly kind: string;
		readonly priorState: "INTENDED" | "RUNNING";
		readonly proof: StartupRecoveryProof;
		readonly runId: string;
	}) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const attempt = this.database
				.query(
					`UPDATE operation_attempts SET state = 'UNCERTAIN', terminal_json = ?,
						updated_at = ?
					WHERE id = ? AND run_id = ? AND state = ?`,
				)
				.run(
					JSON.stringify({
						startupReconciliation: {
							priorState: input.priorState,
							proof: input.proof,
						},
					}),
					timestamp,
					input.attemptId,
					input.runId,
					input.priorState,
				);
			if (attempt.changes !== 1) {
				throw new RunRevisionConflictError(
					"Startup reconciliation candidate is no longer current",
				);
			}
			this.database
				.query(
					`UPDATE runs SET lifecycle_state = 'UNCERTAIN', revision = revision + 1,
						restoration_state = CASE WHEN ? = 'RECOVERY_RESTORE_AND_TERMINATE'
							THEN 'MANUAL_ACTION_REQUIRED' ELSE restoration_state END,
						updated_at = ? WHERE id = ?`,
				)
				.run(input.kind, timestamp, input.runId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	readStartupRecovery(runId: string) {
		const row = z
			.object({ id: z.string(), terminal_json: z.string() })
			.nullable()
			.parse(
				this.database
					.query(
						`SELECT attempt.id, attempt.terminal_json
						FROM operation_attempts attempt
						JOIN paid_operation_attempts paid
							ON paid.operation_attempt_id = attempt.id
						JOIN runs run ON run.id = attempt.run_id
						WHERE attempt.run_id = ? AND attempt.state = 'UNCERTAIN'
							AND run.lifecycle_state = 'UNCERTAIN'
							AND attempt.terminal_json IS NOT NULL
						ORDER BY attempt.updated_at DESC LIMIT 1`,
					)
					.get(runId),
			);
		if (!row) return undefined;
		const reconciliation = z
			.object({
				startupReconciliation: z.object({
					priorState: z.enum(["INTENDED", "RUNNING"]),
					proof: z.enum([
						"NO_COMMITTED_TERMINAL_RESULT",
						"PROCESS_IDENTITY_IS_NOT_COMPLETION_PROOF",
					]),
				}),
			})
			.parse(JSON.parse(row.terminal_json)).startupReconciliation;

		return { attemptId: row.id, ...reconciliation };
	}

	createStartupRecoveryPreview(runId: string, action: StartupRecoveryAction) {
		const recovery = this.readStartupRecovery(runId);
		if (!recovery) {
			throw new RunControlConflictError(
				"Run has no uncertain attempt to recover",
			);
		}
		const attemptId = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const run = z
				.object({
					lifecycle_state: z.literal("UNCERTAIN"),
					revision: z.number().int().positive(),
				})
				.parse(
					this.database
						.query("SELECT lifecycle_state, revision FROM runs WHERE id = ?")
						.get(runId),
				);
			const runRevision = run.revision + 1;
			const preview = {
				action,
				attemptId,
				previewId: attemptId,
				runRevision,
				state: "AWAITING_CONFIRMATION" as const,
			};
			this.database
				.query(
					`INSERT INTO operation_attempts
						(id, kind, state, run_id, lifecycle_revision, preview_json,
						 role, created_at, updated_at)
					VALUES (?, ?, 'AWAITING_CONFIRMATION', ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					attemptId,
					`RECOVERY_${action}`,
					runId,
					runRevision,
					JSON.stringify({
						...preview,
						uncertainAttemptId: recovery.attemptId,
					}),
					action === "CONTINUE_OR_RETRY"
						? "Continue or retry"
						: "Restore and terminate",
					timestamp,
					timestamp,
				);
			this.database
				.query("UPDATE runs SET revision = ?, updated_at = ? WHERE id = ?")
				.run(runRevision, timestamp, runId);
			this.database.run("COMMIT");

			return preview;
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	confirmStartupRecoveryAction(input: {
		readonly expectedRunRevision: number;
		readonly previewId: string;
		readonly runId: string;
	}) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const run = z
				.object({
					lifecycle_state: z.literal("UNCERTAIN"),
					revision: z.number().int().positive(),
				})
				.parse(
					this.database
						.query("SELECT lifecycle_state, revision FROM runs WHERE id = ?")
						.get(input.runId),
				);
			if (run.revision !== input.expectedRunRevision) {
				throw new RunRevisionConflictError("Run revision is stale");
			}
			const attempt = z
				.object({
					preview_json: z.string(),
					state: z.literal("AWAITING_CONFIRMATION"),
				})
				.parse(
					this.database
						.query(
							`SELECT state, preview_json FROM operation_attempts
							WHERE id = ? AND run_id = ? AND kind IN (
								'RECOVERY_CONTINUE_OR_RETRY',
								'RECOVERY_RESTORE_AND_TERMINATE'
							)`,
						)
						.get(input.previewId, input.runId),
				);
			const preview = z
				.object({
					action: z.enum(["CONTINUE_OR_RETRY", "RESTORE_AND_TERMINATE"]),
					attemptId: z.string(),
				})
				.parse(JSON.parse(attempt.preview_json));
			this.database
				.query(
					`UPDATE operation_attempts SET state = 'INTENDED', confirmation_json = ?,
						intent_json = ?, updated_at = ? WHERE id = ?`,
				)
				.run(
					JSON.stringify({ confirmed: true }),
					JSON.stringify({ action: preview.action }),
					timestamp,
					input.previewId,
				);
			this.database
				.query(
					`UPDATE runs SET revision = revision + 1,
						phase = CASE WHEN ? = 'RESTORE_AND_TERMINATE'
							THEN 'RESTORATION' ELSE phase END,
						restoration_state = CASE WHEN ? = 'RESTORE_AND_TERMINATE'
							THEN 'PENDING' ELSE restoration_state END,
						updated_at = ? WHERE id = ?`,
				)
				.run(preview.action, preview.action, timestamp, input.runId);
			this.database.run("COMMIT");

			return {
				action: preview.action,
				attemptId: preview.attemptId,
				runId: input.runId,
				state: "INTENDED" as const,
			};
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	beginTargetRestoration(runId: string, attemptId: string) {
		const baseline = this.readWorkflowBaseline(runId);
		if (!baseline) throw new Error("Run has no sealed workflow baseline");
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const run = z
				.object({ target_root: z.string(), target_sha: z.string().length(40) })
				.parse(
					this.database
						.query("SELECT target_root, target_sha FROM runs WHERE id = ?")
						.get(runId),
				);
			const attempt = this.database
				.query(
					`UPDATE operation_attempts SET state = 'RUNNING', updated_at = ?
					WHERE id = ? AND run_id = ?
						AND kind = 'RECOVERY_RESTORE_AND_TERMINATE'
						AND state = 'INTENDED'`,
				)
				.run(timestamp, attemptId, runId);
			if (attempt.changes !== 1) {
				throw new RunControlConflictError(
					"Restoration attempt is no longer ready to run",
				);
			}
			this.database
				.query(
					`UPDATE runs SET lifecycle_state = 'RESTORING', phase = 'RESTORATION',
						restoration_state = 'RESTORING', revision = revision + 1,
						updated_at = ? WHERE id = ?`,
				)
				.run(timestamp, runId);
			this.database.run("COMMIT");

			return {
				baseline,
				originalSha: run.target_sha,
				targetRoot: run.target_root,
			};
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	completeTargetRestoration(
		runId: string,
		attemptId: string,
		verification: {
			readonly branch: "main";
			readonly originalSha: string;
			readonly residue: readonly string[];
			readonly status: "RESTORED_VERIFIED";
			readonly workflowBaselineSha256: string;
		},
	) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const attempt = this.database
				.query(
					`UPDATE operation_attempts SET state = 'SUCCEEDED', terminal_json = ?,
						updated_at = ? WHERE id = ? AND run_id = ? AND state = 'RUNNING'`,
				)
				.run(JSON.stringify({ verification }), timestamp, attemptId, runId);
			if (attempt.changes !== 1) {
				throw new RunControlConflictError(
					"Restoration attempt is no longer running",
				);
			}
			this.database
				.query(
					`UPDATE runs SET lifecycle_state = 'COMPLETE', phase = 'TERMINAL',
						restoration_state = 'RESTORED_VERIFIED',
						terminal_outcome = coalesce(terminal_outcome, 'INFRASTRUCTURE_FAILURE'),
						failure_category = coalesce(failure_category, 'INFRASTRUCTURE_FAILURE'),
						revision = revision + 1, updated_at = ? WHERE id = ?`,
				)
				.run(timestamp, runId);
			this.database
				.query(
					"UPDATE active_run_slot SET run_id = NULL WHERE singleton = 1 AND run_id = ?",
				)
				.run(runId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	interruptTargetRestoration(
		runId: string,
		attemptId: string,
		message: string,
	) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`UPDATE operation_attempts SET state = 'UNCERTAIN', terminal_json = ?,
						updated_at = ? WHERE id = ? AND run_id = ? AND state = 'RUNNING'`,
				)
				.run(
					JSON.stringify({ restorationFailure: message }),
					timestamp,
					attemptId,
					runId,
				);
			this.database
				.query(
					`UPDATE runs SET lifecycle_state = 'UNCERTAIN',
						restoration_state = 'MANUAL_ACTION_REQUIRED', revision = revision + 1,
						updated_at = ? WHERE id = ?`,
				)
				.run(timestamp, runId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	readTargetRestoration(runId: string) {
		const run = z
			.object({
				restoration_state: z.enum([
					"NOT_REQUIRED",
					"PENDING",
					"RESTORING",
					"RESTORED_VERIFIED",
					"MANUAL_ACTION_REQUIRED",
				]),
				target_root: z.string(),
				target_sha: z.string().length(40),
			})
			.parse(
				this.database
					.query(
						"SELECT target_root, target_sha, restoration_state FROM runs WHERE id = ?",
					)
					.get(runId),
			);
		const attempts = z
			.array(
				z.object({
					id: z.string(),
					state: z.enum([
						"AWAITING_CONFIRMATION",
						"INTENDED",
						"RUNNING",
						"SUCCEEDED",
						"FAILED",
						"CANCELLED",
						"UNCERTAIN",
					]),
					terminal_json: z.string().nullable(),
				}),
			)
			.parse(
				this.database
					.query(
						`SELECT id, state, terminal_json FROM operation_attempts
						WHERE run_id = ? AND kind = 'RECOVERY_RESTORE_AND_TERMINATE'
						ORDER BY created_at`,
					)
					.all(runId),
			);
		const succeeded = attempts.findLast(({ state }) => state === "SUCCEEDED");
		const verification = succeeded?.terminal_json
			? z
					.object({ verification: z.unknown() })
					.parse(JSON.parse(succeeded.terminal_json)).verification
			: null;

		return {
			attempts: attempts.map(({ id, state, terminal_json }) => {
				if (!terminal_json) return { id, state };
				const terminal = z
					.object({ restorationFailure: z.string().optional() })
					.passthrough()
					.parse(JSON.parse(terminal_json));

				return {
					...(terminal.restorationFailure
						? { failure: terminal.restorationFailure }
						: {}),
					id,
					state,
				};
			}),
			originalSha: run.target_sha,
			restorationState: run.restoration_state,
			targetPath: run.target_root,
			verification,
		};
	}

	assertDefinitionMutationAllowed(
		owner: "AUTHORING" | "CALIBRATION" = "AUTHORING",
	) {
		const lifecycle = this.readActiveRunLifecycle();
		if (!lifecycle) return;
		if (
			owner === "CALIBRATION" &&
			(lifecycle === "AWAITING_HUMAN_REVIEW" ||
				lifecycle === "AWAITING_CALIBRATION_CONFIRMATION")
		) {
			return;
		}

		throw new DefinitionMutationLockedError(
			`Definition mutation is locked while the active Run is ${lifecycle}`,
		);
	}

	setActiveRunLifecycle(lifecycle: RunLifecycleState | null) {
		if (!lifecycle) {
			this.database
				.query("UPDATE active_run_slot SET run_id = NULL WHERE singleton = 1")
				.run();
			return;
		}
		const effective = z
			.object({ definition_revision_id: z.string() })
			.parse(
				this.database
					.query(
						"SELECT definition_revision_id FROM effective_definition WHERE singleton = 1",
					)
					.get(),
			);
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`INSERT INTO runs
						(id, schema_version, lifecycle_state, definition_revision_id,
						 summary_json, created_at, updated_at)
					VALUES ('active-run', 1, ?, ?, '{}', ?, ?)
					ON CONFLICT(id) DO UPDATE SET lifecycle_state = excluded.lifecycle_state,
						updated_at = excluded.updated_at`,
				)
				.run(lifecycle, effective.definition_revision_id, timestamp, timestamp);
			this.database
				.query(
					"UPDATE active_run_slot SET run_id = 'active-run' WHERE singleton = 1",
				)
				.run();
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	catalogLegacyRuns(
		entries: readonly {
			readonly parseDiagnostic: string | null;
			readonly sourcePath: string;
			readonly sourceSha256: string;
			readonly summary: unknown;
			readonly variant: "MALFORMED" | "INCOMPLETE" | "STAGE" | "COMPLETE";
		}[],
	) {
		const catalog = this.database.query(
			`INSERT INTO legacy_run_catalog
				(source_path, source_sha256, variant, summary_json, parse_diagnostic, cataloged_at)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(source_path) DO UPDATE SET
				source_sha256 = excluded.source_sha256,
				variant = excluded.variant,
				summary_json = excluded.summary_json,
				parse_diagnostic = excluded.parse_diagnostic,
				cataloged_at = excluded.cataloged_at`,
		);
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database.run("DELETE FROM legacy_run_catalog");
			for (const entry of entries) {
				catalog.run(
					entry.sourcePath,
					entry.sourceSha256,
					entry.variant,
					JSON.stringify(entry.summary),
					entry.parseDiagnostic,
					timestamp,
				);
			}
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	listRunHistory() {
		const legacy = z
			.array(z.object({ summary_json: z.string() }))
			.parse(
				this.database
					.query(
						"SELECT summary_json FROM legacy_run_catalog ORDER BY source_path",
					)
					.all(),
			)
			.map(({ summary_json }) =>
				normalizedRunSummarySchema.parse(JSON.parse(summary_json)),
			);
		const current = z
			.array(
				z.object({
					created_at: z.string(),
					id: z.string(),
					lifecycle_state: z.string(),
					summary_json: z.string(),
				}),
			)
			.parse(
				this.database
					.query(
						"SELECT id, lifecycle_state, summary_json, created_at FROM runs ORDER BY created_at DESC",
					)
					.all(),
			)
			.map((row) => {
				const summary = z
					.object({
						model: z.string().optional(),
						taskId: z.string().optional(),
					})
					.passthrough()
					.parse(JSON.parse(row.summary_json));
				return {
					diagnostic: null,
					id: row.id,
					model: summary.model ?? null,
					source: "NEW" as const,
					status: row.lifecycle_state,
					taskId: summary.taskId ?? null,
					timestamp: row.created_at,
					unavailable: [
						...(summary.model ? [] : ["model"]),
						...(summary.taskId ? [] : ["taskId"]),
					],
					variant: "NEW" as const,
				};
			});
		return [...current, ...legacy];
	}

	createInitialEffectiveDefinition(input: {
		readonly controlBranch: string;
		readonly controlSha: string;
		readonly parts: readonly DefinitionPart[];
	}) {
		const id = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`INSERT INTO definition_revisions
						(id, revision, kind, control_sha, control_branch, validation_json, created_at)
					VALUES (?, 1, 'EFFECTIVE', ?, ?, ?, ?)`,
				)
				.run(
					id,
					input.controlSha,
					input.controlBranch,
					'{"valid":true}',
					timestamp,
				);
			this.insertDefinitionParts(id, input.parts);
			this.database
				.query(
					`INSERT INTO effective_definition
						(singleton, definition_revision_id, control_state, observed_control_sha, updated_at)
					VALUES (1, ?, 'READY', ?, ?)`,
				)
				.run(id, input.controlSha, timestamp);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	recordPendingDefinitionCommit(input: {
		readonly approvedDiff: Uint8Array;
		readonly commitMessage: string;
		readonly controlBranch: string;
		readonly controlSha: string;
		readonly parts: readonly DefinitionPart[];
	}) {
		const effective = z
			.object({ id: z.string(), control_sha: z.string() })
			.parse(
				this.database
					.query(
						`SELECT revision.id, revision.control_sha
						FROM effective_definition effective
						JOIN definition_revisions revision
							ON revision.id = effective.definition_revision_id
						WHERE effective.singleton = 1`,
					)
					.get(),
			);
		const changeSetId = crypto.randomUUID();
		const definitionId = crypto.randomUUID();
		const revision = this.nextDefinitionRevision();
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`INSERT INTO definition_revisions
						(id, revision, kind, base_effective_revision_id, control_sha,
						 control_branch, validation_json, approved_diff, created_at)
					VALUES (?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					definitionId,
					revision,
					effective.id,
					input.controlSha,
					input.controlBranch,
					'{"valid":true}',
					input.approvedDiff,
					timestamp,
				);
			this.insertDefinitionParts(definitionId, input.parts);
			this.database
				.query(
					`INSERT INTO control_change_sets
						(id, definition_revision_id, owner, state, base_control_sha,
						 base_branch, approved_diff, commit_message, committed_sha,
						 created_at, updated_at)
					VALUES (?, ?, 'AUTHORING', 'COMMIT_INTENDED', ?, ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					changeSetId,
					definitionId,
					effective.control_sha,
					input.controlBranch,
					input.approvedDiff,
					input.commitMessage,
					input.controlSha,
					timestamp,
					timestamp,
				);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	readPendingDefinitionCommit() {
		const pending = z
			.object({
				change_set_id: z.string(),
				control_branch: z.string(),
				control_sha: z.string(),
				definition_revision_id: z.string(),
			})
			.nullable()
			.parse(
				this.database
					.query(
						`SELECT change_set.id AS change_set_id,
							change_set.definition_revision_id,
							change_set.committed_sha AS control_sha,
							revision.control_branch
						FROM control_change_sets change_set
						JOIN definition_revisions revision
							ON revision.id = change_set.definition_revision_id
						WHERE change_set.state = 'COMMIT_INTENDED'
							AND change_set.committed_sha IS NOT NULL
						ORDER BY change_set.created_at DESC
						LIMIT 1`,
					)
					.get(),
			);
		if (!pending) return undefined;

		return {
			changeSetId: pending.change_set_id,
			controlBranch: pending.control_branch,
			controlSha: pending.control_sha,
			parts: this.readDefinitionParts(pending.definition_revision_id),
		};
	}

	readLatestDefinitionDraft() {
		const draft = z
			.object({
				approved_diff: z.instanceof(Uint8Array),
				change_set_id: z.string(),
				id: z.string(),
				revision: z.number().int().positive(),
			})
			.nullable()
			.parse(
				this.database
					.query(
						`SELECT revision.id, revision.revision, revision.approved_diff,
							change_set.id AS change_set_id
						FROM definition_revisions revision
						JOIN control_change_sets change_set
							ON change_set.definition_revision_id = revision.id
						WHERE revision.kind = 'DRAFT'
							AND change_set.state NOT IN ('COMMITTED', 'REJECTED')
						ORDER BY revision.revision DESC
						LIMIT 1`,
					)
					.get(),
			);
		if (!draft) return undefined;

		return {
			changeSetId: draft.change_set_id,
			diff: new TextDecoder().decode(draft.approved_diff),
			parts: this.readDefinitionParts(draft.id),
			revision: draft.revision,
		};
	}

	createDefinitionDraft(input: {
		readonly diff: string;
		readonly expectedDraftRevision: number | null;
		readonly expectedEffectiveRevision: number;
		readonly parts: readonly DefinitionPart[];
		readonly valid: boolean;
	}) {
		this.database.run("BEGIN IMMEDIATE");
		try {
			const effective = z
				.object({
					control_branch: z.string(),
					control_sha: z.string(),
					id: z.string(),
					revision: z.number().int().positive(),
				})
				.parse(
					this.database
						.query(
							`SELECT revision.id, revision.revision, revision.control_sha,
								revision.control_branch
							FROM effective_definition effective
							JOIN definition_revisions revision
								ON revision.id = effective.definition_revision_id
							WHERE effective.singleton = 1`,
						)
						.get(),
				);
			const currentDraft = this.readLatestDefinitionDraft();
			if (effective.revision !== input.expectedEffectiveRevision) {
				throw new DefinitionRevisionConflictError(
					"Effective definition revision is stale",
				);
			}
			if ((currentDraft?.revision ?? null) !== input.expectedDraftRevision) {
				throw new DefinitionRevisionConflictError(
					"Definition draft revision is stale",
				);
			}

			const id = crypto.randomUUID();
			const changeSetId = crypto.randomUUID();
			const revision = this.nextDefinitionRevision();
			const timestamp = new Date().toISOString();
			this.database
				.query(
					`INSERT INTO definition_revisions
						(id, revision, kind, base_effective_revision_id, control_sha,
						 control_branch, validation_json, approved_diff, created_at)
					SELECT ?, ?, 'DRAFT', revision.id, revision.control_sha,
						revision.control_branch, ?, ?, ?
					FROM definition_revisions revision WHERE revision.id = ?`,
				)
				.run(
					id,
					revision,
					JSON.stringify({ valid: input.valid }),
					Buffer.from(input.diff),
					timestamp,
					effective.id,
				);
			this.insertDefinitionParts(id, input.parts);
			this.database
				.query(
					`INSERT INTO control_change_sets
						(id, definition_revision_id, owner, state, base_control_sha,
						 base_branch, approved_diff, commit_message, created_at, updated_at)
					VALUES (?, ?, 'AUTHORING', 'DRAFT', ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					changeSetId,
					id,
					effective.control_sha,
					effective.control_branch,
					Buffer.from(input.diff),
					"chore: update benchmark definition",
					timestamp,
					timestamp,
				);
			this.insertControlChangePaths(changeSetId, effective.id, id);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	createApplyPreview(changeSetId: string) {
		const change = this.readControlChange(changeSetId, "DRAFT");
		if (!change.valid) {
			throw new ControlChangeConflictError(
				"Invalid definition drafts cannot be applied",
			);
		}

		const attemptId = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		const preview = {
			changeSetId,
			diff: change.approvedDiff,
			paths: change.paths.map((path) => ({
				newSha256: path.newSha256,
				oldSha256: path.oldSha256,
				path: path.path,
			})),
		};
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`INSERT INTO operation_attempts
						(id, kind, state, change_set_id, lifecycle_revision, preview_json,
						 created_at, updated_at)
					VALUES (?, 'CONTROL_APPLY', 'AWAITING_CONFIRMATION', ?, 0, ?, ?, ?)`,
				)
				.run(
					attemptId,
					changeSetId,
					JSON.stringify(preview),
					timestamp,
					timestamp,
				);
			this.database
				.query(
					"UPDATE control_change_sets SET state = 'AWAITING_APPLY_CONFIRMATION', updated_at = ? WHERE id = ? AND state = 'DRAFT'",
				)
				.run(timestamp, changeSetId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}

		return { attemptId, ...preview };
	}

	recordApplyIntent(changeSetId: string, attemptId: string) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const attempt = z.object({ id: z.string() }).parse(
				this.database
					.query(
						`SELECT id FROM operation_attempts
							WHERE id = ? AND change_set_id = ? AND kind = 'CONTROL_APPLY'
								AND state = 'AWAITING_CONFIRMATION'`,
					)
					.get(attemptId, changeSetId),
			);
			this.readControlChange(changeSetId, "AWAITING_APPLY_CONFIRMATION");
			this.database
				.query(
					`UPDATE operation_attempts
					SET state = 'INTENDED', confirmation_json = ?, intent_json = ?, updated_at = ?
					WHERE id = ?`,
				)
				.run('{"confirmed":true}', '{"action":"APPLY"}', timestamp, attempt.id);
			this.database
				.query(
					"UPDATE control_change_sets SET state = 'APPLY_INTENDED', updated_at = ? WHERE id = ?",
				)
				.run(timestamp, changeSetId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}

		return this.readControlChange(changeSetId, "APPLY_INTENDED");
	}

	completeApply(changeSetId: string, attemptId: string) {
		this.finishApply(changeSetId, attemptId, "APPLIED", "SUCCEEDED");
	}

	markControlChangeDiverged(changeSetId: string, attemptId: string) {
		this.finishApply(changeSetId, attemptId, "DIVERGED", "FAILED");
	}

	readInterruptedControlChanges() {
		return z
			.array(z.object({ id: z.string() }))
			.parse(
				this.database
					.query(
						"SELECT id FROM control_change_sets WHERE state = 'APPLY_INTENDED'",
					)
					.all(),
			)
			.map(({ id }) => id);
	}

	readManagedControlChanges() {
		return z
			.array(z.object({ id: z.string() }))
			.parse(
				this.database
					.query(
						`SELECT id FROM control_change_sets WHERE state IN (
							'APPLIED', 'AWAITING_REVIEW_CONFIRMATION', 'REVIEW_RUNNING',
							'REVIEW_UNCERTAIN', 'REVIEWED', 'AWAITING_COMMIT_CONFIRMATION',
							'COMMIT_INTENDED'
						) AND committed_sha IS NULL`,
					)
					.all(),
			)
			.map(({ id }) => id);
	}

	readControlChangeState(changeSetId: string) {
		return this.readControlChange(changeSetId);
	}

	readLatestInstructionReview(changeSetId: string) {
		const row = z
			.object({
				actual_cost_microusd: z.number().int().nonnegative().nullable(),
				duration_ms: z.number().int().nonnegative().nullable(),
				hard_limit_microusd: z.number().int().positive(),
				reserved_microusd: z.number().int().nonnegative(),
				session_id: z.string().nullable(),
				state: z.enum([
					"AWAITING_CONFIRMATION",
					"RUNNING",
					"SUCCEEDED",
					"FAILED",
					"UNCERTAIN",
				]),
			})
			.nullable()
			.parse(
				this.database
					.query(
						`SELECT attempt.state, paid.hard_limit_microusd,
							paid.reserved_microusd, paid.actual_cost_microusd,
							paid.duration_ms, paid.session_id
						FROM operation_attempts attempt
						JOIN paid_operation_attempts paid
							ON paid.operation_attempt_id = attempt.id
						WHERE attempt.change_set_id = ? AND attempt.kind = 'INSTRUCTION_REVIEW'
						ORDER BY attempt.created_at DESC LIMIT 1`,
					)
					.get(changeSetId),
			);
		if (!row) return null;

		return {
			actualCostMicrousd: row.actual_cost_microusd,
			durationMs: row.duration_ms,
			hardLimitMicrousd: row.hard_limit_microusd,
			reservedMicrousd: row.reserved_microusd,
			sessionId: row.session_id,
			state: row.state,
		};
	}

	reconcileApply(
		changeSetId: string,
		recoveryState: "ALL_OLD" | "ALL_NEW" | "MIXED" | "DIVERGED",
	) {
		const state = {
			ALL_NEW: "APPLIED",
			ALL_OLD: "APPLY_INTENDED",
			DIVERGED: "DIVERGED",
			MIXED: "MIXED",
		}[recoveryState];
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					"UPDATE control_change_sets SET state = ?, updated_at = ? WHERE id = ?",
				)
				.run(state, timestamp, changeSetId);
			this.database
				.query(
					`UPDATE operation_attempts
					SET state = 'UNCERTAIN', terminal_json = ?, updated_at = ?
					WHERE change_set_id = ? AND kind = 'CONTROL_APPLY' AND state = 'INTENDED'`,
				)
				.run('{"state":"UNCERTAIN"}', timestamp, changeSetId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	recordApplyRecoveryIntent(
		changeSetId: string,
		action: "CONTINUE" | "RESTORE",
	) {
		const change = this.readControlChange(changeSetId);
		if (!["APPLY_INTENDED", "APPLIED", "MIXED"].includes(change.state)) {
			throw new ControlChangeConflictError("Control change is not recoverable");
		}

		const attemptId = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		this.database
			.query(
				`INSERT INTO operation_attempts
					(id, kind, state, change_set_id, lifecycle_revision, preview_json,
					 confirmation_json, intent_json, created_at, updated_at)
				VALUES (?, 'CONTROL_APPLY_RECOVERY', 'INTENDED', ?, 0, ?, ?, ?, ?, ?)`,
			)
			.run(
				attemptId,
				changeSetId,
				JSON.stringify({ action }),
				JSON.stringify({ action, confirmed: true }),
				JSON.stringify({ action }),
				timestamp,
				timestamp,
			);

		return { attemptId, change };
	}

	completeApplyRecovery(
		changeSetId: string,
		attemptId: string,
		action: "CONTINUE" | "RESTORE",
	) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					"UPDATE control_change_sets SET state = ?, updated_at = ? WHERE id = ?",
				)
				.run(
					action === "CONTINUE" ? "APPLIED" : "DRAFT",
					timestamp,
					changeSetId,
				);
			this.database
				.query(
					`UPDATE operation_attempts
					SET state = 'SUCCEEDED', terminal_json = ?, updated_at = ? WHERE id = ?`,
				)
				.run('{"state":"SUCCEEDED"}', timestamp, attemptId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	createInstructionReviewPreview(
		changeSetId: string,
		input: {
			readonly effort?: string;
			readonly hardLimitMicrousd: number;
			readonly model: string;
		},
	) {
		const change = this.readControlChange(changeSetId, "APPLIED");
		if (!this.hasInstructionChange(change)) {
			throw new ControlChangeConflictError(
				"This change does not require instruction review",
			);
		}
		const attemptId = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		const preview = { attemptId, frozenDiff: change.approvedDiff, ...input };
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`INSERT INTO operation_attempts
						(id, kind, state, change_set_id, lifecycle_revision, preview_json,
						 created_at, updated_at)
					VALUES (?, 'INSTRUCTION_REVIEW', 'AWAITING_CONFIRMATION', ?, 0, ?, ?, ?)`,
				)
				.run(
					attemptId,
					changeSetId,
					JSON.stringify(preview),
					timestamp,
					timestamp,
				);
			this.database
				.query(
					`INSERT INTO paid_operation_attempts
						(operation_attempt_id, model, effort, hard_limit_microusd,
						 reserved_microusd)
					VALUES (?, ?, ?, ?, 0)`,
				)
				.run(
					attemptId,
					input.model,
					input.effort ?? null,
					input.hardLimitMicrousd,
				);
			this.database
				.query(
					"UPDATE control_change_sets SET state = 'AWAITING_REVIEW_CONFIRMATION', updated_at = ? WHERE id = ?",
				)
				.run(timestamp, changeSetId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
		return preview;
	}

	recordInstructionReviewIntent(changeSetId: string, attemptId: string) {
		const row = z
			.object({
				effort: effortSchema.nullable(),
				hard_limit_microusd: z.number().int().positive(),
				model: z.string(),
				preview_json: z.string(),
			})
			.parse(
				this.database
					.query(
						`SELECT paid.model, paid.effort, paid.hard_limit_microusd,
							attempt.preview_json
						FROM operation_attempts attempt
						JOIN paid_operation_attempts paid
							ON paid.operation_attempt_id = attempt.id
						WHERE attempt.id = ? AND attempt.change_set_id = ?
							AND attempt.kind = 'INSTRUCTION_REVIEW'
							AND attempt.state = 'AWAITING_CONFIRMATION'`,
					)
					.get(attemptId, changeSetId),
			);
		this.readControlChange(changeSetId, "AWAITING_REVIEW_CONFIRMATION");
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`UPDATE operation_attempts SET state = 'RUNNING', confirmation_json = ?,
						intent_json = ?, updated_at = ? WHERE id = ?`,
				)
				.run(
					'{"confirmed":true}',
					'{"action":"INSTRUCTION_REVIEW"}',
					timestamp,
					attemptId,
				);
			this.database
				.query(
					"UPDATE paid_operation_attempts SET reserved_microusd = hard_limit_microusd WHERE operation_attempt_id = ?",
				)
				.run(attemptId);
			this.database
				.query(
					"UPDATE control_change_sets SET state = 'REVIEW_RUNNING', updated_at = ? WHERE id = ?",
				)
				.run(timestamp, changeSetId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
		const preview = z
			.object({ frozenDiff: z.string() })
			.parse(JSON.parse(row.preview_json));
		return {
			effort: row.effort ?? undefined,
			frozenDiff: preview.frozenDiff,
			hardLimitMicrousd: row.hard_limit_microusd,
			model: row.model,
		};
	}

	completeInstructionReview(
		changeSetId: string,
		attemptId: string,
		result: {
			readonly actualCostMicrousd: number;
			readonly durationMs: number;
			readonly findings: readonly {
				readonly blocking: boolean;
				readonly message: string;
			}[];
			readonly sessionId: string;
			readonly summary: string;
		},
	) {
		const timestamp = new Date().toISOString();
		const findings = result.findings.map((finding) => ({
			...finding,
			id: crypto.randomUUID(),
		}));
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`UPDATE operation_attempts SET state = 'SUCCEEDED', terminal_json = ?,
						updated_at = ? WHERE id = ? AND state = 'RUNNING'`,
				)
				.run(JSON.stringify(result), timestamp, attemptId);
			this.database
				.query(
					`UPDATE paid_operation_attempts SET reserved_microusd = 0,
						actual_cost_microusd = ?, duration_ms = ?, session_id = ?,
						redacted_result_json = ? WHERE operation_attempt_id = ?`,
				)
				.run(
					result.actualCostMicrousd,
					result.durationMs,
					result.sessionId,
					JSON.stringify(result),
					attemptId,
				);
			const insert = this.database.query(
				`INSERT INTO instruction_review_findings
					(id, operation_attempt_id, ordinal, blocking, finding_json)
				VALUES (?, ?, ?, ?, ?)`,
			);
			findings.forEach((finding, ordinal) => {
				insert.run(
					finding.id,
					attemptId,
					ordinal,
					finding.blocking ? 1 : 0,
					JSON.stringify({ message: finding.message }),
				);
			});
			this.database
				.query(
					"UPDATE control_change_sets SET state = 'REVIEWED', updated_at = ? WHERE id = ?",
				)
				.run(timestamp, changeSetId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
		return {
			...result,
			findings,
		};
	}

	failInstructionReview(
		changeSetId: string,
		attemptId: string,
		message: string,
	) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`UPDATE operation_attempts SET state = 'FAILED', terminal_json = ?,
						updated_at = ? WHERE id = ? AND state = 'RUNNING'`,
				)
				.run(
					JSON.stringify({ message, state: "FAILED" }),
					timestamp,
					attemptId,
				);
			this.database
				.query(
					"UPDATE paid_operation_attempts SET reserved_microusd = 0 WHERE operation_attempt_id = ?",
				)
				.run(attemptId);
			this.database
				.query(
					"UPDATE control_change_sets SET state = 'APPLIED', updated_at = ? WHERE id = ?",
				)
				.run(timestamp, changeSetId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	reconcileInterruptedInstructionReviews() {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`UPDATE operation_attempts SET state = 'UNCERTAIN', terminal_json = ?,
						updated_at = ? WHERE kind = 'INSTRUCTION_REVIEW' AND state = 'RUNNING'`,
				)
				.run('{"state":"UNCERTAIN"}', timestamp);
			this.database
				.query(
					"UPDATE control_change_sets SET state = 'REVIEW_UNCERTAIN', updated_at = ? WHERE state = 'REVIEW_RUNNING'",
				)
				.run(timestamp);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	dispositionInstructionFinding(
		changeSetId: string,
		findingId: string,
		disposition: unknown,
	) {
		const result = this.database
			.query(
				`UPDATE instruction_review_findings SET disposition_json = ?
				WHERE id = ? AND operation_attempt_id IN (
					SELECT id FROM operation_attempts WHERE change_set_id = ?
				)`,
			)
			.run(JSON.stringify(disposition), findingId, changeSetId);
		if (result.changes !== 1) {
			throw new ControlChangeConflictError("Instruction finding was not found");
		}
	}

	readCommitCandidate(changeSetId: string) {
		const change = this.readControlChange(changeSetId);
		const instructionChange = this.hasInstructionChange(change);
		if (
			(!instructionChange && change.state !== "APPLIED") ||
			(instructionChange && change.state !== "REVIEWED")
		) {
			throw new ControlChangeConflictError(
				"Control change is not ready to Commit",
			);
		}
		if (instructionChange) {
			const unresolved = z.object({ count: z.number() }).parse(
				this.database
					.query(
						`SELECT COUNT(*) AS count FROM instruction_review_findings finding
							JOIN operation_attempts attempt ON attempt.id = finding.operation_attempt_id
							WHERE attempt.change_set_id = ? AND finding.disposition_json IS NULL`,
					)
					.get(changeSetId),
			).count;
			if (unresolved > 0) {
				throw new ControlChangeConflictError(
					"Every instruction-review finding needs a disposition",
				);
			}
		}
		return change;
	}

	createCommitPreview(
		changeSetId: string,
		preview: {
			readonly commitMessage: string;
			readonly files: readonly string[];
			readonly stagedDiff: string;
		},
	) {
		const attemptId = crypto.randomUUID();
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`INSERT INTO operation_attempts
						(id, kind, state, change_set_id, lifecycle_revision, preview_json,
						 created_at, updated_at)
					VALUES (?, 'CONTROL_COMMIT', 'AWAITING_CONFIRMATION', ?, 0, ?, ?, ?)`,
				)
				.run(
					attemptId,
					changeSetId,
					JSON.stringify(preview),
					timestamp,
					timestamp,
				);
			this.database
				.query(
					"UPDATE control_change_sets SET state = 'AWAITING_COMMIT_CONFIRMATION', updated_at = ? WHERE id = ?",
				)
				.run(timestamp, changeSetId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
		return { attemptId, ...preview };
	}

	recordCommitIntent(changeSetId: string, attemptId: string) {
		this.readControlChange(changeSetId, "AWAITING_COMMIT_CONFIRMATION");
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			const updated = this.database
				.query(
					`UPDATE operation_attempts SET state = 'INTENDED', confirmation_json = ?,
						intent_json = ?, updated_at = ? WHERE id = ? AND change_set_id = ?
						AND kind = 'CONTROL_COMMIT' AND state = 'AWAITING_CONFIRMATION'`,
				)
				.run(
					'{"confirmed":true}',
					'{"action":"COMMIT"}',
					timestamp,
					attemptId,
					changeSetId,
				);
			if (updated.changes !== 1) {
				throw new ControlChangeConflictError("Commit confirmation is stale");
			}
			this.database
				.query(
					"UPDATE control_change_sets SET state = 'COMMIT_INTENDED', updated_at = ? WHERE id = ?",
				)
				.run(timestamp, changeSetId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
		return this.readControlChange(changeSetId, "COMMIT_INTENDED");
	}

	completeCommit(changeSetId: string, attemptId: string, controlSha: string) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					"UPDATE control_change_sets SET committed_sha = ?, updated_at = ? WHERE id = ? AND state = 'COMMIT_INTENDED'",
				)
				.run(controlSha, timestamp, changeSetId);
			this.database
				.query(
					"UPDATE operation_attempts SET state = 'SUCCEEDED', terminal_json = ?, updated_at = ? WHERE id = ?",
				)
				.run(JSON.stringify({ controlSha }), timestamp, attemptId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
		this.promotePendingDefinitionCommit(changeSetId);
	}

	failCommit(changeSetId: string, attemptId: string) {
		const change = this.readControlChange(changeSetId, "COMMIT_INTENDED");
		const timestamp = new Date().toISOString();
		this.database
			.query(
				"UPDATE operation_attempts SET state = 'FAILED', terminal_json = ?, updated_at = ? WHERE id = ?",
			)
			.run('{"state":"FAILED"}', timestamp, attemptId);
		this.database
			.query(
				"UPDATE control_change_sets SET state = ?, updated_at = ? WHERE id = ?",
			)
			.run(
				this.hasInstructionChange(change) ? "REVIEWED" : "APPLIED",
				timestamp,
				changeSetId,
			);
	}

	promotePendingDefinitionCommit(changeSetId: string) {
		const pending = z
			.object({
				committed_sha: z.string(),
				control_branch: z.string(),
				definition_revision_id: z.string(),
				validation_json: z.string(),
			})
			.parse(
				this.database
					.query(
						`SELECT change_set.definition_revision_id, change_set.committed_sha,
							revision.control_branch, revision.validation_json
						FROM control_change_sets change_set
						JOIN definition_revisions revision
							ON revision.id = change_set.definition_revision_id
						WHERE change_set.id = ? AND change_set.state = 'COMMIT_INTENDED'`,
					)
					.get(changeSetId),
			);
		const effectiveId = crypto.randomUUID();
		const revision = this.nextDefinitionRevision();
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					`INSERT INTO definition_revisions
						(id, revision, kind, control_sha, control_branch, validation_json, created_at)
					VALUES (?, ?, 'EFFECTIVE', ?, ?, ?, ?)`,
				)
				.run(
					effectiveId,
					revision,
					pending.committed_sha,
					pending.control_branch,
					pending.validation_json,
					timestamp,
				);
			this.database
				.query(
					`INSERT INTO definition_parts
						(definition_revision_id, path, path_type, content, sha256, parsed_json)
					SELECT ?, path, path_type, content, sha256, parsed_json
					FROM definition_parts WHERE definition_revision_id = ?`,
				)
				.run(effectiveId, pending.definition_revision_id);
			this.database
				.query(
					`UPDATE effective_definition
					SET definition_revision_id = ?, control_state = 'READY',
						observed_control_sha = ?, updated_at = ?
					WHERE singleton = 1`,
				)
				.run(effectiveId, pending.committed_sha, timestamp);
			this.database
				.query(
					"UPDATE control_change_sets SET state = 'COMMITTED', updated_at = ? WHERE id = ?",
				)
				.run(timestamp, changeSetId);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	updateControlState(
		state: "READY" | "CONTROL_DIVERGED",
		observedControlSha: string,
	) {
		this.database
			.query(
				"UPDATE effective_definition SET control_state = ?, observed_control_sha = ?, updated_at = ? WHERE singleton = 1",
			)
			.run(state, observedControlSha, new Date().toISOString());
	}

	close() {
		if (this.closed) return;

		this.database.close(true);
		this.closed = true;
	}

	private finishApply(
		changeSetId: string,
		attemptId: string,
		changeState: "APPLIED" | "DIVERGED",
		attemptState: "SUCCEEDED" | "FAILED",
	) {
		const timestamp = new Date().toISOString();
		this.database.run("BEGIN IMMEDIATE");
		try {
			this.database
				.query(
					"UPDATE control_change_sets SET state = ?, updated_at = ? WHERE id = ?",
				)
				.run(changeState, timestamp, changeSetId);
			this.database
				.query(
					`UPDATE operation_attempts
					SET state = ?, terminal_json = ?, updated_at = ?
					WHERE id = ? AND change_set_id = ? AND state = 'INTENDED'`,
				)
				.run(
					attemptState,
					JSON.stringify({ state: attemptState }),
					timestamp,
					attemptId,
					changeSetId,
				);
			this.database.run("COMMIT");
		} catch (error) {
			if (this.database.inTransaction) this.database.run("ROLLBACK");
			throw error;
		}
	}

	private insertControlChangePaths(
		changeSetId: string,
		oldDefinitionId: string,
		newDefinitionId: string,
	) {
		this.database
			.query(
				`INSERT INTO control_change_paths
					(change_set_id, path, old_path_type, old_sha256, old_content,
					 new_path_type, new_sha256, new_content)
				SELECT ?, old.path, old.path_type, old.sha256, old.content,
					new.path_type, new.sha256, new.content
				FROM definition_parts old
				JOIN definition_parts new ON new.path = old.path
				WHERE old.definition_revision_id = ? AND new.definition_revision_id = ?`,
			)
			.run(changeSetId, oldDefinitionId, newDefinitionId);
	}

	private hasInstructionChange(change: {
		readonly paths: readonly FrozenControlPath[];
	}) {
		const instructions = change.paths.find(({ path }) => path === "CLAUDE.md");
		return Boolean(
			instructions &&
				(instructions.oldPathType !== instructions.newPathType ||
					instructions.oldSha256 !== instructions.newSha256),
		);
	}

	private readControlChange(changeSetId: string, expectedState?: string) {
		const row = z
			.object({
				approved_diff: z.instanceof(Uint8Array),
				base_branch: z.string(),
				base_control_sha: z.string(),
				commit_message: z.string(),
				state: z.enum([
					"DRAFT",
					"AWAITING_APPLY_CONFIRMATION",
					"APPLY_INTENDED",
					"APPLIED",
					"MIXED",
					"DIVERGED",
					"AWAITING_REVIEW_CONFIRMATION",
					"REVIEW_RUNNING",
					"REVIEW_UNCERTAIN",
					"REVIEWED",
					"AWAITING_COMMIT_CONFIRMATION",
					"COMMIT_INTENDED",
					"COMMITTED",
				]),
				validation_json: z.string(),
			})
			.parse(
				this.database
					.query(
						`SELECT change_set.approved_diff, change_set.base_branch,
							change_set.base_control_sha, change_set.commit_message,
							revision.validation_json, change_set.state
						FROM control_change_sets change_set
						JOIN definition_revisions revision
							ON revision.id = change_set.definition_revision_id
						WHERE change_set.id = ?`,
					)
					.get(changeSetId),
			);
		if (expectedState && row.state !== expectedState) {
			throw new ControlChangeConflictError(
				`Expected Control change state ${expectedState}, found ${row.state}`,
			);
		}
		const paths = z
			.array(
				z.object({
					new_content: z.instanceof(Uint8Array).nullable(),
					new_path_type: z.enum(["FILE", "SYMLINK", "MISSING"]),
					new_sha256: z.string().length(64),
					old_content: z.instanceof(Uint8Array).nullable(),
					old_path_type: z.enum(["FILE", "SYMLINK", "MISSING"]),
					old_sha256: z.string().length(64),
					path: controlDefinitionPathSchema,
				}),
			)
			.length(8)
			.parse(
				this.database
					.query(
						`SELECT path, old_path_type, old_sha256, old_content,
							new_path_type, new_sha256, new_content
						FROM control_change_paths WHERE change_set_id = ? ORDER BY rowid`,
					)
					.all(changeSetId),
			);

		return {
			approvedDiff: new TextDecoder().decode(row.approved_diff),
			baseBranch: row.base_branch,
			baseControlSha: row.base_control_sha,
			commitMessage: row.commit_message,
			paths: paths.map(
				(path): FrozenControlPath => ({
					newContent: new TextDecoder().decode(path.new_content ?? undefined),
					newPathType: path.new_path_type,
					newSha256: path.new_sha256,
					oldContent: new TextDecoder().decode(path.old_content ?? undefined),
					oldPathType: path.old_path_type,
					oldSha256: path.old_sha256,
					path: path.path,
				}),
			),
			state: row.state,
			valid: z
				.object({ valid: z.boolean() })
				.parse(JSON.parse(row.validation_json)).valid,
		};
	}

	private verify() {
		const diagnostics = this.readDiagnostics();
		const expected: StorageDiagnostics = {
			applicationId: APPLICATION_ID,
			busyTimeout: 5_000,
			cellSizeCheck: 1,
			foreignKeys: 1,
			journalMode: "delete",
			lockingMode: "exclusive",
			mmapSize: 0,
			synchronous: 3,
			trustedSchema: 0,
		};
		if (!isDeepStrictEqual(diagnostics, expected)) {
			throw new Error("SQLite pragma verification failed");
		}

		z.object({ quick_check: z.literal("ok") }).parse(
			this.database.query("PRAGMA quick_check").get(),
		);
		if (this.database.query("PRAGMA foreign_key_check").all().length > 0) {
			throw new Error("SQLite foreign key check failed");
		}
	}

	private insertDefinitionParts(
		definitionRevisionId: string,
		parts: readonly DefinitionPart[],
	) {
		const insertPart = this.database.query(
			`INSERT INTO definition_parts
				(definition_revision_id, path, path_type, content, sha256)
			VALUES (?, ?, ?, ?, ?)`,
		);
		for (const part of parts) {
			insertPart.run(
				definitionRevisionId,
				part.path,
				part.pathType,
				Buffer.from(part.content),
				part.sha256,
			);
		}
	}

	private nextDefinitionRevision() {
		return z
			.object({ revision: z.number().int().positive() })
			.parse(
				this.database
					.query(
						"SELECT COALESCE(MAX(revision), 0) + 1 AS revision FROM definition_revisions",
					)
					.get(),
			).revision;
	}

	private incrementRunRevision(runId: string) {
		const result = this.database
			.query("UPDATE runs SET revision = revision + 1 WHERE id = ?")
			.run(runId);
		if (result.changes !== 1) {
			throw new RunRevisionConflictError("Run does not exist");
		}

		return z
			.object({ revision: z.number().int().positive() })
			.parse(
				this.database
					.query("SELECT revision FROM runs WHERE id = ?")
					.get(runId),
			).revision;
	}

	private readDefinitionParts(definitionRevisionId: string) {
		const rows = z
			.array(
				z.object({
					content: z.instanceof(Uint8Array),
					path: controlDefinitionPathSchema,
					path_type: z.enum(["FILE", "SYMLINK", "MISSING"]),
					sha256: z.string().length(64),
				}),
			)
			.parse(
				this.database
					.query(
						"SELECT path, path_type, content, sha256 FROM definition_parts WHERE definition_revision_id = ? ORDER BY rowid",
					)
					.all(definitionRevisionId),
			);

		return rows.map((row) => ({
			content: new TextDecoder().decode(row.content),
			path: row.path,
			pathType: row.path_type,
			sha256: row.sha256,
		}));
	}

	private readNumber(name: string) {
		return z
			.record(z.string(), z.number())
			.transform((row) => Object.values(row)[0])
			.pipe(z.number())
			.parse(this.database.query(`PRAGMA ${name}`).get());
	}

	private readString(name: string) {
		return z
			.record(z.string(), z.string())
			.transform((row) => Object.values(row)[0])
			.pipe(z.string())
			.parse(this.database.query(`PRAGMA ${name}`).get());
	}
}

function pipelineRoles(configuration: RunConfiguration) {
	return [
		{
			label: "Workflow",
			role: "WORKFLOW" as const,
			...configuration.paidRoles.workflow,
		},
		{
			label: "Product Owner",
			role: "PRODUCT_OWNER" as const,
			...configuration.paidRoles.productOwner,
		},
		{
			label: "Stage Judge",
			role: "STAGE_JUDGE" as const,
			...configuration.paidRoles.stageJudge,
		},
		{
			label: "Final Judge",
			role: "FINAL_JUDGE" as const,
			...configuration.paidRoles.finalJudge,
		},
	];
}

function chunks(bytes?: Uint8Array) {
	if (!bytes) return [];

	const result: Uint8Array[] = [];
	for (let offset = 0; offset < bytes.byteLength; offset += 65_536) {
		result.push(bytes.slice(offset, offset + 65_536));
	}

	return result;
}

function combineBytes(chunks: readonly Uint8Array[]) {
	const result = new Uint8Array(
		chunks.reduce((length, chunk) => length + chunk.byteLength, 0),
	);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return result;
}
