---
id: doc-6
title: roadmap-2026-09-04
type: other
created_date: '2026-09-04 13:00'
---

# Roadmap, 2026-09-04

Written after the triage in doc-5, on João's direction to prioritize against
the project's actual goal and organize the board into milestones.

## The goal, in João's words

> It is a tool for developers to improve their instruction corpus by running
> their own benchmarks on their own tasks. Set an LLM off to do what they would
> usually do (shape, build, review), inspect the instructions loaded at each
> step and the actual result, grade the intermediate steps and the whole
> workflow, then start tweaking instructions on their own computer, re-run the
> benchmarks, compare, and see what actual changes lead to better outcomes.

And the origin: he keeps asking sessions to improve instructions, they change
them, and he has no way to tell whether the change helped, because he is never
working on the same task twice.

This matches `docs/vision.md`. Nothing below revises the vision; it re-ranks the
board against it.

## The finding that sets the order

**Every capability in `docs/design.md`'s path is built, and the loop has never
run once.**

The design doc lists six steps from the old harness to the tool in the vision:
pipeline as data, checkpoints, stage replay, invalidation, reps, comparison
reporting. All six are built, unit-tested, and closed on the board (ACT-1
through ACT-6, then the ACT-26 family).

Measured 2026-09-04 at 540ba9a:

    ./rehearsal.ts list runs          → empty
    ./rehearsal.ts list checkpoints   → empty
    ./rehearsal.ts list groups        → empty
    ./rehearsal.ts list comparisons   → empty

The only recorded evidence on this machine is nine session attempts of the
`smoke` and `brief-reply` cases. No pipeline has ever run. No checkpoint has
ever been recorded. No replay has ever been performed against a real corpus
edit. No comparison has ever been produced or read.

So the central claim of the project, that this tool tells you whether an
instruction change helped, has never once been exercised. Every belief about
whether it works is inference from unit tests over fakes.

That is why the board drifted into hygiene: with the design doc's path
complete, there was no capability card left to write, and nine cards of
cleanup, refactoring, and evidence work filled the space. None of them moves
the tool closer to answering João's question.

## The three milestones

Ordered so each ships something, is observable on its own, and produces
feedback that can change the next one. No big design up front: m-2 and m-3 are
deliberately thin, because m-1 is expected to rewrite them.

### m-1 — Prove the loop once: run a stage, edit an instruction, replay, and read a comparison

The walking skeleton the project never walked. Two cards:

- **ACT-38** — run the audit-log pipeline once, end to end, and record what it
  cost. A run that stops at stage two is a successful outcome if what stopped it
  is recorded. The deliverable is the record of what actually happened, not a
  green result.
- **ACT-39** — replay one stage against an edited instruction and read the
  comparison. Depends on ACT-38 for a checkpoint. The acceptance that matters:
  answer "did that edit improve the stage" from the tool's own output, or record
  it as unanswerable and what was missing.

Why first: it is the only work on the board that tests the project's premise.
It also costs real money, and the cost itself is a finding, because the vision
promises "iteration costs one stage, not the whole pipeline" and nobody has
measured either number.

Expect this milestone to generate more cards than it closes. That is its job.

### m-2 — A second person can run the benchmark on their own machine

Everything here is already on the board and already measured. Three cards:

- **ACT-30** — a clone's first whole-suite run fails five tests, four of them
  compare's ENOENT.
- **ACT-34** — the only pipeline case points at a repository outside the
  checkout, so the one case that exercises the whole tool cannot run for
  anybody else.
- **ACT-29** — the suite leaks about 865 temp directories per day of work.

ACT-34 is the load-bearing one: the tool's single pipeline case is unrunnable
by a second person, which makes "a developer runs their own benchmarks" false
for everyone but João today. The other two are the first-run experience.

Second, not first, because m-1's findings will probably change what portability
means here, and fixing portability for a loop nobody has run is fixing the wrong
thing first.

### m-3 — Tell a real corpus improvement from noise

The vision's outer loop: a single rep is never presented as a score. Two cards:

- **ACT-32** — transcript checks judge the resumed prefix as if the attempt did
  it, so `tool-calls { max: 0 }` cannot express the failure it exists to catch.
- **ACT-35** — the three unrun brief-reply turns, about 7 USD, already approved.

Both are about trusting the evidence rather than producing more of it.

## Cards deliberately outside a milestone

- **ACT-37** (harness-owned settings file). Re-prioritized high → medium. The
  ACT-28 reflection named it next; against this goal it is not. It makes a stage
  session's settings match a live session's, which only pays off once stage
  sessions produce comparisons somebody reads, and none exist. It also sits
  behind João's open question on ACT-28 comment #5, about whether freezing
  corpus bytes into the local install is the right mechanism at all with a
  second provider coming. Reconsider after m-1.
- **ACT-40** (`list attempts` prints raw ENOENT). Filed this session. Real, small,
  and on the operator's path, but not on any milestone's critical line.
- **ACT-26.7, ACT-27, ACT-31** (refactoring). Stay Low. Until m-1 produces a
  comparison somebody reads, internal restructuring changes nothing an operator
  observes. One watch item: ACT-26.7 blocks anything that consumes `run --json`
  programmatically, so if m-1's run is scripted rather than driven by hand, pull
  it forward.

## What this run changed

| Card | Field | Before | After | Reason |
| --- | --- | --- | --- | --- |
| — | milestones | m-0 (met, empty) | m-1, m-2, m-3 created | The goal João stated |
| ACT-38 | — | — | created, high, m-1 | No card existed for running the tool |
| ACT-39 | — | — | created, high, m-1, deps ACT-38 | Same, for the replay half |
| ACT-40 | — | — | created, medium | Defect found this session |
| ACT-30, ACT-34, ACT-29 | milestone | none | m-2 | Portability and first-run |
| ACT-32, ACT-35 | milestone | none | m-3 | Evidence trust |
| ACT-32 | priority | high | medium | Ranks below m-1; nothing in m-1 or m-2 depends on it |
| ACT-37 | priority | high | medium | Compensation work for a loop nobody has run |
| ACT-37, ACT-26.7, ACT-27, ACT-31 | notes | — | ranking reason appended | So the next session inherits the reasoning |

Open set: 9 before, 12 now. This run grew the board on purpose. Three of the
new cards are the work the project's goal requires and the board did not
contain; a board that cannot see its own central gap is worse than a longer
board that can.

## The queue

1. **ACT-38** (m-1, high). Needs João's approval on cost before it runs.
2. **ACT-39** (m-1, high). Waits on ACT-38's checkpoint.
3. **ACT-34** (m-2, medium). Can run in parallel with m-1 and unblocks anyone
   else running the pipeline case.
4. **ACT-30** (m-2, medium). Parallel with ACT-34, different files.
5. **ACT-40** (medium), **ACT-32** (m-3, medium), **ACT-29** (m-2, medium),
   **ACT-35** (m-3, medium, waits on ACT-32 and money).
6. **ACT-37** (medium, waits on a direction from João).
7. **ACT-26.7** → **ACT-27**, **ACT-31** (low, in that order).

Bundles that cannot run in parallel are unchanged from doc-5: ACT-26.7 before
ACT-27 and ACT-31; ACT-32 before ACT-35; ACT-29 alone because it touches 45 test
files.

## The risk in this plan

ACT-38 may reveal that the audit-log pipeline case cannot complete at all, or
costs far more than the loop is worth, or that the comparison output does not
answer the question it was built to answer. Any of those invalidates parts of
m-2 and m-3 as written.

That is the intended outcome of putting it first. The alternative, polishing
portability and evidence handling for a loop whose value is unmeasured, spends
the same effort and learns nothing.
