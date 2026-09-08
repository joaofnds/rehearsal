---
id: ACT-131
title: >-
  pipeline-confirmation peer-ordering test fails intermittently under the full
  suite
status: To Do
assignee: []
created_date: '2026-09-08 22:43'
updated_date: '2026-09-08 22:43'
labels: []
dependencies: []
ordinal: 127008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 the pipeline-confirmation suite passes on twenty consecutive full-suite runs, or its ordering assertion no longer depends on wall-clock interleaving (observed 2026-09-09: one full-suite run failed at pipeline-confirmation.test.ts:1028 while the file alone passed 18/18 and the next full run passed 1293/1293)
- [ ] #2 bun run test passes (the project own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Met while finishing ACT-113. Not caused by it: the failing file is untouched by that work, its last commit (cfe1a6e) predates it, and the same full suite passed 1293/1293 immediately before and after the failing run.

The test is 'lets pipeline peers finish and preserves only a pre-evidence failure'. It runs
concurrent peers and asserts on which finished, comparing a sorted completion list against
[1, 3] at line 1028. The reported diff was '+ Received + 0', so the list was short by an
element: a peer had not finished when the assertion ran. Under the full suite the machine
is loaded and the interleaving differs from running the file alone.

Ownership rule: a test that passes on one run and not another is a defect whoever wrote it.
Naming it here rather than leaving it, since a suite that fails once in a while teaches
everyone to re-run instead of read.
<!-- SECTION:NOTES:END -->
