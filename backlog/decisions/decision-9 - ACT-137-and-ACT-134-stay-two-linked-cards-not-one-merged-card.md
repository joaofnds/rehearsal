---
id: decision-9
title: 'ACT-137 and ACT-134 stay two linked cards, not one merged card'
date: '2026-09-09 13:02'
status: accepted
---
## Context

ACT-137 and ACT-134 both describe the corpus report serving foreign bytes under
a confident digest when the source is the live corpus. ACT-137 is the route
where the root instruction file is a symlink out of the tree; ACT-134 is the
route where a layout directory is itself such a symlink. Both were reproduced
by triage on 2026-09-09, independently of the cards:

    symlinked CLAUDE.md, live source:  files=[CLAUDE.md, skills/build/SKILL.md]
                                       digest=91ec2f  refusals=[]
    symlinked agents/,   live source:  files=[CLAUDE.md, skills/build/SKILL.md,
                                       agents/stolen.md]
                                       digest=0f939c  refusals=[]

The reflection on ACT-135 (doc-55) proposed shaping the two as one piece of
work, on the grounds that both turn on the same live-source exemption and that
deciding the containment rule inside one shaping is cheaper than running two
builds against it.

## Decision

They remain two cards. ACT-134 carries a dependency on ACT-137, and the shared
containment predicate is recorded once, on ACT-137, before either build starts.

The triage skill's consolidate section permits a merge only for cards that
represent the same outcome or cannot be accepted independently, and directs that
distinct outcomes benefiting from one sitting be kept as linked cards with the
shared design decision recorded once. The linked-cards route delivers what
doc-55 asked for without archiving a card.

The fact the decision turned on is a code path, probed rather than argued.
`refuseUncontained` is called only from `corpus-file.ts` at lines 156 and 198.
`checkpoint.ts` never calls it, using `resolvesOutside` directly at line 214.
ACT-134's first criterion names `captureStageCorpus`, which reaches the second
of those paths and not the first, so the two cards' acceptance can be observed
independently and the merge test fails.

Recorded because two answers were reached and one was wrong. Triage's own first
answer was to merge. An advisor briefed without that position answered keep-two
and named the code path; the probe confirmed the advisor and reversed triage.

## Consequences

ACT-134 left the ready list, so no picker can take it before ACT-137 is Done,
which was verified by reading the list back.

Neither card can close under a rule of the form "refuse whatever resolves
outside the root". The layout kinds are `agents`, `output-styles` and `rulebook`
(`checkpoint.ts` line 319). In the operator's live install `agents` and
`rulebook` are symlinks into a sibling tree and `output-styles` is a real
directory, and the root instruction file is a symlink. `skills` is a symlink too
but is not a layout kind, being resolved by its own path. So two of three layout
directories plus the instruction file would be refused, which is enough to empty
every live report and to contradict ACT-137's own second criterion. Whoever shapes ACT-137 chooses a different predicate for what a live
source may hash and records it, because ACT-134's build inherits it.

ACT-134 gained a fourth criterion for its screen route, which until this run
lived only in its notes and had no home in its acceptance.

What would reopen this: a shaping that finds one predicate at one site both
paths flow through, such that a single build closes both cards' criteria. In
that case ACT-137 survives and ACT-134's first two criteria carry over with
their sources. Triage does not expect that, because `captureStageCorpus` never
reaches `refuseUncontained`.
