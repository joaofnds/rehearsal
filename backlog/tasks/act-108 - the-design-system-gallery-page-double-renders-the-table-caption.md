---
id: ACT-108
title: the design-system gallery page double-renders the table caption
status: To Do
assignee: []
created_date: '2026-09-07 21:43'
updated_date: '2026-09-09 16:22'
labels:
  - bug
dependencies: []
priority: low
ordinal: 104008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
system-page.tsx's TableShell demo shows SectionLabel>TABLE SHELL immediately above TableShell caption="DURABLE RECORDS": the same double-caption bug ACT-53's commit 19024c2 fixed on the run-history screen, unfixed here since it's a different screen. TableShell renders its own <caption>, so the SectionLabel above it is a second, redundant label.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The gallery's TableShell section shows one visible label for the table, not two
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: implementation. Priority: low. The internal gallery visibly duplicates the table label; the fix is independent and tiny.

Evidence: system-page.tsx renders SectionLabel TABLE SHELL immediately above TableShell, which renders its own caption.

Unresolved claims/resources: None for the next action.

Next action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Remove the redundant visible label and keep one accessible table caption.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
