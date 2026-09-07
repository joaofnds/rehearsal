---
id: ACT-95
title: >-
  stale does not hash a pipeline checkpoint's settings file, so a settings-only
  edit reports fresh
status: To Do
assignee: []
created_date: '2026-09-07 16:24'
updated_date: '2026-09-07 16:24'
labels: []
dependencies: []
priority: medium
type: bug
ordinal: 91008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A pipeline checkpoint whose stage settings file changed since it was recorded is reported stale by rehearsal stale, the same way a corpus edit is reported stale today
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Filed from ACT-37's own reflection (doc-29, 2026-09-07): its handoff names this gap outside its four acceptance criteria. No milestone; independent of ACT-37 (Done) and ACT-59/60 (m-3, different corpus kind).
<!-- SECTION:NOTES:END -->
