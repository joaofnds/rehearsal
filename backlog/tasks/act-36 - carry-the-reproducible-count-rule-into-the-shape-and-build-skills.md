---
id: ACT-36
title: carry the reproducible-count rule into the shape and build skills
status: To Do
assignee: []
created_date: '2026-09-03 13:06'
labels: []
dependencies: []
priority: low
ordinal: 38008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-1 on this board (accepted 2026-09-03) says a count on a card is written with the command that produces it, so a later reader re-measures instead of guessing whether the number drifted. That decision is recorded on this board, but the rule governs how cards are written on every board, so it belongs in the corpus.

Why it exists: triage 2026-09-03 found four cards whose counts had gone stale within days, one of them (ACT-27) understating the work by 170 lines. Each count was correct when written and none said how it was measured.

Where it likely goes, to be settled by the work: the shape skill, which produces the cards that carry these counts, and the build skill, which writes the handoff notes that carry them onward. The triage skill already says a stale premise is checked by "re-running the measurement", which assumes the card records how; that sentence is the one this rule completes.

This edits the instruction corpus at ~/.agents/skills/, which is Joao's, and the corpus is managed with chezmoi, so the source is in ~/code/dotfiles and not the rendered file. It needs his explicit direction before any edit, and the review-instructions skill gates the result.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The rule from decision-1 appears in the corpus skill that owns card writing, stated as one instruction with an example
- [ ] #2 The example shows a count, its command, and its date, in the form decision-1 records
- [ ] #3 The edit is made in the chezmoi source under ~/code/dotfiles, not in the rendered file, and Joao directed it explicitly
<!-- AC:END -->
