---
id: ACT-42
title: 'say which baseline condition changed, instead of one message for three'
status: Done
assignee: []
created_date: '2026-09-04 02:13'
updated_date: '2026-09-06 01:18'
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
- [x] #1 A stage refused for a dirty worktree reports the changed paths
- [x] #2 A stage refused for the wrong branch reports the branch it found and the one it expected
- [x] #3 A stage refused for a moved HEAD reports both shas
- [x] #4 The stage judge's harness-failure evidence carries that detail, so a judge never has to infer which condition occurred
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-05: premise re-verified at HEAD. The two raise sites are now at target.ts:223 and :257 (were 214/248), moved by intervening commits; same two sites, same message, unchanged in substance.

Triage 2026-09-06: closed as overtaken. ACT-72 (Done, commit ed10c54, 2026-09-05) rewrote both raise sites in target.ts to name the failing condition and its detail: describeBranchDrift for the branch case, a commit-mismatch message naming both SHAs, describeDirtyWorktree listing the offending paths. Verified directly against target.ts:208-299 this run; all four of ACT-42's own acceptance criteria are met by that code as it stands. ACT-42 was last updated 2026-09-04 23:01, before ACT-72 existed, and was never re-checked against it.
<!-- SECTION:NOTES:END -->
