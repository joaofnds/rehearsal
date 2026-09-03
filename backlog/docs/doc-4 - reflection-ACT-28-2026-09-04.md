---
id: doc-4
title: 'reflection: ACT-28 2026-09-04'
type: other
created_date: '2026-09-03 23:35'
---

# Reflection: ACT-28, 2026-09-04

## 1. Target condition

Milestone m-0: "Deliver frozen skill bytes to a stage session, so a stage
comparison measures the corpus under test." ACT-28 is the whole of the goal;
no other open card is assigned to m-0.

The bet, from the card's own description and comment #1: a project-level
skill does not shadow a same-named user-level one on `claude 2.1.258`, so
every confirmation rep and replay ran its stage against whatever skill was
live at that moment while its lineage recorded frozen bytes. Comparisons
between corpus versions were the feature this broke, since both arms could
read the same live skill. The card's own recorded next step was to choose
between `--plugin-dir` and `--setting-sources` as the mechanism, and build
whichever one delivered frozen bytes for real.

## 2. Actual condition now

Fixed, reviewed, and independently reconfirmed this session, not just by
re-reading the card.

`pipeline-confirmation.ts` and `replay-confirmation.ts` now invoke a stage
session with `--setting-sources project` and install the frozen corpus
(skills, agents, output styles, whole per kind) at the worktree's
project-level `.claude`, not a bare skills directory claude never consulted
in isolation. `installStageCorpusSnapshot` clears each kind's target
directory before installing a new one, so a pipeline rep that reuses one
worktree across stages does not leak a prior stage's frozen agents or output
styles into the next stage's session, a gap the independent review caught
and a same-session fix and test closed.

The review flagged that the card's own claim of a direct marker observation
(AC1, AC3, AC4) was never independently re-run, only asserted by the author
who built the fix. I ran that check myself this session, on `claude
2.1.259` (one version ahead of the card's 2.1.258): a project-level skill
carrying a marker sentence, invoked with `--setting-sources project`, returned
the marker text verbatim and not the live user-level skill's content. That is
the first independent confirmation this exact claim has had. The wiring
suite (`checkpoint.test.ts`, 43 tests) also passes fresh this session.

So the target condition is met, not merely claimed: a stage session under
this mechanism now reads the frozen corpus, and the live-skill leak the card
exists to close is closed.

## 3. Obstacles and what's next

The review met one should-fix (cross-stage staleness) and fixed it in the
same pass. It surfaced one gap outside this diff's own correctness: under
`--setting-sources project`, a stage session also silently drops hooks and
`settings.json`, so it now diverges from a live session on more than the
corpus under test. That gap predates this diff and does not block it, but it
is real and open. Escalated during the build; João's answer was a
harness-owned settings file (permissions deny list, effort, output style,
feature switches, no hooks), filed as ACT-37, To Do, not on this milestone.

The next obstacle toward the milestone's own goal is not code, it's scope.
João's comment #5 on this card questions the direction the whole mechanism
took: running stage sessions locally against the operator's live Claude Code
install was meant to avoid per-machine setup drift, and this fix (like
ACT-37 behind it) is now compensating for that same drift one setting-source
at a project at a time. He names that this only covers Claude Code today,
and that adding other providers (Gemini, others) multiplies the same
problem. That is not a defect in ACT-28's own work; it is evidence that the
approach the milestone assumed (freeze corpus bytes into the local live
install) keeps generating follow-on cards of the same shape (ACT-37 now,
likely more per provider later).

## 4. Next step

Two things are ready to run independently:

- ACT-37 (To Do, high priority already set): build the harness-owned
  settings file. It is scoped, decided, and does not wait on anything else
  open. Expect: a stage session under `--setting-sources project` reads the
  declared settings file's effort/output-style/feature-switch values,
  observed once directly against a real claude invocation, same as this
  session's marker check.
- A decision from João, not a card yet: whether the corpus-freezing approach
  (local live install plus per-source-type settings shims) is still the
  right shape now that a second follow-on card (ACT-37) has appeared and a
  second provider is a stated future requirement. If the answer is "keep
  going," ACT-37 is next and the milestone is on track behind it. If the
  answer is "this needs a different mechanism" (e.g., a sandboxed or
  containerized session rather than local-install freezing), that changes
  what ACT-37 should build, so it should be settled before ACT-37 starts.

## 5. Where to go and see

The marker check is reproducible right now, without opening the app: a
project-level `.claude/skills/<name>/SKILL.md` with a distinct marker
sentence, invoked with `claude -p "invoke <name>" --setting-sources project`,
returns the marker text. I ran this today; the milestone's target condition
is observable on demand.

The cross-worktree staleness fix has its own test in `checkpoint.test.ts`
("removes a prior stage's agents and output styles the next stage's snapshot
does not carry"), runnable with `bun test src/benchmark/checkpoint.test.ts`.

## Verdict: adjust

The goal (frozen corpus bytes reach a stage session) is met and independently
verified this session. The plan behind it needs a look before the next card
starts: ACT-37 is the correct next step either way, but João's comment #5 is
evidence worth answering before committing further engineering to
compensating for local-install drift setting-source by setting-source,
provider by provider. This is not a pivot, because no evidence here says the
milestone's goal itself is wrong, freezing corpus bytes so a comparison
measures the corpus is still right. It is a question about how, which is
João's to answer.

## Process notes

- Process defect (kaizen candidate): the review recorded that AC1/AC3/AC4's
  direct-observation claim rested on the author's own unwitnessed note, and
  flagged it explicitly, but did not re-run it and closed with "proceed"
  anyway. A claim of direct observation that a review can't check against a
  tool result in the same review should not pass as verified; either the
  reviewer re-runs it or the verdict says the claim is unverified rather than
  silently accepting it. This session closed that gap by running the check,
  but the review process let a "proceed" verdict stand on an unverified
  observation claim.
- Structural opportunity: none beyond what the review already noted
  (`LAYOUT_DIRECTORY_KINDS` / `OVERLAID_KINDS` duplication, left as a note,
  no clear shared abstraction across the two genuinely different corpus
  mechanisms). Refactor already ran inside build; nothing new to add.
