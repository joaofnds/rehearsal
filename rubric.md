# Audit Log Rubric

Grade every item as PASS or FAIL. A missing, ambiguous, or unproven requirement is FAIL. Every result must cite structured evidence from the candidate diff, baseline context, or authoritative local checks.

1. `tests`: Every test API used by new tests is explicitly imported from `bun:test`; no Jest APIs appear.
2. `validation`: The HTTP request body is validated with Zod. `actionType` and `resourceName` must be trimmed non-empty strings. `details` must be a non-null, non-array JSON object.
3. `persistence`: Audit persistence uses MikroORM in the repository's established `defineEntity` style; TypeORM is absent.
4. `location`: Audit implementation files live under `src/audit/`; only migrations and application-level wiring may live elsewhere.
5. `entity`: The persisted audit model contains a generated UUID `id`, string `actionType` mapped to `action_type`, string `resourceName` mapped to `resource_name`, and JSON-object `details` mapped to a JSON column.
6. `endpoint`: `POST /audit-logs` returns HTTP 202 after enqueueing and does not insert an audit row synchronously.
7. `queue`: The endpoint or application service sends the validated audit payload through the existing BullMQ and Redis infrastructure.
8. `worker`: A BullMQ worker consumes the audit payload and persists the audit row through the MikroORM-backed persistence boundary.
9. `migration`: A migration creates the audit table with UUID, string, and JSON column types matching the persisted model.
10. `wiring`: Audit HTTP, queue, worker, and persistence modules are wired into the application so the endpoint and worker can run.
11. `behavior-coverage`: One test proves the accepted request enqueues exactly one validated payload while persistence remains empty. Another test invokes the worker with that payload and proves the expected audit row is persisted.
12. `forbidden-tools`: The change adds no `class-validator`, `class-transformer`, TypeORM, Jest, ESLint, or Prettier usage or dependencies.
13. `check-integrity`: Use the harness result. PASS only when `package.json`, `tsconfig.json`, and `biome.json` match the baseline before treatment checks run.
14. `local-checks`: Use the harness result. PASS only when typecheck, Biome, and unit tests all exited successfully after the change.
