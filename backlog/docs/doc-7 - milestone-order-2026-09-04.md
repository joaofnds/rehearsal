---
id: doc-7
title: milestone-order-2026-09-04
type: other
created_date: '2026-09-04 14:40'
---

# Milestone order, 2026-09-04

Written at the end of the session that produced the design handoff and
decisions 2 and 3, while the reasons were still in hand. It sets the shape and
the order. It does not re-verify card premises, which is the fresh triage's job
and is deliberately left undone here.

## What changed today

The board was ranked this morning against a goal that had just been met, and
three things happened after that ranking:

1. The first real pipeline run (ACT-38) executed and produced five defects.
2. A design handoff arrived: nine screens specified in text, with product rules
   and an exact token set (`docs/design-handoff/SPEC.md`).
3. The stack was decided (decision-3) and the design-system rule was set
   (decision-2).

The open set went from 9 cards to 23.

## Every milestone ships something usable

João's constraint, stated while this document was being written: small batches,
each building on the last one's learning.

The first draft of this failed that test. It had one UI milestone of six cards
ending in "the UI is done", which is a big-bang release wearing a milestone's
name: no feedback until the end, and by then every screen is built on
assumptions nobody tested.

So the UI is three milestones, each ending at something João can open and
judge, and each deliberately small enough that its lesson arrives before the
next one starts.

## The order

**m-1 — Prove the loop once.** Still first, and still unproven.

The tool has never answered its own question. ACT-38 ran a pipeline; ACT-39,
which edits an instruction and reads the comparison, has never run.

ACT-41 is the gate. The harness installs its own `CLAUDE.md` into the target as
the target's project instructions, so a pipeline agent is told it is working in
a Bun harness while sitting in a NestJS app. Every pipeline score is
untrustworthy until that is fixed, so a comparison built on one proves nothing.
ACT-39 now depends on it explicitly rather than by implication.

ACT-43 moved here from m-3: a loop that understates its own cost cannot answer
whether an edit was worth paying for.

Order: **ACT-41 → ACT-39**. ACT-42, ACT-43, ACT-44 are independent.

**m-5 — See one screen of real data, and say what is wrong with it.**

The smallest thing that puts a working screen in front of João. Vocabulary
settled (ACT-48), the data gap inventoried (ACT-49), the design system built
(ACT-52), and the stack wired end to end on run history (ACT-53), with ACT-40
fixing unreadable-record rendering in the shared read path so CLI and UI get it
together.

It ends with one screen, real records, and João's reaction. That reaction is
the input to m-6 and m-7, which is the whole reason it comes first rather than
being folded into a larger UI push.

Order: **ACT-48 → ACT-52 → ACT-53**, with ACT-49 alongside.

**m-6 — Watch a run spend money while it happens.**

The screen João named as deserving the most design effort, and the one with no
data behind it. ACT-26.7 gets harness progress off stdout; ACT-51 gives run
state somewhere to live and something to read it.

Deliberately after m-5, because it is the largest harness change in the UI work
and should be built by someone who has already seen the wiring hold.

**m-7 — Read a comparison and decide whether an edit helped.**

Comparisons plus the corpus screen that says what an edit invalidated (ACT-50,
narrowed from six screens to these two). This is the product's own question
rendered, and it is last of the UI three because it is the one that most needs
real recorded comparisons to build against, which m-1 produces.

Run detail, tasks, cases, and calibration are not carded yet. Filing them now
would be planning four screens against a design nobody has used. They come
after m-5 reports.

**m-2 — A second person can run it.** After the UI three.

Everything here is measured and none of it blocks the above. It matters the
moment anyone else touches this, and not before.

**m-3 — Tell improvement from noise.** Last.

The milestone that makes results trustworthy at scale. Right to be last: the
tool has to produce results before their reliability is the binding constraint.

## Cards placed this run

| Card | Was | Now | Reason |
| --- | --- | --- | --- |
| ACT-40 | no milestone | m-5 | The design settles how an unreadable record renders; fixing it in the shared read path serves CLI and UI together |
| ACT-26.7 | no milestone | m-6 | Decision-3 puts run events behind a stream; this gets harness progress off stdout so ACT-51 can land on it |
| ACT-43 | m-3 | m-1 | The design shows the judge's cost as a number the operator reads, and a loop that understates cost cannot price an edit |
| ACT-52 | m-1 | m-5 | Design system work, misfiled when created |
| ACT-48, ACT-49, ACT-53 | m-4 | m-5 | The first shippable slice |
| ACT-51 | m-4 | m-6 | Its own milestone, since it is a harness change before it is a screen |
| ACT-50 | m-4 | m-7 | Narrowed from six screens to comparisons and corpus |
| ACT-39 | — | — | Now depends on ACT-41, which was true in fact and not on the card |

ACT-27, ACT-31, and ACT-37 stay unassigned deliberately. The first two are
refactors that serve any goal equally; ACT-37 waits on João's open question
about whether local-install corpus freezing survives a second provider.

m-4 was the single UI milestone this document split into m-5, m-6, and m-7. It
is now empty and the CLI therefore lists it as completed, which is an artifact
of it having no cards rather than a claim that any UI shipped. Nothing in m-4
was ever built.

## What this document does not do

It does not re-verify a single card's premise. Every count, path, and claim on
the 23 open cards is as its writer left it, and several were written before
today's decisions. That check is the fresh triage's, and it should be run by a
session that did not make this session's mistakes: seven duplicate cards were
filed here before being caught and archived.
