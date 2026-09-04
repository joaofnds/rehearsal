---
id: ACT-60
title: carry rules/ in the corpus layout
status: To Do
assignee: []
created_date: '2026-09-04 15:11'
updated_date: '2026-09-04 15:11'
labels: []
dependencies:
  - ACT-59
documentation:
  - backlog/docs/doc-9 - context-manifest-design.md
priority: medium
ordinal: 57008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CORPUS_LAYOUT_PREFIXES in src/benchmark/corpus-file.ts is output-styles/, agents/, skills/, plus the CLAUDE.md special case. A real session on this machine also loads ~/.agents/rules/, which is part of the engineer's global instruction set and varies with --corpus like every other corpus kind.

Today a case cannot declare a rule file, so a corpus A/B that changes a rule measures nothing: the bytes change, no case names them, no lineage hashes them, and no checkpoint goes stale.

Verified 2026-09-04: ls ~/.agents/ shows AGENTS.md, agents, backlog-config.yml, rules, skills. The corpus layout reaches agents and skills and not rules.

Ordered after ACT-59 deliberately. The manifest is what reports 'the session loaded a rule this case never declared', which is the evidence for which kinds are missing and whether rules/ is the only one. Doing this first would be guessing at the list.

Note the distinction this card must not blur: rules/ is corpus, varying per corpus arm. The target repository's own instructions and documents are project context, varying per case, and belong to the project-half card.

Design: backlog/docs/doc-9 - context-manifest-design.md
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A case can declare a corpus file under rules/ and it resolves against every corpus source kind
- [ ] #2 A declared rule file is hashed into the attempt record's corpus digests before any provider call
- [ ] #3 An edit to a rule file the corpus carries makes a checkpoint that consumed it stale, shown by rehearsal stale
- [ ] #4 A corpus source holding only rules/ is accepted as a corpus rather than refused as holding no layout entry
<!-- AC:END -->
