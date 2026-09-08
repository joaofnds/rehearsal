---
id: ACT-117
title: the model preflight probe fails on a normal-cost completion
status: To Do
assignee: []
created_date: '2026-09-08 11:23'
updated_date: '2026-09-08 16:51'
labels: []
dependencies: []
priority: medium
ordinal: 113008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
probeModelAvailable (src/benchmark/preflight.ts:106) runs a throwaway 'hi' completion under a $0.02 cap (MODEL_PROBE_BUDGET_USD, :56) and reports any envelope error as 'Model <m> is not available: ... check your entitlement for it.'

Budget exhaustion is not an unavailable model, and the cap is close enough to normal cost to be hit. Measured 2026-09-08 against sonnet: three consecutive probes cost $0.0023, $0.0025 and $0.0020, but one earlier probe cost $0.0228 and returned terminal_reason 'budget_exhausted', which aborted a `rehearsal run --case manifest-probe --model sonnet` with the entitlement message. The expensive run's modelUsage showed 5308 cache-creation tokens against 2 input tokens; a cold cache is the likely cause, which makes this fire on the first run after idle rather than at random.

The message sends the reader to check entitlements for a model that works. Two things to fix: the cap wants headroom over a cold-cache completion, and terminal_reason 'budget_exhausted' wants to be told apart from a rejected model rather than relabeled as one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A probe whose completion exhausts its budget reports budget exhaustion, naming the cost and the cap, not an unavailable model
- [ ] #2 The probe budget has headroom over a cold-cache completion, shown by a recorded cost measurement in the code or its test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-08 (d): AC#2 is done, narrowing the remaining scope to AC#1. Commit a98bcc7 (2026-09-08, same day as filing) widened MODEL_PROBE_BUDGET_USD from $0.02 to $0.1 (src/benchmark/preflight.ts:62), citing this card's own $0.021876 measurement. Verified 2026-09-08: the constant reads 0.1 on disk. AC#1 (telling budget_exhausted apart from a genuine rejection) is still open: readClaudeEnvelope (src/benchmark/claude.ts:68-71) still throws a bare Error regardless of cause, and probeModelAvailable (preflight.ts:112-127) still relabels any bare Error as an entitlement problem. Remaining work is AC#1 only.
<!-- SECTION:NOTES:END -->
