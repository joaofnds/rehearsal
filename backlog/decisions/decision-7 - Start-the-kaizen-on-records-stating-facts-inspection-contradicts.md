---
id: decision-7
title: Start the kaizen on records stating facts inspection contradicts
date: '2026-09-08 23:16'
status: accepted
---
## Context

Across six triage runs the same pattern was named and carried without being
started: a card's own record states a fact about another card, or about itself,
that direct inspection contradicts, and nothing prompted the check before the
claim was written down.

Instances at the time of the decision, six, across five sessions and three kinds
of work: doc-28 (ACT-86), doc-32 (ACT-48), doc-33, doc-36, doc-38, and doc-42
(ACT-51's final summary asserted ACT-26.7's closure without reading ACT-26.7's
acceptance criteria). The sixth landed on ACT-104, where a design note said a rep
counts as successful at the run's configured minimum grade while stageObservation
hardcodes A or B and never reads DEFAULT_MINIMUM_STAGE_GRADE; it sat on the card
for three commits before review caught it.

doc-43 recommended starting rather than carrying it to a fifth run. It was
carried anyway, twice more.

The corpus's Claims rule already forbids exactly this, so the gap is procedural
rather than doctrinal. Every one of these sessions believed its claim was true,
which is what rules out more vigilance as the answer.

## Decision

The kaizen starts. Recorded by direction, commit f835f75, 2026-09-08: "ACT-127
starts the kaizen on records that state facts inspection contradicts, carried
unstarted since doc-33 and now at six instances."

It is held by ACT-127, whose two acceptance criteria are that the kaizen names
the point in the flow where such a claim gets written without a check, and that a
guard exists which fires on one before it is committed, observed by writing a
claim and seeing it caught.

## Consequences

Triage stops carrying this as a kaizen candidate. It is a card now, and the next
run reads its status rather than re-recommending it.

The deliverable is a guard the system enforces, not a reminder. A fix that only
tells sessions to check harder does not satisfy ACT-127's second criterion.

Instances found after this decision are recorded on ACT-127 rather than raised as
new candidates. A seventh was found by triage 2026-09-09: ACT-126's body states
"ACT-50 is not the right home: it is Done" while ACT-50 reads To Do, reopened two
hours after ACT-126 was filed.
