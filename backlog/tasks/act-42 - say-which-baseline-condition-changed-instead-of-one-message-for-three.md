---
id: ACT-42
title: 'say which baseline condition changed, instead of one message for three'
status: To Do
assignee: []
created_date: '2026-09-04 02:13'
labels: []
milestone: m-1
dependencies: []
priority: medium
ordinal: 44008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
src/benchmark/target.ts raises StageValidationError('Target baseline changed unexpectedly') from two functions and three distinct conditions: the branch is not the expected one, the worktree is dirty, or HEAD moved when it should not have. The message names none of them and carries no paths.

That string is the entire harnessFailure field handed to the stage judge. Observed 2026-09-04 in ACT-38's run: the shape stage left GLOSSARY.md uncommitted, the harness refused it with this message, and the judge, unable to tell which condition fired, wrote 'the stage did not leave a valid repository state' and raised the invalid-stage-delivery hard blocker on that inference. The operator cannot tell either without reading the source.

The refusal itself is correct. The reporting is not: a judge grading a stage on a harness failure should be told what actually failed, and so should the person reading the record.

Reproduce by running any pipeline stage that leaves an uncommitted file, or by reading the two raise sites: 214:		throw new StageValidationError("Target baseline changed unexpectedly");
248:		throw new StageValidationError("Target baseline changed unexpectedly");.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A stage refused for a dirty worktree reports the changed paths
- [ ] #2 A stage refused for the wrong branch reports the branch it found and the one it expected
- [ ] #3 A stage refused for a moved HEAD reports both shas
- [ ] #4 The stage judge's harness-failure evidence carries that detail, so a judge never has to infer which condition occurred
<!-- AC:END -->
