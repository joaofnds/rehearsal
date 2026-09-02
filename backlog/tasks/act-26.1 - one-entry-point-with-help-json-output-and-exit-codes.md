---
id: ACT-26.1
title: 'one entry point with help, json output, and exit codes'
status: To Do
assignee: []
created_date: '2026-09-02 15:14'
labels: []
dependencies: []
references:
  - backlog/docs/doc-1 - agent-cli-exploration.md
parent_task_id: ACT-26
type: feature
ordinal: 22008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today three scripts (bun run benchmark, replay, compare) parse three flag dialects, print "Invalid argument sequence" for an unknown flag, and have no help. Replace them with one executable, rehearsal <command>, keeping every existing flag and environment fallback. Every command: --help that states each flag, default, and environment variable; --json that prints the strict record the command wrote (the same zod-validated artifact, never a second shape); stdout carries data only and stderr diagnostics; exit 0 when the command completed and its record was written, whatever the grade, non-zero for usage errors, refused preconditions, and execution failures. No prompt without a flag alternative; when stdin is not a TTY and the flag is absent, refuse before any paid work. The README's running section documents the new names.

Why: an agent reads help instead of docs, parses JSON instead of prose, and cannot answer a readline prompt. Gaps 4, 5, 6, and 7 in doc-1.
<!-- SECTION:DESCRIPTION:END -->
