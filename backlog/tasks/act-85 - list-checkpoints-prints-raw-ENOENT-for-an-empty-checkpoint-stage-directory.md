---
id: ACT-85
title: list checkpoints prints raw ENOENT for an empty checkpoint stage directory
status: Done
assignee: []
created_date: '2026-09-05 22:43'
updated_date: '2026-09-05 23:08'
labels: []
dependencies: []
ordinal: 81008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Same defect class as ACT-40, one lister over: listCheckpoints in src/cli/list-command.ts calls Bun.file(checkpointRecordFile(...)).text() with no existence check, so a checkpoint stage directory holding no checkpoint.json throws a raw ENOENT that reaches the operator verbatim, the same way listAttempts did before ACT-40. Found while building ACT-40's redaction test: a synthetic empty stage directory (via a new writeEmptyCheckpointDirectory fixture) reproduced it directly; not yet confirmed against a real checkout. Fix shape is the same as ACT-40's: check existence first, throw a plain 'incomplete' reason routed through collect's existing unreadable path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 rehearsal list checkpoints on a checkout holding a checkpoint stage directory with no checkpoint.json prints no raw ENOENT
- [x] #2 the missing-checkpoint case is reported as incomplete through the existing unreadable-record path, matching ACT-40's decision for attempts
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Review (2026-09-06): six axes dispatched (Spec, Style, Architecture, Security, Testing, Refactoring). Suite run once: 1005 pass, 48 fail, all 48 in src/cli/rehearsal-cli.test.ts, confirmed pre-existing by checking out the parent commit (22bcc89^) and re-running: same 48 failures, unrelated to this diff's files.

Findings:
- Should-fix, verified by four axes (Style, Architecture, Spec, Refactoring) independently: writeEmptyCheckpointDirectory's doc comment in src/benchmark/run-records-test-support.ts still claimed the checkpoint lister throws a raw ENOENT naming the file's path, true before this fix and false after it. Fixed and committed (0dd184d): restates that the lister now reports it as incomplete rather than reading it. Verified: bun test src/cli/list-command.test.ts (26 pass), typecheck, lint, fmt:check all clean.
- Note (Testing): writeStoppedRunWithoutManifest repeats the 8-line stop-record JSON literal already in writeStoppedRun (Test Code Duplication, 03-test-aesthetics.md). Two sites, below the threshold for extracting a helper. No action taken.
- Note (Refactoring): listRuns's manifest read (loadRunManifest, no existence check) still throws a raw ENOENT naming a path, same defect class as ACT-40/ACT-85 but in a different lister. Out of scope for this ticket; the relocated redaction test in this diff now depends on that same unguarded read. Worth its own card if the pattern is to be closed everywhere.

Both acceptance criteria confirmed present by the Spec reviewer, each with a passing test citation, verified by reverting the production fix and re-running (the incomplete-reason test fails pre-fix with the raw ENOENT, passes post-fix; the stderr-naming test passes either way, pinning collect's pre-existing contract). Security and Testing axes: nothing blocking.
<!-- SECTION:NOTES:END -->
