---
id: ACT-108
title: the design-system gallery page double-renders the table caption
status: To Do
assignee: []
created_date: '2026-09-07 21:43'
labels:
  - bug
dependencies: []
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
