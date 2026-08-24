# Asynchronous Audit Log Product Brief

Clients submit audit events through `POST /audit-logs`. An accepted request returns HTTP 202 after enqueueing the event; the request path must not persist the audit row directly.

Each event contains `actionType` and `resourceName` as trimmed, non-empty strings. `details` is a non-null JSON object, not an array. The background worker stores the event with a generated ID.

This task adds event submission only. It does not add audit querying, retention controls, authentication policy, replay, batching, or delivery guarantees beyond the repository's existing queue behavior.
