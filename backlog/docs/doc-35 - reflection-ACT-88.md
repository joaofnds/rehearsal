---
id: doc-35
title: 'reflection: ACT-88'
type: other
created_date: '2026-09-07 18:11'
---

# Reflection: ACT-88

## 1. Target condition

The board's goal (doc-6, restated unchanged through doc-33): prove the m-1
loop once, then the UI milestones (m-5/m-6/m-7), then m-2, then m-3. ACT-88
carries no milestone; it is a standalone directive from João (quoted on the
card, 2026-09-06): halt a run, replay, or calibrate before it spends anything
if any declared reference it needs — target, task/brief/rubric/pipeline file,
model, or budget — does not resolve. The bet, from the card's own shape
record: one gate function called ahead of the first stage or provider call in
all three commands, fail-fast on the first missing or invalid reference, the
model check done as a live throwaway probe read through the response
envelope rather than a static list or exit code.

## 2. Actual condition now

Matches the bet, verified by reading the wired code directly, not only the
card's claim. `assertPipelinePreflight` (`src/benchmark/preflight.ts`) runs
ahead of `dependencies.execute` in `run-command.ts`. `replay-command.ts` and
`calibrate-command.ts` each call a `probeModel` dependency ahead of their
spend; in production wiring (`rehearsal.ts`) all three point at the same
`defaultProbeModel`, which wraps `probeModelAvailable` and reads
`readClaudeEnvelope`'s `is_error` flag rather than the process exit code, so
AC #7 and #8 hold in the actually-shipped path, not only in a unit test
against a stub. All ten acceptance criteria check out against the code as
written today. Suite green (1112+62), typecheck/lint/fmt clean, per the
card's review record and doc-33's same-day fresh run.

One near-miss worth naming: a first-pass grep for the literal name
`probeModelAvailable` found no call in `replay-command.ts` or
`calibrate-command.ts`, which looked like AC #7 was checked off falsely.
Tracing the actual dependency-injection wiring back to `rehearsal.ts` showed
the real call site uses the `defaultProbeModel` re-export instead. The
lesson is procedural, not a defect in the card: a name-only grep against a
DI codebase can manufacture a false finding; the check that resolves it is
tracing the composition root, not the call site.

Doc-33 (16:25) still listed ACT-88 in Shape with two open scope questions
(all-three-commands? live probe or static list?). The card shows both
answered by João directly at the card, same day, in a shape pass that ran
after doc-33 was written; build, review, and close followed in the same
window, ending 18:09. No process gap: doc-33 was reading a snapshot that
was current when written and stale an hour and a half later.

## 3. Obstacles and what's next

None stand between this card and the goal; it is closed and verified. The
one obstacle it left behind on purpose: `assertControlReady`/
`assertSourceReady` still run twice on a plain run and three times on a
`--confirm` run, because neither `runBenchmark` nor `confirmRun` was changed
to consume the baseline the new gate already computed. Deferred and already
split out as ACT-106 (2 AC, To Do, not on any milestone), scoped correctly
per this card's own review record (the architecture reviewer independently
confirmed the split, not just the author). Not a correctness problem today,
both re-checks are cheap and idempotent; it is duplicate I/O the gate was
meant to make redundant.

ACT-88's own handoff surfaces no other loose end. The card that follows it
is ACT-106, already filed, already right-sized.

## 4. Next step and expected observation

ACT-106, as filed: change `assertPipelinePreflight`'s signature to return the
`SourceBaseline`/`controlSha` it already computes, and have `runBenchmark`
and `confirmRun` take that value instead of re-deriving it. Expected
observation: a plain run calls `assertControlReady`/`assertSourceReady`
exactly once, a `--confirm` run also exactly once, both provable by a call
count assertion in the existing command tests. This is infrastructure, not
milestone work, so it does not compete with m-1/m-5/m-6/m-7 for priority
and can run whenever it reaches the front of the queue doc-33 already set.

## 5. Where to see the increment

`bun run rehearsal.ts run <case> --target /path/that/does/not/exist` halts
immediately naming the missing path, before any provider call; the same
against a case declaring an unentitled or misspelled `--model` halts naming
the model, not a raw CLI exit. Both are there now, verified this session by
reading the wired call graph and the passing tests that exercise it; not
re-run live against the real `claude` CLI in this session, since the card's
own review record already did that end-to-end check (commit 166f120's notes)
and nothing has changed since.

## Verdict: On track

The bet held exactly as shaped, and the goal (m-1 first, this card outside
any milestone) is unaffected either way. Nothing here changes the plan.

## Proposals

None. ACT-106 already exists, already right-sized, no split or reorder
needed.

## Kaizen

One clause: a name-only grep for a function across a dependency-injected
codebase can produce a false "not wired" finding where the real call site
uses a differently-named re-export; the resolving check is tracing the
composition root (here, `rehearsal.ts`), not the literal call site. Logging
this as a personal-process note for this reflection, not proposing a
board-level kaizen card, since it is a single self-caught near-miss, not a
recurring pattern across sessions.
