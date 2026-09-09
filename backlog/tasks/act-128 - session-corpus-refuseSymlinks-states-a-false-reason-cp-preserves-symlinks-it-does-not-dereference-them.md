---
id: ACT-128
title: >-
  session-corpus refuseSymlinks states a false reason: cp preserves symlinks, it
  does not dereference them
status: To Do
assignee: []
created_date: '2026-09-08 22:24'
updated_date: '2026-09-09 16:21'
labels: []
dependencies: []
priority: low
ordinal: 124008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Correct the false recursive-copy rationale while retaining symlink refusal because preserved links escape the snapshot.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 the doc comment above refuseSymlinks states a reason that matches observed cp behavior, verified by a probe named in the commit body
- [ ] #2 any other comment in the codebase claiming a recursive copy dereferences symlinks is corrected or removed (session-attempt.ts:219 and session-corpus.test.ts:124 use similar wording and are checked)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-09: premise verified, and the fix is now unambiguous. Probed directly this run on darwin 25.6.0:

  cp -R src out/copied    => link.txt stayed a symlink to /tmp/cpprobe/outside.txt
  node fs.cpSync(recursive)=> link.txt stayed a symlink

Both preserve. So the comment at session-corpus.ts:108-112 ('A recursive copy dereferences') is false as the card states, and session-corpus.test.ts:124's comment repeats the same false wording. session-attempt.ts:219 already says 'A recursive copy preserves symlinks', which is correct and is the wording the other two should match.

That changes the refusal's justification but not the refusal: a preserved symlink still gives the session a live path out of the tree, which is exactly the reason session-attempt.ts states. The guard is right for the reason session-attempt gives, not the one session-corpus gives.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: implementation. Priority: low. The comments are false but runtime refusal remains correct.

Evidence: session-corpus.ts and its test say recursive copy dereferences; session-attempt.ts correctly says it preserves symlinks.

Unresolved claims/resources: None for the next action.

Next action: Reconsider after the m-7 comparison is read, or when this behavior blocks a selected card. Then Correct the two comments using the recorded cp and cpSync probe; make no behavior change.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
