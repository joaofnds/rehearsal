---
id: ACT-46
title: make both required run flags come from the case or a default
status: To Do
assignee: []
created_date: '2026-09-04 02:27'
updated_date: '2026-09-05 21:35'
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
Bet, 2026-09-05: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet.

Decisions, 2026-09-05 (Joao, both agreed):

1. Model: a case declares its model in case.json. --model and BENCHMARK_MODEL
   still override it, the same precedence the declared target already gives
   --target. Model already keys the lineage and the staleness comparison in
   checkpoint.ts, so the declaration reaches the record with no separate
   lineage change.

2. Budget (AC #3's recorded mechanism and reason): per-case declaration, not a
   global default. Documented runs span 0.2 USD (haiku session case) to 10 USD
   (sonnet full pipeline), a fiftyfold range. One flat constant would either
   starve a pipeline run or let a cheap session case overspend by that factor,
   so no single number is safe for all cases.

Scope note: six cases need values, not two. audit-log at 10, and smoke plus the
four brief-reply cases at a cheap budget, matching what README.md and
docs/runbook.md already print.

Both refusals come from parseSessionKnobs in src/benchmark/config.ts, called by
run, replay, and the session-case parser, so AC #1's single message naming
everything still missing has one place to live.
<!-- SECTION:NOTES:END -->
