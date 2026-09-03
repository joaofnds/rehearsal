---
id: ACT-36
title: carry the reproducible-count rule into the shape and build skills
status: Done
assignee: []
created_date: '2026-09-03 13:06'
updated_date: '2026-09-03 15:35'
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
- [x] #1 The rule from decision-1 appears in the corpus skill that owns card writing, stated as one instruction with an example
- [x] #2 The example shows a count, its command, and its date, in the form decision-1 records
- [x] #3 The edit is made in the chezmoi source under ~/code/dotfiles, not in the rendered file, and Joao directed it explicitly
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built and committed as dotfiles b4eb3b5 (two files, +6 lines net).

## What changed

shape's 'What the task carries forward' now asks for the command and the date beside a number the card takes from the repository, and states that the rule governs a card's evidence rather than its acceptance criteria.

triage's 'Verify every premise' said to re-check a claim by 're-running the measurement', which only works if the card recorded one. It now points at the command the card records and says to add one where it is missing. That is the displacement the review-instructions skill requires of an edit that would otherwise only add: the two skills now describe one practice from each end rather than triage assuming something no skill asked for.

build is unchanged. See below.

## The independent pass rejected the first draft

Dispatched to the reviewer agent with the diff, decision-1, and review-instructions as its axes. Four findings changed the text, each verified against the files before acting:

1. The example ('Fourteen harness diagnostics still write to stdout (grep ... returns 14, 2026-09-03)') put a date, a count, and a repository-specific path into a file that review-instructions requires to hold 'nothing time-sensitive'. An example's register is copied more faithfully than any rule, so it taught the staleness the rule exists to prevent. Cut.
2. 'A citation names a symbol rather than a line number' duplicated a rule triage already owns ('Remove as you go: ... a line-number citation where a symbol would survive the next refactor'). decision-1 had noted the duplication and the draft added it anyway. Cut.
3. The literal reading of 'a measured quantity on the card' pulled in acceptance criteria, which decision-1 explicitly excluded. The scope boundary was in the decision and had not survived into the instruction. Restated.
4. build's addition restated 'what you observed and how' from two clauses earlier in the same paragraph, and pointed at shape's body with 'as shape states' when shape is not loaded during a directed fix. Cut entirely; build is back to its committed state.

Two further findings were reported and not acted on. The edit still only adds to shape: the reviewer proposed shape's 'unmeasured prohibition' paragraph as the displacement candidate, but that paragraph governs reading an inherited measurement while this rule governs writing one down, and merging two different rules to satisfy a line count would lose one of them. The reflowed-line lint question in build became moot when build's change was cut.

## Observed

Register lint after each edit: shape 3 hits, triage 1, build 6, every one of them in text this edit did not write. The first draft's rewrite briefly introduced a fourth hit in shape, an antithesis in 'not its acceptance criteria', which was rewritten to two plain sentences and cleared.

chezmoi diff shows exactly the two files and no others, so the source edit renders to the live corpus as written.

## Not observed, and needing Joao

chezmoi apply was NOT run. Applying it changes the live instruction corpus mid-session, which is Joao's to direct. Until he applies it, the rule is committed in the source and not in effect for running sessions.

No session has yet shaped a card under the new rule, so whether it changes behavior is unverified. review-instructions names that verdict 'test in use': reading a file can show a rule cannot change behavior, not that it does. The first shaped card after apply is the test.
<!-- SECTION:NOTES:END -->
