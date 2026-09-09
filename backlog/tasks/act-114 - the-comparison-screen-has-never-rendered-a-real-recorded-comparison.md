---
id: ACT-114
title: the comparison screen has never rendered a real recorded comparison
status: To Do
assignee: []
created_date: '2026-09-08 01:46'
updated_date: '2026-09-09 16:22'
labels: []
milestone: m-7
dependencies:
  - ACT-69
priority: medium
type: chore
ordinal: 110008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Open the comparison UI against a report produced by the real comparison command and verify every principal region renders from disk evidence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The comparison screen is opened in a browser against a comparison recorded on disk, not a fixture, and the arm bands, case rows, contrast columns and attribution card are confirmed to render from it (source: ACT-50's reflection, doc-37; verified 2026-09-08 that .benchmark-runs/comparisons is empty, so every check on that screen so far used fixtures or the not-found path)
- [x] #2 The reason this checkout lacks a comparison report is recorded from the completed ACT-39 record and current group/report inventory, with the remaining producer/reader prerequisites named (doc-37 investigation request; ACT-69 and doc-61 verification)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The card's premise is confirmed by direct inspection this run, which prior runs had only inferred: .benchmark-runs/comparisons/ exists and is empty. So no comparison record exists on this checkout, and the screen has never had one to render. That is AC#2's question and it now has evidence behind it rather than an assumption.

Consequence for ACT-50: its AC#14 asks for the What moved tab observed in a browser against a recorded comparison, and no such record exists, so AC#14 cannot be checked until this card produces one. Recorded on ACT-50 as well. No dependency added, because ACT-50's other criterion can be built without a record and only its observation waits.

Criteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.

Settled investigation: ACT-39 compared one replay pair by reading the records and split full report production to ACT-69. Current list groups/list comparisons are empty. ACT-69 now waits on ACT-140 and ACT-151; browser verification waits for its actual report. AC#2 is checked on this evidence.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: implementation. Priority: medium. A real-record browser smoke test is required for m-7, but the evidence it needs does not exist on this checkout.

Evidence: .benchmark-runs/comparisons is empty and no comparison manifest exists. ACT-39 manually compared one replay pair; full compare was split to ACT-69.

Unresolved claims/resources: ACT-69 or equivalent real three-arm, multi-case comparison evidence.

Next action: Wait for ACT-69. Then Add ACT-69 as dependency and replace AC2 with the settled history; once a report exists, run the browser acceptance.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
