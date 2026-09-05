---
id: ACT-46
title: make both required run flags come from the case or a default
status: Build
assignee: []
created_date: '2026-09-04 02:27'
updated_date: '2026-09-05 21:36'
labels: []
milestone: m-2
dependencies: []
priority: high
ordinal: 48008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A run refuses without both --model and --session-budget-usd, and no case declares either, so every invocation carries two flags the operator must know before anything works.

Observed 2026-09-04:

    bun run rehearsal run --case smoke
    exit 2, Provide --model or BENCHMARK_MODEL

    bun run rehearsal run --case smoke --model sonnet
    exit 2, Provide --session-budget-usd or BENCHMARK_SESSION_BUDGET_USD

Both refusals are individually correct: the model is part of what a run measures, and an unbounded budget is a real hazard. But together they mean the documented first command in the README does not run, and a new operator meets two consecutive exit-2 refusals before seeing the tool do anything.

A case already declares everything else about how it runs. The model belongs in the lineage, so a case declaring its model would also make two runs of that case comparable by default rather than by operator discipline. The budget could carry a conservative default, or be declared per case beside the model.

Filed after Joao pointed out he has never been able to run this tool himself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A run of a declared case starts with no flags beyond --case, or refuses with one message naming everything it still needs rather than one per invocation
- [ ] #2 A case can declare its model, and that declaration is part of the lineage the record carries
- [ ] #3 The session budget has a default or a per-case declaration, and the chosen mechanism is recorded on this card with its reason
- [ ] #4 The README and docs/runbook.md first-run commands are re-run after the change and work as printed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaped 2026-09-05.

Goal: a run of a declared case starts with --case alone; model and budget come
from the case declaration, with --model/--session-budget-usd/env still
overriding, same precedence --target already gives the declared target.

Open question for João, blocks one file's scope (replay-command.ts):
replay is named by --run, not --case, and today parses both knobs before it
resolves anything about the recorded run. The run directory does carry the
case id (attempt.caseId in run-layout.ts), so replay could load that case's
current declaration and default to its model/budget. But replay's staleness
check (checkpoint.ts deriveStaleness, ~line 453) exists to compare the
checkpoint's recorded model against the model the new replay requests --
defaulting to the case's *current* declared model makes that comparison live
every time budgets/models get bumped later, which may be exactly the point or
may be noise. Two options:
  a) replay also reads the case declaration and defaults from it, same as run
     (more consistent, touches replay-command.ts and parseReplayArgs)
  b) replay keeps requiring both flags explicitly, since it's already
     comparing against a frozen checkpoint and a silent default could compare
     against a moving target unintentionally (smaller change, leaves one
     asymmetry between run and replay)
No evidence backs either as safer; it's a product call about what replay is for.
Recommendation: (a), for consistency with run and because the override still
lets you pin the checkpoint's original model explicitly when you want the
frozen comparison.

Acceptance, restated as observations:
- `bun run rehearsal run --case smoke` (no other flags) starts and completes.
- `bun run rehearsal run --case audit-log` (no other flags) starts and completes.
- A run given neither flag and a case that declares neither still gets ONE
  error message naming both missing values (there is no such case among the
  six today, but parseSessionKnobs must not throw on the first missing knob
  and stop).
- `case.json` schema (src/benchmark/case.ts, caseDeclarationSchema) gains an
  optional model field on both the pipeline and session branches, and an
  optional sessionBudgetUsd field on both branches.
- Six cases get values per the card's scope note: audit-log at 10,
  smoke + the four brief-reply-* cases at the cheap budget already printed in
  README.md/docs/runbook.md (0.2).
- README.md and docs/runbook.md first-run commands (lines ~476-491, ~573-574,
  and runbook.md line 38/122) are edited to drop the now-unneeded flags and
  re-run as printed; runbook.md line 41's "both are required" line is rewritten
  to state the new precedence.
- Model still keys lineage/staleness with no separate change needed
  (checkpoint.ts already takes model as a plain field from SessionKnobs).

Where the fix lives: parseSessionKnobs (src/benchmark/config.ts:236) is the
one function both refusals come from; it needs a third argument carrying the
case's declared model/budget (undefined when the case doesn't declare them),
mirroring how parseArgs already threads caseDefaults.targetPath. Callers to
update: parseArgs (line 299, pipeline run), parseSessionArgs (line 351,
session run), parseReplayArgs (line 382, pending the open question above).

First test to write: parseSessionKnobs, given a declared model and no --model
flag and no env, returns that model instead of throwing (unit test in
src/benchmark/config.test.ts, no case.json fixture needed since the function
takes the declared values directly).

No new glossary terms; "declared" precedence for a knob already exists in
the glossary via CaseDefaults' target/pipeline pattern.

Replay decision, 2026-09-05 (Joao agreed): replay defaults model and budget
from the case declaration exactly as run does, with flags and env still
overriding. The shape session's warning that a later bump to a declared model
would silently change what an old replay compares against is wrong:
deriveStaleness (src/benchmark/checkpoint.ts:453) compares the recorded model
against the requested one and reports "model X is now Y" as a staleness cause,
so a bumped declaration surfaces rather than passing quietly. This closes the
open fork in the plan above; parseReplayArgs is no longer pending.
<!-- SECTION:NOTES:END -->
