---
id: decision-6
title: The brief-reply cases keep the population ceiling of 154 words
date: '2026-09-08 23:16'
status: accepted
---
## Context

ACT-119 asked whether the four brief-reply cases should keep the word-band
ceiling of 154 or move it to 145.

154 is the ceiling of the range João's accepted rewrites occupied across the
whole population, 51 to 154, recorded in GLOSSARY.md's "Accepted band" entry.
On the four turns those cases cover, the accepted lengths top out at 145. That
gap is what raised the question: a ceiling drawn from the wider population is
looser than the evidence from these four turns alone.

ACT-35's runs, one debug rep per case, model sonnet, measured 2026-09-08:

    case                  accepted  reply  word-band
    brief-reply-e3dea673       145    158  FAIL
    brief-reply-02f0f204       136    286  FAIL
    brief-reply-40878d26       108    129  PASS
    brief-reply-92b2e8b0        76    164  FAIL

Three of four replies already fail at 154. Lowering to 145 would additionally
fail e3dea673's 158.

Per-case bands derived from each turn's own accepted length were considered and
rejected before this decision: they would fail replies shorter than lengths João
accepts on other turns, which contradicts the glossary's stated reason for
declaring a ceiling and never a floor.

## Decision

The ceiling stays at 154. Recorded by direction, commit f835f75, 2026-09-08:
"ACT-119 keeps its 154-word ceiling. Dropping to 145 would fail a reply already
accepted, making the check disagree with the judgment it encodes."

## Consequences

No case declaration changes and GLOSSARY.md's "Accepted band" entry keeps the
number it records, so ACT-119 closes on its third acceptance criterion rather
than its second.

The check stays calibrated to what was actually accepted rather than to the
tightest reading of a four-turn sample. A reply between 145 and 154 passes even
though no accepted reply on these four turns was that long; that is the cost of
one population-wide ceiling, and it is accepted so the check never contradicts
a judgment already made.

The question does not return as a new card. A future move of this number needs
a wider population measurement, not a re-reading of these four turns.
