---
id: ACT-152
title: >-
  bring the operator runbook in line with shipped preflight and recorded-run
  behavior
status: To Do
assignee: []
created_date: '2026-09-09 16:15'
updated_date: '2026-09-09 16:22'
labels: []
milestone: m-2
dependencies: []
documentation:
  - backlog/docs/doc-61 - Triage-rehearsal-backlog.md
priority: medium
ordinal: 148008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
docs/runbook.md still instructs a reader that target readiness is unchecked, stopped runs are invisible, and the harness installs its own project instructions into the target. ACT-45, ACT-44 and ACT-41 delivered those behaviors; current preflight and list/read paths confirm them. The runbook also hardcodes a local target path and an old case count. Correct this existing operator guide from current commands before a second person follows obsolete workarounds. Keep observed historical run costs explicitly dated and distinguish residual limitations from resolved incidents. The separate ACT-84 owns Bun entry-point enforcement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The guide describes current preflight checks and stopped-run discovery and removes workarounds for resolved ACT-41, ACT-44 and ACT-45 defects (docs/runbook.md sections 3-4 and What is not yet true; completed cards and current source inspected in triage)
- [ ] #2 The guide discovers case targets and available cases through current declarations/commands instead of requiring the original operator’s absolute path or an undated count (docs/runbook.md current hardcoded path/count; ACT-34 portable target outcome)
- [ ] #3 Every documented read-only command is checked against the current CLI, and paid examples keep explicit cost and prerequisite information (project CLAUDE.md command convention; docs/runbook.md purpose)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: implementation. Priority: medium. The operator guide directs readers around already fixed defects and to one operator’s target path.

Evidence: Read docs/runbook.md against completed ACT-41/44/45 and current preflight/list code.

Unresolved claims/resources: Read-only verification available; paid examples are documentation only.

Next action: Correct the current operator guide and verify its read-only commands against the CLI.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
