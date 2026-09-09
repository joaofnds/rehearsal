---
id: ACT-117
title: distinguish model-probe budget exhaustion from model rejection
status: To Do
assignee: []
created_date: '2026-09-08 11:23'
updated_date: '2026-09-09 16:21'
labels: []
milestone: m-3
dependencies: []
priority: medium
ordinal: 113008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The model preflight ceiling is already USD 0.1, with its cold-cache measurement recorded beside MODEL_PROBE_BUDGET_USD. The remaining defect is classification: readClaudeEnvelope throws a bare error and probeModelAvailable relabels budget_exhausted as an unavailable model. Preserve the ceiling’s measured headroom, report exhausted budget with cost/cap, and retain a separate genuine-rejection diagnostic. ACT-121 is absorbed here without retiring requirements.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A model probe ending with terminal_reason budget_exhausted reports budget exhaustion, with its reported cost and configured cap, while a genuine model rejection reports a distinct availability diagnostic (ACT-117 original measured cold-cache incident; ACT-121 AC1, absorbed in doc-61)
- [x] #2 The probe budget has headroom over the recorded cold-cache completion, with that measurement recorded beside the configured ceiling (ACT-117 original AC2; preflight.ts MODEL_PROBE_BUDGET_USD comment and commit a98bcc7)
- [ ] #3 A regression test exercises a budget_exhausted envelope and verifies it is not reported as model unavailable (ACT-121 AC2, absorbed in doc-61)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-08 (d): AC#2 is done, narrowing the remaining scope to AC#1. Commit a98bcc7 (2026-09-08, same day as filing) widened MODEL_PROBE_BUDGET_USD from $0.02 to $0.1 (src/benchmark/preflight.ts:62), citing this card's own $0.021876 measurement. Verified 2026-09-08: the constant reads 0.1 on disk. AC#1 (telling budget_exhausted apart from a genuine rejection) is still open: readClaudeEnvelope (src/benchmark/claude.ts:68-71) still throws a bare Error regardless of cause, and probeModelAvailable (preflight.ts:112-127) still relabels any bare Error as an entitlement problem. Remaining work is AC#1 only.

Criteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.

Title changed by triage from “the model preflight probe fails on a normal-cost completion” to “distinguish model-probe budget exhaustion from model rejection”; the filename retains the old title.

Merge accounting: ACT-121 AC1 is carried in current AC1; ACT-121 AC2 is current AC3. Original ACT-117 AC2 is preserved and checked from MODEL_PROBE_BUDGET_USD=0.1 plus its measured cold-cache comment. No source requirement is retired. ACT-121 is archived with this survivor named.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: implementation. Priority: medium. Budget headroom is fixed, but budget exhaustion is still mislabeled as model rejection.

Evidence: MODEL_PROBE_BUDGET_USD is 0.1; readClaudeEnvelope throws a bare Error and probeModelAvailable relabels it; no budget_exhausted test exists.

Unresolved claims/resources: None for the next action.

Next action: Absorb ACT-121, type terminal_reason, branch budget exhaustion from rejection, and test both.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
