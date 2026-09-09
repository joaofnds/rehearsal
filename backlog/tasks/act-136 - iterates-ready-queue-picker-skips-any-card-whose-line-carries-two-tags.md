---
id: ACT-136
title: iterate's ready-queue picker skips any card whose line carries two tags
status: Done
assignee:
  - '@claude'
created_date: '2026-09-09 10:42'
updated_date: '2026-09-09 14:57'
labels:
  - bug
dependencies: []
documentation:
  - backlog/docs/doc-56 - triage-2026-09-09-c.md
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
- [x] #1 iterate's pick, given a ready-queue listing whose first line carries both a priority tag and a type tag, returns that first line's card id (observed 2026-09-09: the listing led with '[HIGH] [bug] ACT-135 - ...' and pick returned ACT-50, the first single-tag line)
- [x] #2 the picker's behavior on a two-tag first line is covered by a check that fails against the current regex (the defect was silent: the wrong pick printed no error and read as a normal iteration start)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Checked 2026-09-09 by the overseeing iterate session: this card is currently both the ready queue's first line and what the defective picker returns, because it carries one tag while ACT-137 above it in creation order carries two. So the next 'iterate start' will pick this card correctly, by luck rather than by the regex working. Do not read that as evidence the defect is gone; the reproduction in the description still holds.

Triage verdict, 2026-09-09 (doc-56). Disposition: keep, next action build. Priority High, unchanged. This is the queue's first card this run.

Defect verified at the source this run, not relayed. queuePattern at ~/.scripts/iterate line 32 is /^\s*\[?\w*\]?\s*([A-Z]+-[0-9]+(?:\.[0-9]+)?) - /m. The single \w* matches at most one bracketed tag, so a two-tag line cannot match, and /m without anchoring to the list start makes it fall through to the first line with zero or one tag.

The card's note from the previous run said this card would be picked correctly by luck. That is still true and the luck now has a different cause: ACT-134 gained a dependency this run and left the ready list, so this card is the first line outright, carrying one tag. I ran the actual regex against the live listing and it returns ACT-136, matching the true first line. So the stage and the script agree today, and the defect is unchanged underneath.

Blocked on a typed instruction, and this is why it is not built this run. The script is chezmoi-managed at dot_scripts/executable_iterate in the dotfiles repository, outside this directive's repository, and changing it alters the loop while the loop is running. Note that ~/code/dotfiles carries uncommitted work from another session, so any edit must not disturb it.

Queued command for whoever authorizes it: widen the tag portion of queuePattern to match repeated bracketed tags, and add the check AC#2 asks for against a two-tag first line.

Triage note, 2026-09-09 (doc-56), superseding the pick reasoning in this run's earlier verdict above. This card is no longer the ready queue's first line: ACT-122 was raised to High this run and sorts above it by card ID.

The picker still returns this card, because ACT-122's line carries two tags and this one carries one. Verified by running the picker regex against the live listing after the change: true first line ACT-122, picker returns ACT-136.

So the script picks this card, and that is the right outcome rather than a lucky one. This is the defect producing the divergence, and no pick after it can be trusted until it lands. It is also the third consecutive run in which the picker's answer and the board's first line have had to be reconciled by hand.

Triage correction, 2026-09-09 (doc-56), after review. This card was named the run's next card in an earlier draft and is not. It is excluded from the selectable queue as externally blocked, because its subject is a script outside this repository whose edit a hard line reserves for a typed instruction. Naming a blocked card as the next action would stall an unattended loop on a card no session here can build.

The consequence is worse than a misordering and is worth stating plainly. The picker will still choose this card, so an unattended 'iterate start' picks it, cannot act on it, and gets no work done. The picker defect now blocks the board rather than merely reordering it.

The run's next card is ACT-122, the highest card a session here can actually build.

Bet, 2026-09-09: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet.

Overseeing note, 2026-09-09, iterate run. The picker defect was reproduced live at the start of this run, not relayed: 'backlog task list --ready --sort priority --plain' led with '[HIGH] [bug] ACT-122 - ...' and 'iterate start' printed ACT-136. So this is the second consecutive run where the picker's answer and the board's first line diverge, and this run it is a two-tag line being skipped rather than a lucky agreement.

This card stays blocked behind the hard line on editing a script outside this repository. The overseeing session stepped ACT-122 instead, the queue's true first line. The queued command in the notes above is unchanged and still the action whoever authorizes it should run.

Landed 2026-09-09 as dotfiles c7b9e843, applied to ~/.scripts/iterate with 'chezmoi apply'.

The tag portion of queuePattern is now a repeated group, /^\s*(?:\[\w+\]\s*)*([A-Z]+-[0-9]+(?:\.[0-9]+)?) - /m, so a line with any number of bracketed tags matches and a tagless line still does.

AC#1 verified on the live board's own text, not a synthetic string: with the real ready listing reordered to lead with '[HIGH] [bug] ACT-137 - ...', the old pattern returns ACT-136 and the new one returns ACT-137.

AC#2 is 'the queue's first card is picked when its line carries a priority tag and a type tag' in scripts/test-iterate.test.js, registered in check-all.sh. Restoring the old regex fails that test and only that test. The fake backlog's queue line moved into the fixture so a test can set its tags. Full check-all.sh: 6 passed, 0 failed.
<!-- SECTION:NOTES:END -->
