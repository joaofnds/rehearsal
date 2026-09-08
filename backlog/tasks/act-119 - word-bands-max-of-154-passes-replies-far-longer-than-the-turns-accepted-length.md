---
id: ACT-119
title: brief-reply replies run longer than the accepted length on three of four turns
status: Shape
assignee: []
created_date: '2026-09-08 12:25'
updated_date: '2026-09-08 20:41'
labels: []
dependencies: []
priority: medium
ordinal: 115008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Superseded framing. This card was filed claiming word-band's max of 154 was a
miscalibrated shared constant. That was wrong, and GLOSSARY.md already said so:
the "Accepted band" entry records 154 as the ceiling of the range Joao's accepted
rewrites occupied across the population (51 to 154), with 108 to 145 on these
four turns specifically. It also states that a case declares its ceiling and
never its floor, because a reply shorter than the one he accepted is not a
failure. The single ceiling is a deliberate, documented decision, not an
oversight, and the filing session did not cite it.

What actually stands is evidence about the corpus, not about the check.

Observed 2026-09-08 in ACT-35's runs, one debug rep per case, --model sonnet:

  case                  accepted  reply  word-band
  brief-reply-e3dea673       145    158  FAIL
  brief-reply-02f0f204       136    286  FAIL
  brief-reply-40878d26       108    129  PASS
  brief-reply-92b2e8b0        76    164  FAIL

Three of four replies exceed the length Joao accepted for that turn, and
02f0f204 runs 286 words against an accepted 136, more than double. Three also
exceed the population ceiling of 154 and so fail the check as declared. That is
the benchmark working: the check caught replies longer than anything in the
accepted range.

The open question is narrower than the original framing: is the population
ceiling of 154 the right ceiling for these four cases, given the accepted
lengths on these turns top out at 145? Lowering the single ceiling to 145 stays
inside the glossary's design (one ceiling, no floor) and would additionally fail
e3dea673's 158. Per-case bands derived from each turn's accepted length were
considered and rejected: they would fail replies shorter than lengths Joao
accepts on other turns, contradicting the glossary's stated reason for excluding
floors.

Any change here edits the glossary entry too, since the band is documented there
as a measured property.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded on whether the four brief-reply cases keep the population ceiling of 154 or move to 145, the highest length accepted on these four turns
- [ ] #2 If the ceiling moves, every brief-reply case declares the new ceiling and GLOSSARY.md's Accepted band entry states the same number
- [ ] #3 If the ceiling stays at 154, the reason is recorded on this card and no case or glossary text changes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Filed from ACT-35's runs, 2026-09-08. Referenced by ACT-35's completion notes.

Per-case bands rejected by Joao, 2026-09-08, after the glossary's documented design was cited: cases declare a ceiling and never a floor, so a per-turn band would fail replies shorter than lengths he accepts on other turns. Acceptance criteria rewritten to match; the original two demanded the rejected design.

The 154-to-145 ceiling question is deliberately left open. It was raised as an option in the same exchange and not decided, so it is not this session's to settle.

Triage 2026-09-08 (e): routed to Shape. AC#1 asks João to decide between keeping the 154 ceiling or moving to 145; that decision is not this session's to make, per the card's own implementation notes. Joins this run's questions list.
<!-- SECTION:NOTES:END -->
