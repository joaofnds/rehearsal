---
id: decision-8
title: 'ACT-50 is the home for the What moved tab, and ACT-126 is archived into it'
date: '2026-09-09 10:28'
status: accepted
---
## Context

Two cards described building the comparison page's What moved tab, and m-7 held
only those two.

ACT-126 was filed from doc-47, the reflection on ACT-104, on the stated ground
that "ACT-50 is not the right home: it is Done".

Commit f835f75 created the ACT-126 card file, the triage doc that filed it
(doc-48), and the direction reopening ACT-50, all in one commit. Verified by
`git log --diff-filter=A` on the card path, which returns only f835f75, and by
`git ls-tree f835f75~1`, where the card does not exist. doc-48 at that commit
names ACT-126 as a new card and puts it at queue position 3.

doc-50 found the overlap, recommended ACT-50, and left the choice open as the
writer's to make.

## Decision

ACT-50 is the survivor. ACT-126 is archived into it.

The direction in f835f75 settles it in its own words: "ACT-50 reopens to render
the What moved tab, rather than a new card: ACT-104 shipped the data, and this
card's scope is already the screens whose data the harness records."

ACT-126 is a new card for that tab, and it was in view when the direction was
written: the same commit carries the card, the triage doc that filed it, and the
direction. So "rather than a new card" reads as a correction of that specific
card rather than a general statement made without knowing of it. The board's own
rule agrees: directed work that an existing card describes is that card.

The argument for the other side, that a one-criterion survivor is cleaner than a
thirteen-criterion card twelve of which are delivered, does not outweigh a typed
direction naming the home. It was weighed and rejected.

ACT-126's premise was also false by the time it mattered: ACT-50 read To Do, not
Done, verified 2026-09-09.

## Consequences

ACT-50 carries fourteen criteria. Twelve stay checked and unchanged. AC#13 was
rewritten to carry its source and to absorb ACT-126 AC#3, the removal of the
placeholder copy, which is a child of the block AC#13 replaces. AC#14 is
ACT-126 AC#2 moved across: the tab opened in a browser against a comparison
recorded on disk, the only criterion of the four that observes the screen rather
than the code.

AC#14 cannot be observed today. No comparison record exists under
.benchmark-runs/comparisons on this checkout, verified 2026-09-09. ACT-114 AC#2
is the card that settles why, so ACT-114 runs first or alongside.

What would reopen this: a typed direction naming ACT-126 as the home, or one
saying the f835f75 direction was given unaware of ACT-126 and that the finer card
is preferred. Nothing on the board or in git records either.
