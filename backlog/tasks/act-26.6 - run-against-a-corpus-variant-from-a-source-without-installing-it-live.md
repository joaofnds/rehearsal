---
id: ACT-26.6
title: run against a corpus variant from a source without installing it live
status: To Do
assignee: []
created_date: '2026-09-02 15:14'
updated_date: '2026-09-02 15:25'
labels: []
dependencies: []
references:
  - backlog/docs/doc-1 - agent-cli-exploration.md
parent_task_id: ACT-26
type: feature
ordinal: 27008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today the corpus under test is the live install: CLAUDE.md at the control root plus ~/.claude/skills. Testing a dotfiles edit means chezmoi apply, which takes effect in every running session; the workarounds (unmanaged variant files, per-session --settings and --agents overrides) cover styles and agents but not skills or CLAUDE.md. Add --corpus <source> to run and replay: a directory holding the corpus layout, or a chezmoi source at a git ref, rendered into a scratch destination (chezmoi apply --destination is present on v2.72.0; rendering into a scratch directory is inferred and must be observed first). The run snapshots that corpus, records it as the corpus snapshot in lineage, and gives the session a config that carries it without touching the live one. Absent --corpus, today's behavior stands. rehearsal stale --corpus <source> (ACT-26.2) reads the same source.

Open for João in doc-1: whether the session's config is a copy of the live one with only the files under test replaced (recommended, keeps hooks, memory, and MCP as the README requires) or a scratch config. Gap 3 in doc-1.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decided 2026-09-02: the session's config is a copy of the live config with only the files under test replaced, never a scratch config. Shape observes whether a copied config carries login state.
<!-- SECTION:NOTES:END -->
