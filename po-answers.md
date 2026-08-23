# Product Answers

- Use the repository's existing BullMQ and Redis setup.
- Keep the feature under `src/audit/`, except for the migration and application-module wiring.
- Expose `POST /audit-logs`. Accept trimmed non-empty `actionType` and `resourceName` strings plus a non-null, non-array JSON-object `details` value; return HTTP 202 after enqueueing the job.
- Validate the request body with Zod. The request path must enqueue only and must not write the audit row directly.
- Persist the row from a BullMQ worker. Store a generated UUID `id`, map `actionType` to `action_type`, map `resourceName` to `resource_name`, and store `details` in a JSON column.
- Create a migration for the audit table.
- Add focused tests proving the accepted request enqueues exactly one validated payload while persistence remains empty, then proving the worker persists the expected row from that payload.
- Wire the feature into the application by following the existing module structure under `src/user/`.
- For any question not resolved above, follow the existing repository pattern and choose the smallest implementation that satisfies the task.
