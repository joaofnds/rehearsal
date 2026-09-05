---
id: ACT-75
title: replay accepts a corpus source and passes --setting-sources project
status: To Do
assignee: []
created_date: '2026-09-05 01:07'
labels: []
dependencies: []
type: feature
ordinal: 71008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `rehearsal replay --corpus <directory>` runs the stage instead of refusing it
- [ ] #2 A stage session under a corpus source reports a marker planted in that corpus's skill and absent from the live install, observed once directly against a real claude invocation
- [ ] #3 The run's record names which corpus source produced it
<!-- AC:END -->
