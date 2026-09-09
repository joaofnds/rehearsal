---
id: ACT-135
title: >-
  a probe planted a symlink in the live corpus and nothing noticed for eight
  hours
status: To Do
assignee: []
created_date: '2026-09-09 10:30'
updated_date: '2026-09-09 10:42'
labels: []
dependencies: []
documentation:
  - backlog/docs/doc-54 - triage-2026-09-09-b.md
priority: high
type: bug
ordinal: 131008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A probe from the ACT-130 session left a symlink at ~/.claude/agents/escape.md pointing to /tmp/stale-out-8nUK/secret.md. It sat in the live corpus from 02:43 until triage removed it at about 10:40 on 2026-09-09.

While it sat, corpusReport against the live source threw SymlinkedEntryError instead of returning a report, so the corpus screen, every live-corpus hash and stale --corpus against the live install all failed. Nothing reported it, because the file lives outside the repository in the operator's home tree, where the project's own checks and git status cannot see it.

The instance is already fixed. What this card is for is the guard: a probe that writes into ~/.claude must be prevented from doing so, or the damage must be detected and named, so the next reproduction fixture does not silently break the live corpus again.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 a session probe that writes into the live corpus tree is prevented, or detected and reported, rather than silently leaving the live corpus unreadable (observed 2026-09-09: ~/.claude/agents/escape.md, a symlink to /tmp/stale-out-8nUK/secret.md dated Sep 9 02:43, made corpusReport(liveCorpusSource()) throw SymlinkedEntryError; removed by triage 2026-09-09)
- [ ] #2 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by triage 2026-09-09 while measuring the live corpus file count for a record correction on ACT-132. The measurement threw instead of returning a number, which is how the stray was found at all.

What was there: ~/.claude/agents/escape.md, a symlink to /tmp/stale-out-8nUK/secret.md, mtime Sep 9 02:43. Not chezmoi-managed (checked with chezmoi managed), not tracked in the dotfiles git. The name and the target's contents ('secret') match the reproduction fixture ACT-130's shaping describes, and doc-52's own reproduction script plants exactly 'agents/escape.md' pointing at a temp file. So it is an ACT-130 probe, left behind.

Blast radius while it sat, inferred from the throw and not separately reproduced: corpusReport against the live source throws, so the corpus screen 500s, every live-corpus hash fails, and stale --corpus against the live install refuses. Roughly eight hours, 02:43 to 10:40.

Note the irony worth keeping: ACT-130 exists to make one symlink degrade instead of blanking a screen, and its own probe planted one in the live corpus. ACT-130 fixed the run-history screen's handling; corpusReport still throws on this, which is a separate surface from the one ACT-130 covered.

doc-52's kaizen section already names the general defect: 'a stage creating scratch probe files must clean them up in the same turn'. That reflection saw the two untracked files in the repo root and cleaned those. It did not see this one, because it is outside the repository, in the operator's live home tree, where git status cannot show it. That is what makes this worth its own card rather than a kaizen line: the repo's own cleanliness checks structurally cannot see a probe that writes to ~/.claude.

Priority High: it is an operator-visible outage of the live corpus, it recurred from a shipped process rather than a one-off, and the next probe reintroduces it. The instance is fixed; the card is for the guard.

Direction for whoever takes it: the cheap guard is probably that a probe writes only under a temp root it owns, plus a check that names any live-corpus entry resolving outside ~/.claude. Do not close this by deleting the file again.

CORRECTION, triage 2026-09-09, after adversarial review of doc-54. Two claims in the note above are wrong and the card should be built against these facts instead.

1. The attribution to ACT-130's reproduction script is WRONG. That script plants the link under a mktemp -d, and its 'cp -RL' dereferences, so its agents/ is a real directory inside the temp tree and it cannot reach ~/.claude. Reproduced this run: after the cp -RL line, 'ls -ld $c/agents' shows a real directory, not a link. A 'cp -R' without -L would write through, since ~/.claude/agents is itself a symlink, but that is not the recorded script. So the route by which the link reached the live tree is UNKNOWN. Do not build a guard shaped around the script in doc-52; find the actual route first, or build a guard that does not depend on knowing it.

2. The blast radius was overstated. Checked against the code this run: corpusReport throws and src/server/api.ts wraps /api/corpus in no try/catch, so the corpus screen did fail for the whole window, and captureStageCorpus throws on the same input. But 'stale --corpus' does NOT fail. staleness-report.ts catches SymlinkedEntryError and returns a named refusal cause, which is the degradation ACT-130 shipped. And hashCorpusFiles walks only the declared layoutPaths, so a case that does not declare agents/escape.md was never touched. AC#1's phrase 'leaving the live corpus unreadable' should be read as the corpus screen and directory-walking captures, not the whole harness.

Priority stays High. The narrower blast radius still includes an operator-visible screen failing for eight hours with nothing reporting it, and the unknown route makes recurrence more likely rather than less.

Both corrections came from an unprimed reviewer probing claims I had stated as settled. The first was inference from a name match presented as fact, which is ACT-127's pattern committed by triage itself.

Bet, 2026-09-09: first card in the ready queue (backlog task list --ready --sort priority), the board's only High. Placed by the overseeing iterate session rather than by iterate itself, which skipped this card through the picker defect recorded on ACT-50 and filed as its own card.
<!-- SECTION:NOTES:END -->
