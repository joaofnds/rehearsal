---
id: ACT-121
title: probeModelAvailable conflates budget_exhausted with a genuine model rejection
status: To Do
assignee: []
created_date: '2026-09-08 15:09'
labels: []
dependencies: []
ordinal: 117008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
src/benchmark/preflight.ts's probeModelAvailable treats any is_error: true envelope from the claude CLI probe as 'model not available' and throws RefusedPreconditionError with that message. A real cold-cache probe call can legitimately exceed MODEL_PROBE_BUDGET_USD (measured $0.021876 against a $0.02 ceiling, fixed in commit a98bcc7 by widening to $0.1) and the CLI reports that as is_error: true with terminal_reason: "budget_exhausted" — the same signal shape as a genuine model rejection (e.g. terminal_reason absent, api_error_status 404). The widened $0.1 ceiling is a stopgap with margin, not a fix to the conflation: a colder cache, a longer MODEL_PROBE_BUDGET_PROMPT, or a future pricier model's cache-creation rate can still reproduce the same false 'model not available' rejection at a higher dollar figure.

Fix: read terminal_reason (already present in the raw claude CLI JSON output, currently parsed only via claudeEnvelopeSchema's .loose() catch-all with no typed field) in probeModelAvailable/readClaudeEnvelope, and give budget_exhausted its own distinct error path/message rather than folding it into the 'model unavailable, check entitlement' message.

Found by the Spec-axis reviewer during review-code on commit a98bcc7 (rehearsal, ACT-51's live-run verification session), 2026-09-08. Should-fix, not blocking: the $0.1 stopgap is real margin and closes the immediate false-rejection bug; this is the mechanism-level follow-up.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 probeModelAvailable distinguishes a budget_exhausted terminal_reason from a genuine model-rejection envelope, with a distinct error message for each
- [ ] #2 a test exercises the budget_exhausted path and asserts it does not read as 'model not available'
<!-- AC:END -->
