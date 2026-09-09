---
id: ACT-141
title: >-
  hold a live corpus source to a declared extent, so a symlinked CLAUDE.md out
  of the tree is refused
status: To Do
assignee: []
created_date: '2026-09-09 15:40'
updated_date: '2026-09-09 15:40'
labels: []
dependencies: []
documentation:
  - backlog/docs/doc-58 - Shaping-ACT-137-live-corpus-containment.md
type: bug
ordinal: 137008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 corpusReport under a live source, on a root whose CLAUDE.md is a symlink resolving outside both the install root and the declared extent, returns a refusal naming CLAUDE.md and no digest (ACT-137 AC#1, left unchecked there because it needs the extent; reproduced 2026-09-09 on ACT-137: live source returned digest over files [CLAUDE.md, skills/build/SKILL.md] with zero refusals)
- [ ] #2 corpusReport(liveCorpusSource()) on this machine still returns 122 files, digest c7000b, and zero refusals (measured 2026-09-09 on ACT-137 by running corpusReport against the live install)
- [ ] #3 GET /api/corpus on that hostile live root returns 200 carrying the refusal, never a 500 (ACT-135 AC#7 exists to eliminate the 500; src/server/api.ts wraps the route in no try/catch, read 2026-09-09)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split out of ACT-137's build, 2026-09-09. ACT-137 shipped the directory-source half: the instruction file's hash now sits inside the same try/catch the layout loop uses, so a SymlinkedEntryError on CLAUDE.md becomes a named refusal in a 200 report instead of a 500.

This card carries what ACT-137 could not deliver, its AC#1: the same refusal under a LIVE source. That half needs the declared extent, which ACT-137's card records as decided (the live install root plus the real path of the tree its layout entries point into, read as configuration from outside the corpus root, defaulting to [~/.claude, ~/.agents] on this machine). Nothing implements it yet.

Why it could not ship inside ACT-137: refuseUncontained returns early for kind === 'live' (src/benchmark/corpus-file.ts). Removing that exemption with no extent empties every live report, because the operator's own CLAUDE.md is a symlink into ~/.agents. Measured this session by running corpusReport against the live install: 122 files, digest c7000b, zero refusals. That number is the regression guard, and it is why the exemption cannot simply be deleted.

Doc-58 counted the consumers any change to live containment reaches. Read that section before starting; the calibration.ts call site is synchronous, so making liveCorpusSource() async breaks it.

The symlinked-layout-directory half of the same defect is ACT-134, which depends on ACT-137 and reads the same predicate. ACT-134 and this card are the same question asked on two call paths: this one goes through refuseUncontained, ACT-134's goes through walkDirectory's rootMayBeALink.
<!-- SECTION:NOTES:END -->
