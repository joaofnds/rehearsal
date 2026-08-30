---
id: ACT-13
title: split run-benchmark.test.ts into per-module test files
status: To Do
assignee: []
created_date: '2026-08-30 21:27'
labels: []
dependencies: []
type: task
ordinal: 5008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The single test file is over 4000 lines and covers every module in src/benchmark. ACT-3 had to append about 800 lines and coordinate string-level edits with a parallel session in the same file; two sessions editing one test file is now the normal case and the file is the contention point. Split it into one test file per module (bun test picks up *.test.ts anywhere), keeping the shared repository fixtures in a helpers module. Behavior-preserving; the suite must stay green through the split.
<!-- SECTION:DESCRIPTION:END -->
