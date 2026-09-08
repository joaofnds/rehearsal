---
id: ACT-113
title: >-
  hashDirectory follows symlinks, letting a planted link expose a file outside
  the corpus layout
status: To Do
assignee: []
created_date: '2026-09-08 01:41'
labels: []
dependencies: []
priority: medium
ordinal: 109008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
hashDirectory (src/benchmark/checkpoint.ts:91-114), shared by the corpus screen (src/server/corpus-report.ts) and by captureStageCorpus/snapshotStageCorpus/session-lineage.ts, calls readdir(root, {recursive:true}) then stat (not lstat) on every entry, with no realpath containment check. A symlink placed inside a walked directory (e.g. corpus-root/skills/evil -> /somewhere/else) is followed, and its target's files are read, hashed, and reported in the API response and digest under the symlink's relative path. Verified directly in ACT-50's post-review code review (security axis): a planted symlink under skills/ surfaced a file's real bytes and hash outside the corpus root.

This is not introduced by ACT-50; hashDirectory's symlink-following predates it. It undercuts the guarantee ACT-50's corpus-screen fix (commit bdd72a1) states it provides (secrets like daemon/control.key should no longer be walked, read, or exposed) for anything reachable via a symlink one level down from the walked directories.

Pre-req: read ~/.agents/rulebook/coding-style.md and doctrine.md's Security-adjacent guidance before designing the fix; decide whether hashDirectory should refuse a symlink outright, resolve+contain it via realpath against root, or something else, and confirm the decision against the other three callers, which may have different tolerance for symlinks in their own inputs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 hashDirectory (or its corpus-screen caller specifically, if a blanket change is unsafe for the other three callers) does not read, hash, or report the contents of a symlink target outside the directory being walked
- [ ] #2 a regression test plants a symlink inside a walked directory pointing outside the corpus root and asserts the target's path and content are absent from both the report and the digest
<!-- AC:END -->
