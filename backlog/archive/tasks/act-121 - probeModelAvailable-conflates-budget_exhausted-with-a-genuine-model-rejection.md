---
id: ACT-121
title: probeModelAvailable conflates budget_exhausted with a genuine model rejection
status: To Do
assignee: []
created_date: '2026-09-08 15:09'
updated_date: '2026-09-09 16:21'
labels: []
dependencies: []
priority: medium
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Checked against the code this run, and the card is half stale. MODEL_PROBE_BUDGET_USD in src/benchmark/preflight.ts is already 0.1, raised from the 0.02 ceiling that produced the observed misreport, and the comment above it records that history. So the specific incident the card was filed from cannot recur at the same threshold.

The defect the criteria name is still real. probeModelAvailable relabels any bare Error from readClaudeEnvelope as 'Model <m> is not available', with no branch distinguishing a budget_exhausted terminal_reason from a genuine model rejection. A budget exhausted at any ceiling still reads as an unavailable model, so AC#1 and AC#2 remain unmet.

Medium, not High: the raised ceiling removed the routine trigger, so the wrong message now needs an unusual spend to appear, and it misleads rather than corrupting anything. Not Low, because the message sends the reader to re-declare a model when the real cause is money, which is a diagnosis this harness exists to get right.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: merge; next action: implementation. Priority: medium. It is an exact duplicate of ACT-117's only remaining outcome.

Evidence: Both cards name probeModelAvailable, terminal_reason budget_exhausted, distinct rejection messaging and the same missing test.

Unresolved claims/resources: merge into ACT-117

Next action: Move its typed-terminal-reason and test requirements to ACT-117, then archive it.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
