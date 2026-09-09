---
id: ACT-136
title: iterate's ready-queue picker skips any card whose line carries two tags
status: To Do
assignee: []
created_date: '2026-09-09 10:42'
updated_date: '2026-09-09 11:41'
labels:
  - bug
dependencies: []
priority: high
ordinal: 132008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
iterate's pick() reads 'backlog task list --ready --sort priority --plain' and takes the first match of queuePattern = /^\s*\[?\w*\]?\s*([A-Z]+-[0-9]+(?:\.[0-9]+)?) - /m. The single \w* matches at most one bracketed tag, so a queue line carrying two, like '[HIGH] [bug] ACT-135 - ...', never matches. The regex is unanchored to the list start and /m, so it silently falls through to the first line with zero or one tag and reports that card as the queue's first.

Observed 2026-09-09: 'iterate start' printed ACT-50 (MEDIUM, one tag) while the ready queue's first line was ACT-135 (HIGH, two tags). The same session's triage prose said 'the script picks ACT-135', so the stage and the script disagreed on the record. iterate also wrote its bet note onto the wrong card.

This is silent and priority-inverting: the highest card on the board is exactly the one most likely to carry a type tag alongside its priority, so the defect preferentially hides the work that matters most. It fails toward a plausible wrong answer rather than an error.

The script lives at ~/.scripts/iterate, which is chezmoi-managed out of ~/code/dotfiles, not in this repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 iterate's pick, given a ready-queue listing whose first line carries both a priority tag and a type tag, returns that first line's card id (observed 2026-09-09: the listing led with '[HIGH] [bug] ACT-135 - ...' and pick returned ACT-50, the first single-tag line)
- [ ] #2 the picker's behavior on a two-tag first line is covered by a check that fails against the current regex (the defect was silent: the wrong pick printed no error and read as a normal iteration start)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Checked 2026-09-09 by the overseeing iterate session: this card is currently both the ready queue's first line and what the defective picker returns, because it carries one tag while ACT-137 above it in creation order carries two. So the next 'iterate start' will pick this card correctly, by luck rather than by the regex working. Do not read that as evidence the defect is gone; the reproduction in the description still holds.
<!-- SECTION:NOTES:END -->
