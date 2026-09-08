---
id: ACT-128
title: >-
  session-corpus refuseSymlinks states a false reason: cp preserves symlinks, it
  does not dereference them
status: To Do
assignee: []
created_date: '2026-09-08 22:24'
labels: []
dependencies: []
ordinal: 124008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 the doc comment above refuseSymlinks states a reason that matches observed cp behavior, verified by a probe named in the commit body
- [ ] #2 any other comment in the codebase claiming a recursive copy dereferences symlinks is corrected or removed (session-attempt.ts:219 and session-corpus.test.ts:124 use similar wording and are checked)
<!-- AC:END -->
