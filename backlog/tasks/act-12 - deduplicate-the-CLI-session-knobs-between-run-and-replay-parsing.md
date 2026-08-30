---
id: ACT-12
title: deduplicate the CLI session knobs between run and replay parsing
status: To Do
assignee: []
created_date: '2026-08-30 21:27'
labels: []
dependencies: []
type: task
ordinal: 4008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ACT-3 added parseReplayArgs beside parseArgs in src/benchmark/config.ts. The model, effort, judge-model, judge-effort, and session-budget flags, their BENCHMARK_* environment fallbacks, and the budget validation are now written twice; a change to any knob must be made in two places. Extract the shared session-knob parsing into one helper both parsers call. Blocked until the parallel tsconfig/oxlint hardening session has finished editing config.ts; do it after that lands to avoid conflicting edits.
<!-- SECTION:DESCRIPTION:END -->
