---
id: doc-42
title: 'reflection: ACT-51'
type: other
created_date: '2026-09-08 16:17'
---

# Reflection: ACT-51

## 1. Target condition

Milestone m-6: "Watch a run spend money while it happens." Per doc-7, m-6 has
two cards: ACT-51 (the largest harness change in the UI work, giving run state
somewhere to live) and ACT-26.7 (getting harness progress off stdout so ACT-51
"can land on it"). The bet (recorded on ACT-51's own notes, dated 2026-09-08,
picked first off the ready queue by iterate) targeted the six acceptance
criteria: a live SSE stream showing stage/spend/elapsed time, `kill -9` +
restart reconciling to INTERRUPTED rather than FAILED, stage progress off
`console.log`, and INTERRUPTED reaching every status reader.

## 2. Actual condition now

`backlog milestone` reports m-6 at 1/2, accurately. ACT-51's own six
acceptance criteria are checked with fresh, session-observed evidence: a real
`--model sonnet` run against `audit-log`, a second process reading its SSE
stream live, a real `kill -9` and restart reconciling to INTERRUPTED, direct
greps and reads confirming the remaining behaviors. That part of the bet held.

One claim in the record does not hold. ACT-51's description and final summary
both say ACT-26.7 is closed ("Harness stage progress no longer goes to stdout
as prose, closing ACT-26.7"), and AC #4 was checked against the narrower claim
"no console.log touching stage progress." I ran `grep -rn "console.log"
src/benchmark/` directly this session: 11 sites remain, including
`run.ts`'s `Target:`, `Original commit:`, `Workflow backup:`, `Judge session`,
and the grade JSON print, all still on stdout ahead of and around the JSON
output. ACT-26.7 itself is untouched: To Do, 0/6 acceptance criteria, and its
own AC #5 requires zero matches for that same grep, not zero matches "touching
stage progress" — a stricter bar ACT-51 did not clear and did not attempt.
`rehearsal run --json > artifact.json` today still would not parse. The board
mechanics did not overclaim (milestone shows 1/2 correctly), but the card's own
prose does, and a reader trusting ACT-51's summary alone would believe m-6's
second card is already done.

## 3. Obstacles and what's next

What the run met: no stopped step or budget exhaustion, this bet completed
cleanly through two review rounds, one blocking defect and eight should-fix
items found and fixed. What it left: ACT-26.7 in its original, unstarted
state, a false "closing" claim on ACT-51's own record, and two spun-off cards
already filed and not blocking (ACT-121, ACT-122).

The next obstacle for m-6 is ACT-26.7 itself, exactly as scoped before ACT-51
started: 17 named console.log sites (11 remain by direct count), the
stdout/stderr split for `run --json`/`replay --json`, and a fixture-based test
proving it without a paid session. Nothing ACT-51 built changes that scope;
the "lands underneath either way" framing in ACT-51's own description was
right, but the "closing ACT-26.7" claim added during the build was not
verified against ACT-26.7's own acceptance criteria before being written.

## 4. Next step

Two things, not one, since they're independent:

- Correct ACT-51's own record: strike or amend "closing ACT-26.7" in its
  description and final summary, since it is disproven by direct grep.
  Wording, not scope, closable in a few minutes.
- Build ACT-26.7 next to finish m-6. Expect it to produce a `run --json`
  and `replay --json` whose entire stdout is one parseable JSON document,
  verified by piping a real run's output through `jq` and by the new
  fixture-based test AC #6 already names.

## 5. When the increment can be seen

m-6 is visible now: `backlog milestone` shows 1/2, and the SSE stream can be
watched live against a real run per ACT-51's own verified steps. ACT-26.7's
increment is not there yet: `grep -rn "console.log" src/benchmark/` returns
11 matches today, and `rehearsal run --json` still emits non-JSON lines mixed
into stdout. Re-run that same grep after ACT-26.7 lands to check it from
outside the session.

## Verdict: Adjust

The goal (m-6, then m-7) stands. The plan changes only by correcting a false
claim already written to the board: ACT-51's card says ACT-26.7 is closed,
and it is not. No card's approach needs redoing; the fix is a wording
correction on ACT-51 plus building ACT-26.7 as already scoped.

## Proposals

- Amend ACT-51's description and final summary to remove "closing ACT-26.7,"
  since 11 of the original console.log sites remain and ACT-26.7's own
  acceptance criteria are untouched (0/6). One-line fix, no new card needed.
- Pick ACT-26.7 next for m-6 to close. Already fully scoped (doc-7,
  2026-09-04) and its own card carries the acceptance criteria; no shaping
  needed.
- Process defect for kaizen: a Done card's final summary asserted another
  card's closure without checking that card's own acceptance criteria first.
  The claim was checkable in one grep and wasn't checked before being
  written into two places on the card (description and final summary).

## Kaizen candidate

A build session wrote "closing ACT-26.7" into ACT-51's description and final
summary without running the one grep that would have disproven it, and
without opening ACT-26.7 to check its acceptance criteria. The corpus's
"Claims" rule (state as fact only what a tool result shows) covers exactly
this case; the gap is that nothing prompted checking a cross-card claim
against the other card's own record before writing it down twice.
