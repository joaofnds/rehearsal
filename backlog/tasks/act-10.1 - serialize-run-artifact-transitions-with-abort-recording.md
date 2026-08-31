---
id: ACT-10.1
title: serialize run artifact transitions with abort recording
status: To Do
assignee: []
created_date: '2026-08-31 13:50'
labels: []
dependencies: []
parent_task_id: ACT-10
type: bug
ordinal: 13008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A signal can interleave with normal stage or final-artifact writes because run orchestration writes files directly while run-abort reads pending state separately. If interruption arrives during AWAITING_STAGE_JUDGE, AWAITING_HUMAN_REVIEW, or COMPLETE persistence, concurrent normal and FAILED writes can leave the terminal status dependent on write completion order. Independent ACT-10 review found this pre-existing correctness defect; ACT-10 extracted but did not introduce it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A controlled persistence test interrupts during a pending-stage write and observes a deterministic STAGE_JUDGE_FAILED record after all writers settle.
- [ ] #2 A controlled persistence test interrupts during AWAITING_HUMAN_REVIEW and COMPLETE writes and observes the main artifact ends FAILED after all writers settle.
- [ ] #3 Normal state transitions and abort writes share one serialized boundary; pending state is set before its write starts and cleared only after its terminal write succeeds.
<!-- AC:END -->
