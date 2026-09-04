---
id: ACT-61
title: record the project half of the context manifest
status: To Do
assignee: []
created_date: '2026-09-04 15:11'
updated_date: '2026-09-04 15:11'
labels: []
dependencies:
  - ACT-41
  - ACT-59
documentation:
  - backlog/docs/doc-9 - context-manifest-design.md
priority: medium
ordinal: 58008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The corpus half of what an agent loads is the engineer's global instruction set, varied by --corpus. The project half is the target repository's own instructions and documents: its CLAUDE.md or AGENTS.md, its GLOSSARY.md, and the documents a stage reads off a card. Nothing records them today.

These are a property of the target, not of the corpus. They vary per case, not per corpus arm. Conflating them would let a corpus A/B silently change the target's documents too, which would make every such comparison uninterpretable.

Depends on ACT-41. That card establishes exactly this corpus/project separation for CLAUDE.md, and it deletes the code that installs the control repository's project file into the target. Building project-context tracking on top of the current conflation would bake the conflation in.

Depends on ACT-59 for the observation mechanism: the manifest is where a project-half entry lands, and the reconciliation machinery is the same.

Open question this card must answer rather than assume: whether a case declares its project context explicitly, the way it declares corpus files, or whether the harness discovers it from the target tree. Explicit declaration is checkable but goes stale against a target that changes; discovery is always current but cannot tell a document the stage read from one that happened to be present.

Design: backlog/docs/doc-9 - context-manifest-design.md
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An attempt record's context manifest names the target's own instruction file, or records that the target carries none
- [ ] #2 The manifest distinguishes corpus-half entries from project-half entries, so a reader can tell which vary with --corpus
- [ ] #3 A document a stage read off its card appears in the manifest, named by its target-relative path
- [ ] #4 The decision between declared and discovered project context is recorded on this card with its reason
<!-- AC:END -->
