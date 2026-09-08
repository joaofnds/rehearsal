---
id: ACT-60
title: carry rules/ in the corpus layout
status: To Do
assignee: []
created_date: '2026-09-04 15:11'
updated_date: '2026-09-08 16:52'
labels: []
milestone: m-3
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-07: assigned m-3, same basis as ACT-59/71.

Triage 2026-09-08 (d): stale premise. ~/.agents/rules/ no longer exists; verified 2026-09-08 that ls ~/.agents/ shows agents, rulebook, skills — rules/ was renamed/restructured to rulebook/ sometime after this card was filed (2026-09-04). The underlying gap (a corpus A/B that changes a rule file measures nothing) is unaffected, but every acceptance criterion names the rules/ prefix specifically. Whoever builds this must first re-verify what a real session loads today (rulebook/ contents, and whether AGENTS.md routes to it the way the card describes for the old rules/) before scoping the fix around a directory name that no longer matches disk.

Bet, 2026-09-08: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet.
<!-- SECTION:NOTES:END -->
