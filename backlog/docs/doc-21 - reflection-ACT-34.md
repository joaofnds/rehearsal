---
id: doc-21
title: 'reflection: ACT-34'
type: other
created_date: '2026-09-06 00:13'
---

# Reflection: ACT-34

## 1. What is the target condition?

ACT-34 belongs to m-2: a second person can run the benchmark on their own
machine. Doc-6 names ACT-34 as the load-bearing card of that milestone: the
tool's one pipeline case (audit-log) declared a target outside the repository,
so it could only run for João, on his machine, with his sibling checkout. The
bet was that after this card, `bun test` reports zero failures on a fresh
clone with no `nest/template` sibling, and no test in the suite depends on
something existing outside the repository.

## 2. What is the actual condition now?

Confirmed directly this run: `mise exec -- bun test src/benchmark/case.test.ts`
passes, 35 pass, 0 fail. The card's own record shows the same result on a
fresh clone placed where no `nest/` sibling resolves (`/tmp/deep/a/b/c/rehearsal`),
under the pinned toolchain.

The case declaration itself is unchanged: `cases/audit-log/case.json` still
points `target.path` at `../../../nest/template`, a directory outside the
repository. The bet held on the test suite, not on the case becoming portable.
Whether a second person can actually run the audit-log pipeline still depends
on them having that sibling checkout or a preflight that tells them clearly
that they don't. That question was split out, deliberately, to ACT-88.

## 3. What obstacles stand between here and the goal, and which one is next?

The run met two false starts before landing: an origin-URL design for
distinguishing absent-from-malformed targets, and a skip-based test, both
proposed and then rejected by João in favor of a plain rule — a case declares
a local directory that already exists when the run starts, and an unresolvable
one halts before any stage runs. That rule split the card into a test fix
(this card) and a runtime gate (ACT-88, To Do, 0/6 acceptance criteria, not
yet started).

The obstacle ACT-34 removed: a machine-dependent assertion in the unit suite,
which made the suite's pass/fail depend on where the checkout happened to sit.
That's gone.

The obstacle still standing for m-2: nothing yet halts a run cleanly when the
audit-log target is absent. A second person cloning this repo today and
running the pipeline case gets whatever raw error the filesystem produces, not
a preflight message naming what's missing. ACT-88 is that card, and it's next.

## 4. What is the next step, and what do you expect from it?

ACT-88, as already shaped: a preflight gate that runs before the first stage
and checks every declared reference (target directory, task/brief/rubric/
pipeline files, model availability, session budget), halting with a message
naming what's missing rather than letting a stage fail partway through.
Expect it to make "a second person clones this repo and runs the audit-log
case without the sibling checkout" fail loudly and immediately, with a
message they can act on, instead of failing silently or with a raw ENOENT.

Two other m-2 cards are already Done (ACT-30, ACT-46); one is still open
(ACT-29, the temp-directory leak) but is not load-bearing for whether a
second person can run the tool at all, only for their first-run experience.

## 5. When can João go and see?

Now, for the test fix: `mise exec -- bun test` on this checkout, or on a
fresh clone with no `nest/` sibling, reports zero failures. That's verified
this run.

Not yet for the runtime gate: ACT-88 hasn't been built, so running the
audit-log case without the sibling checkout still doesn't halt cleanly. That
becomes checkable once ACT-88 ships: run the case from a clone with the
target directory renamed or missing, and read the halt message.

## Verdict

**On track.** The bet held: the suite no longer depends on machine state, and
the split into a test fix and a runtime gate (ACT-88) is a scope correction
mid-card, not a change to m-2's goal. The next step continues straight at the
milestone's remaining gap.

## Proposals

- No card to add: ACT-88 already exists and already carries the right
  acceptance criteria for the next step.
- No card to close.
- Recommend ACT-88 be picked up next on m-2, ahead of ACT-29, since ACT-88 is
  load-bearing for "a second person can run the benchmark" and ACT-29 is not.

## Kaizen candidate

This card round-tripped through two rejected designs (origin-URL, skip-based
test) before João's direction settled it in one sentence each time. Both
rejections came from João naming a requirement the session had invented
without one (a remote-clone workflow, a skip mechanism). One line for kaizen:
when a design choice implies a new capability (cloning at task time, a new
declaration field), check whether anything actually requires it before
building toward it.
