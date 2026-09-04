import type { SqliteMigration } from "../sqlite-migrations";

export const runLifecycleContextMigration = {
	version: 10,
	name: "run lifecycle context",
	statements: [
		`CREATE TABLE target_setup_operations (
			run_id TEXT PRIMARY KEY REFERENCES runs(id),
			operation_attempt_id TEXT NOT NULL UNIQUE REFERENCES operation_attempts(id),
			pre_task_ids_json TEXT NOT NULL CHECK (json_valid(pre_task_ids_json)),
			expected_title TEXT NOT NULL,
			expected_description TEXT NOT NULL,
			instruction_sha256 TEXT NOT NULL CHECK (length(instruction_sha256) = 64),
			target_root TEXT NOT NULL,
			original_branch TEXT NOT NULL,
			original_sha TEXT NOT NULL,
			original_status TEXT NOT NULL,
			expected_commit_subject TEXT NOT NULL,
			task_id TEXT,
			setup_sha TEXT,
			observed_json TEXT CHECK (observed_json IS NULL OR json_valid(observed_json)),
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		) STRICT`,
		`CREATE TRIGGER target_setup_identity_guard
		BEFORE UPDATE ON target_setup_operations
		WHEN NEW.run_id IS NOT OLD.run_id
			OR NEW.operation_attempt_id IS NOT OLD.operation_attempt_id
			OR NEW.pre_task_ids_json IS NOT OLD.pre_task_ids_json
			OR NEW.expected_title IS NOT OLD.expected_title
			OR NEW.expected_description IS NOT OLD.expected_description
			OR NEW.instruction_sha256 IS NOT OLD.instruction_sha256
			OR NEW.target_root IS NOT OLD.target_root
			OR NEW.original_branch IS NOT OLD.original_branch
			OR NEW.original_sha IS NOT OLD.original_sha
			OR NEW.original_status IS NOT OLD.original_status
			OR NEW.expected_commit_subject IS NOT OLD.expected_commit_subject
		BEGIN
			SELECT RAISE(ABORT, 'Target setup intent is immutable');
		END`,
	],
} as const satisfies SqliteMigration;
