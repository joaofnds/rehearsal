---
id: doc-20
title: 'reflection: ACT-30'
type: other
created_date: '2026-09-05 23:38'
---

## 1. What is the target condition?

ACT-30 belongs to m-2: "a second person can run the benchmark on their own
machine." doc-6's bet for ACT-30 was narrower than the milestone: make a
fresh clone's first whole-suite run stop failing on `compare`'s raw ENOENT
against an absent `.benchmark-runs` directory, one of five failures doc-6
counted on a fresh clone.

The other four of those five failures were split out during the run into
ACT-34 (the audit-log case's target path resolves only on João's machine)
and, per ACT-30's own description, other raw-ENOENT listers found along the
way (ACT-85, ACT-87). ACT-30's own acceptance criteria narrowed to just the
compare defect: no raw ENOENT from `compare` on a checkout with no
`.benchmark-runs`, and the named loader and CLI tests passing in that state.

## 2. What is the actual condition now?

ACT-30's own scope is closed and matches what it claims. I reproduced the
original ENOENT crash by reverting the fix, restored it, and reran: on the
pinned Bun 1.4.0, with `.benchmark-runs` removed, the loader test and all
three named CLI compare tests pass. Review found no blocking or should-fix
issues; a few pre-existing rough edges (a blanket catch that swallows all
readdir errors, not just ENOENT; duplicated absence-handling across three
other files) were named and correctly left as debt, not blockers.

Where the bet undershoots the milestone: doc-6's own framing for ACT-30 was
"a clone's first whole-suite run fails five tests," and that whole-suite
claim is not what ACT-30 fixed or verified. I ran the full suite fresh
locally (`.benchmark-runs` removed) and it is green, 1053 pass, 0 fail, but
this machine still has the sibling `nest/template` directory ACT-34's own
defect depends on, so this run cannot say whether a clone elsewhere is
green. ACT-34 is still To Do. The milestone-level claim "a second person's
first run is clean" is not yet true; only ACT-30's own slice of it is.

## 3. What obstacles stand between here and the goal, and which one is next?

ACT-30 met no obstacle; it ran to a clean fix and a clean review. The
obstacle to the milestone is the one ACT-30's own card named when it split:
ACT-34 still blocks a second person from getting a green whole-suite run,
because the tool's only pipeline case points at a path outside the
repository. ACT-29 (leaked temp directories) is also still To Do on m-2 but
doesn't fail anyone's run, only litters their disk.

ACT-34 is the next obstacle, and it is already shaped: its card names the
real decision (whether a case may declare a target outside the repository,
and what a test should do when that target is absent) and already carries
three acceptance criteria.

## 4. What is the next step, and what do you expect from it?

Move ACT-34 next. Expect it to produce a whole `bun test` run that is green
on a machine with no sibling `nest/template`, plus a recorded decision on
whether an out-of-repo target is legitimate for a pipeline case at all. That
decision is the load-bearing part: doc-6 already flagged ACT-34 as the
load-bearing card of m-2, since an unrunnable pipeline case makes "a second
person runs their own benchmark" false regardless of what else in m-2 gets
fixed.

## 5. When can João go and see?

Now, for ACT-30's own slice: `rm -rf .benchmark-runs && bun test
src/benchmark/comparison-loader.test.ts` and `bun test
src/cli/rehearsal-cli.test.ts` both pass today. For the milestone-level
claim, not yet: that needs a real second machine, or at minimum this
machine with `nest/template` renamed aside, and it needs ACT-34 done first.

## Verdict

**On track.** The bet held: ACT-30's own fix is correct, reviewed, and
closed. Nothing here says m-2's goal or plan should change; the milestone's
next card (ACT-34) was already known and already shaped before this card
closed.

## Proposals for triage

- No card to add: ACT-34 already exists, already carries the decision this
  reflection points to, and is already on m-2.
- No card to close, split, or reorder. ACT-30, ACT-34, ACT-29 stand as
  doc-6 split them.

## Kaizen

- Process defect, one line: doc-6's queue line for ACT-30 stated a
  whole-suite outcome ("fails five tests") that the card's own scope never
  owned end to end; the split into ACT-34 was correct, but the original
  bet's wording invites reading ACT-30 alone as closing the milestone-level
  claim, which it does not.
