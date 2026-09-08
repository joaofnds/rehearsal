---
id: ACT-128
title: >-
  session-corpus refuseSymlinks states a false reason: cp preserves symlinks, it
  does not dereference them
status: To Do
assignee: []
created_date: '2026-09-08 22:24'
updated_date: '2026-09-08 23:16'
labels: []
dependencies: []
priority: medium
ordinal: 124008
---

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
<!-- SECTION:NOTES:END -->
