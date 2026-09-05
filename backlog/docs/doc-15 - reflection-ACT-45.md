---
id: doc-15
title: 'reflection: ACT-45'
type: other
created_date: '2026-09-05 21:10'
---

# Reflection: ACT-45

## 1. What is the target condition?

Milestone m-2, "a second person can run the benchmark on their own machine"
(the milestone card carries only that title, no further description). doc-12's
triage queued ACT-45 alongside ACT-46 as the two m-2 cards that "block a
second person or João himself from running the tool at all." ACT-45's own
bet: a run against a target whose declared checks are already failing must
refuse before any provider call, name the failing check, and record a green
baseline in the manifest when one holds, so an unverified environment stops
being an uncontrolled variable under every score.

## 2. What is the actual condition now?

Matches the bet, verified directly this session, independent of the card's
own account. `captureRunBaseline` (run.ts:800) catches a `CommandError` from
the baseline `runChecks` call and re-throws it as a `RefusedPreconditionError`
naming the failing command and exit code; unrelated errors pass through
unchanged. `exitCodeFor` (exit-codes.ts:18) maps `RefusedPreconditionError` to
exit 3 and everything else to exit 1, so exit code alone tells the operator
which side of the baseline a failure is on. A green baseline produces a PASS
`LocalCheckResult` that flows through `RunManifestInputs` into the written
manifest (run.ts:917, manifest.ts:49) as an optional field, so a manifest
written before this change still loads. The full suite passes fresh on the
pinned Bun (1036 tests, 0 fail), and typecheck, lint, and format are clean.

The card records two sessions: a build session that observed the refusal and
manifest write by exercising the functions directly, and a separate
verification session that ran the real CLI end to end against a throwaway
case to close the gap between "observed the code path" and what AC #5 and #8
actually asked for (observed through the CLI). Both accounts hold up against
this session's own look at the code and the suite.

## 3. What obstacles stand between here and the goal, and which one is next?

None from this card; nothing here stalled or fell back to a stand-in for the
goal. The milestone's other named blocker, ACT-46 (a run refuses without
`--model` and `--session-budget-usd`, and no case declares either, so the
README's first documented command doesn't run), is still To Do and unbuilt.
That is the one thing standing between here and "a second person can run the
benchmark on their own machine": the baseline is now trustworthy, but nobody
can start a run without already knowing two flags no case declares.

## 4. What is the next step, and what do you expect from it?

ACT-46. It is already shaped with four acceptance criteria: a run of a
declared case starts with no flags beyond `--case` or refuses with one
combined message; a case can declare its model as part of its lineage; the
session budget gets a default or a per-case declaration, recorded on the card
with its reason; and the README's and runbook's first-run commands are
re-run afterward and work as printed. Expect that closing it makes the
milestone's own test, an operator with no prior context running the
documented first command, actually pass.

## 5. When can João go and see?

Now, for ACT-45: run the harness against a target seeded to fail one declared
check and watch it exit 3 naming the command, before any provider call; run
it against a green target and read `baselineChecks` in the written manifest.

Not yet for the milestone itself: that needs ACT-46 closed first, then the
README's documented first command run as printed with no extra flags.

## Verdict: on track

The bet held exactly, and the next step continues the goal without any
change to the plan doc-12 already set.

## Proposals

None. ACT-46 already exists, already carries the acceptance criteria the next
step needs, and doc-12 already queued it beside ACT-45 for this exact reason.

## Kaizen candidate

None. The card's own two-session structure (build observing code paths
directly, a later session closing the gap to what the acceptance criteria
actually asked for) is the corpus working as intended, not a defect.
