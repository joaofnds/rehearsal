---
id: doc-17
title: 'reflection: ACT-46'
type: other
created_date: '2026-09-05 22:21'
---

# Reflection: ACT-46

## 1. Target condition

Milestone m-2, "a second person can run the benchmark on their own machine."
The bet, from doc-16's queue line: ACT-46 (m-2, high) "blocks a second person
or João himself from running the tool with no flags." The card's own goal,
from its implementation notes: a run of a declared case starts with `--case`
alone, with model and budget coming from the case declaration, flags and env
still overriding.

## 2. Actual condition now

Matches the bet, verified directly this run. `bun run rehearsal.ts run --case
smoke` with no other flags, run from a non-interactive shell, no longer exits
on a missing-flag refusal; it reaches the paid-execute path and is stopped
only by the new authorization guard ("the case declares the model, so nothing
you passed authorizes the spend; pass --model to say which model you meant to
pay for"). That guard is deliberate, not the old two-flag refusal: it exists
because the card's own build introduced a regression (a bare `rehearsal run`
with no flags reaching a paid session unauthorized) and closed it by requiring
either a TTY or an explicit `--model`/env var, on both the run and replay
paths. The regression was caught by the suite's own `BARE_REFUSALS` test, not
missed. All four acceptance criteria are checked, the suite is 1050 pass and
stable over three runs, and lint/typecheck/format all pass.

## 3. Obstacles and what's next

No obstacle stands between here and m-2's own goal from this card. The three
remaining m-2 cards (ACT-29, ACT-30, ACT-34) are independent of ACT-46 and of
each other; ACT-30 and ACT-34 can run in parallel, ACT-29 alone. None is
blocked by anything ACT-46 touched.

Next step: ACT-30 (compare dies with a raw ENOENT when `.benchmark-runs` does
not exist) or ACT-34 (the audit-log case's target not resolvable from any
checkout) — both Medium, both plain defects a second operator would hit
early. Either observation is the same shape as this card's: a fresh checkout,
no prior state, run the documented command, and see it either work or fail
with a message that says what to do.

## 4. When can João go and see

Now. `bun run rehearsal.ts run --case smoke` from a fresh shell either runs to
completion or refuses with one message naming what it needs, instead of the
old two consecutive exit-2s.

## Verdict: on track

The bet held. m-2 gained a real capability (case-declared model and budget)
and closed a regression its own build introduced, without touching m-1's
remaining work or the UI milestones ahead of it in doc-7's stated order.
Picking ACT-46 out of doc-7's milestone order (m-2 is last there) is not a
deviation: doc-16's queue ranks by readiness and independence, not strict
milestone order, and nothing in m-1's open set depends on ACT-46.

## Proposals

- No card to add. m-2's remaining three cards already cover the next
  observable step.
- No card to close, split, or reorder.

## Kaizen candidate

None. The regression this card introduced was caught by an existing test
before it reached the board as a defect, which is the check working as
intended, not a gap to fix.
