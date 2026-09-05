---
id: ACT-77
title: 'a failed workflow stage reports no reason, so a broken run cannot be diagnosed'
status: Done
assignee: []
created_date: '2026-09-05 03:27'
updated_date: '2026-09-05 03:27'
labels: []
dependencies: []
type: bug
ordinal: 73008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WorkflowExecutionError's message was the fixed string 'Worker execution failed'. The real reason was passed as the error's cause and never printed anywhere, so an operator watching a run see a stage die with no way to tell a timeout from a crash from a bad invocation.

Found 2026-09-05 while running the audit-log case to produce evidence for ACT-43. The build stage died after three exchanges printing only 'Worker execution failed' twice. The turn cap is 20 and the session budget throw is raised outside the try block with its own distinct message, so neither explains it, and the actual reason was unrecoverable from the output.

Reproduced directly by constructing the error with a known cause and reading its message: the cause was discarded.

Fixed by carrying the cause into the message. Verified by observing the constructed error report 'Worker execution failed: claude exited with code 143', and a non-Error cause stringify rather than throw. Full checks pass: 1015 tests, typecheck, oxlint, oxfmt.

The pipeline-confirmation test that pinned the old fixed string now pins the reason, which proves it reaches a confirmation rep record and not only the exception.

Not fixed here: whatever actually killed that audit-log build stage. This card makes the next occurrence diagnosable rather than explaining that one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A workflow stage failure reports the underlying reason in the message an operator reads, not a fixed string
- [x] #2 A confirmation rep record's stage error carries that reason too
<!-- AC:END -->
