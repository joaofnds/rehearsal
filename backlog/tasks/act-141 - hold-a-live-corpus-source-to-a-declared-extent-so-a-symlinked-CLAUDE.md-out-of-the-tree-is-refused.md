---
id: ACT-141
title: >-
  hold a live corpus source to a declared extent, so a symlinked CLAUDE.md out
  of the tree is refused
status: Shape
assignee: []
created_date: '2026-09-09 15:40'
updated_date: '2026-09-09 16:26'
labels: []
dependencies: []
documentation:
  - backlog/docs/doc-58 - Shaping-ACT-137-live-corpus-containment.md
  - backlog/docs/doc-61 - Triage-rehearsal-backlog.md
priority: high
type: bug
ordinal: 137008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hold live corpus resolution to an extent declared outside the corpus root, allowing the configured backing tree while refusing paths beyond both trusted roots.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 corpusReport under a live source, on a root whose CLAUDE.md is a symlink resolving outside both the install root and the declared extent, returns a refusal naming CLAUDE.md and no digest (ACT-137 AC#1, left unchecked there because it needs the extent; reproduced 2026-09-09 on ACT-137: live source returned digest over files [CLAUDE.md, skills/build/SKILL.md] with zero refusals)
- [ ] #2 A controlled healthy live fixture with legitimate links into its declared backing tree retains the same file identities and zero refusals after the change; compare the actual local live file set before/after within one run without pinning a mutable digest (original live-report regression intent; decision-4; doc-60 and doc-61 stale-digest verification)
- [ ] #3 GET /api/corpus on that hostile live root returns 200 carrying the refusal, never a 500 (ACT-135 AC#7 exists to eliminate the 500; src/server/api.ts wraps the route in no try/catch, read 2026-09-09)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split out of ACT-137's build, 2026-09-09. ACT-137 shipped the directory-source half: the instruction file's hash now sits inside the same try/catch the layout loop uses, so a SymlinkedEntryError on CLAUDE.md becomes a named refusal in a 200 report instead of a 500.

This card carries what ACT-137 could not deliver, its AC#1: the same refusal under a LIVE source. That half needs the declared extent, which ACT-137's card records as decided (the live install root plus the real path of the tree its layout entries point into, read as configuration from outside the corpus root, defaulting to [~/.claude, ~/.agents] on this machine). Nothing implements it yet.

Why it could not ship inside ACT-137: refuseUncontained returns early for kind === 'live' (src/benchmark/corpus-file.ts). Removing that exemption with no extent empties every live report, because the operator's own CLAUDE.md is a symlink into ~/.agents. Measured this session by running corpusReport against the live install: 122 files, digest c7000b, zero refusals. That number is the regression guard, and it is why the exemption cannot simply be deleted.

Doc-58 counted the consumers any change to live containment reaches. Read that section before starting; the calibration.ts call site is synchronous, so making liveCorpusSource() async breaks it.

The symlinked-layout-directory half of the same defect is ACT-134, which depends on ACT-137 and reads the same predicate. ACT-134 and this card are the same question asked on two call paths: this one goes through refuseUncontained, ACT-134's goes through walkDirectory's rootMayBeALink.

AC#2 IS ALREADY STALE, confirmed by the overseeing iterate session, 2026-09-09, independently of the reflection that raised it.

AC#2 pins the live corpus at "122 files, digest c7000b, zero refusals". Measured on this machine after ACT-137 landed:

  files 122 digest 723012 refusals 0

The file count and the refusal count hold; the digest does not. It changed because the corpus itself changed, which is exactly what a live corpus does by design (decision-4: "enumerated and hashed as it is today"). So this criterion fails on a perfectly healthy system, and whoever builds this card meets a red check that indicates nothing wrong.

The intent behind AC#2 is sound and worth keeping: the fix must not empty the live report. The digest is the wrong instrument for it. Rewrite AC#2 as the behavior that survives a corpus edit, for instance: corpusReport(liveCorpusSource()) returns the same file count and zero refusals before and after the change, both measured in the same run. That is checkable under every approach this card leaves open, which a frozen digest is not.

Not rewriting it here, because this card is in To Do and its shaping session owns its criteria. Recorded so that session fixes it rather than inheriting it.

Criteria updated by triage from the current evidence and retained sources. Replaced wording is preserved in the recovery documents linked from doc-61. The original scope still applies except the explicitly corrected premise.

Current policy source: the ACT-137 note headed DECIDED BY THE OVERSEEING ITERATE SESSION takes the externally declared extent under the unattended rule and records its reading of decision-4. Doc-58’s earlier blocked heading is historical. Triage retains the recorded decision; configuration representation and propagation remain shaping work. ACT-134 already depends on this card.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: shaping. Priority: high. This establishes the live trust boundary and is the feasible prerequisite for the remaining layout-root containment hole.

Evidence: refuseUncontained returns early for kind live and CorpusRoot has no extent. Current live report is healthy at 122 files, digest 723012, zero refusals; the old c7000b digest is stale.

Unresolved claims/resources: None for the next action.

Next action: Shape external extent configuration and its propagation to synchronous live-source callers, using the settled declared-extent policy from ACT-137. Test a synthetic allowed backing tree and a hostile outside target. Then implement without provider spend.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).

CONFIRMED BY THE OPERATOR, 2026-09-09, typed into the iterate session that ran ACT-137.

Asked: the declared extent for a live corpus was decided by a session reading decision-4, not by you; confirm it or overturn it before ACT-141 is built, because overturning it later closes this card and ACT-134 rather than redirecting them.

Answered: "confirm".

So the extent is now a direction, not this board's own claim. The live install may not resolve anywhere: it is held to the install root plus the real path of the tree its own layout entries point into, read as configuration from outside the corpus root, defaulting to [liveCorpusRoot(), <that tree>], which is [~/.claude, ~/.agents] on this machine.

This is what AC#1 and AC#3 rest on. Before the confirmation they were the session's assertion against one reading of decision-4, which is why ACT-137's build refused to satisfy them and split them here instead. They are now sourced and buildable.

Still open, and NOT settled by this confirmation: what the harness does when an entry leaves the extent, beyond that GET /api/corpus must answer 200 with a named refusal and never a 500 (AC#3), and that the healthy live report must keep returning its files (AC#2). That is design and belongs to this card's shaping.
<!-- SECTION:NOTES:END -->
