---
id: decision-5
title: >-
  The design's task/step are UI labels for the code's pipeline/stage, mapped at
  one boundary
date: '2026-09-07 13:31'
status: accepted
---
## Context

ACT-48: `docs/design-handoff/SPEC.md`'s "Domain model" names four nouns — Step,
Task, Case, Run — that the codebase does not use the same way. GLOSSARY.md
already defines **Run**, **Stage**, **Pipeline**, and **Case**, and the
pipeline definition declares `stages`. The design's **Step** is the codebase's
**Stage**. The design's **Task** is close to the codebase's **Pipeline**, but
not the same concept: the design's Task carries a rule the codebase's Pipeline
does not — judged as a whole from the first input and the last artifact only,
never by averaging stage grades. Meanwhile **task** already names something
else in this project: a backlog card. Adopting the design's word for a second
concept would give "task" two meanings in one repository. Separately, the
codebase already has a field literally named `task` (the task/product-brief
markdown a pipeline case declares, in `case.ts` and
`pipeline-confirmation.ts`); that field is unrelated to either meaning and is
not renamed by this decision.

The design also introduces two terms with no glossary entry: a **task graph**
(the step-node visualization on the live monitor and run-detail screens, spec
§2c and §4c) and per-run **contribution** (one of the three run-detail
layouts, spec §4c). These are new concepts, not new names for old ones.

Two more open questions from the card's implementation notes:

- The design's **Case** (task + corpus + judges + thresholds) and the
  codebase's **Case** (task + product brief + rubrics + pipeline + target)
  overlap without matching term for term. Both are "what you actually run,"
  so the existing glossary entry for Case is amended rather than replaced.
- The codebase's **Attempt** has no design-side coinage to map: the design's
  own text already says "attempt" for the same thing (spec's core-loop
  sentence in the Overview, and the "ATTEMPTS AT CKPT-0147-S2" rail in §4a use
  "attempt" exactly as GLOSSARY.md already defines it — one execution of a
  stage at a checkpoint). No mapping is needed for singular Attempt.
- The codebase's **Rep** and **Confirmation run** do have a design-side word,
  found on a second pass: the design's plural "attempts" (`6 attempts`, `6
  paired attempts per arm`, the `×1/×3/×6/×12` replay-dialog control, spec
  lines 115, 258, 352) and its `group · 6 attempts` run-kind label (spec line
  115, and the Cases screen's **Run group** action, line 310) name what
  GLOSSARY.md already calls a confirmation run: a group of reps. This is a
  second Attempt/Rep boundary case the card's third open question did not
  separate from the singular one, and it does need the same treatment as
  Step/Task: keep rep and confirmation run in code, read plural "attempts"
  and "group" as the UI's words for them.

## Decision

The code, the records, and the glossary keep **run** and **stage**. The
design's **task** and **step** are presentation labels only, mapped at the UI
boundary:

| Design word (UI label) | Code word (glossary term) |
| --- | --- |
| Step | Stage |
| Task | Pipeline, with the task-judging rule below as an added constraint |
| Case | Case (glossary entry amended, not replaced) |
| Run | Run (same word both sides) |
| Attempt | Attempt (same word both sides; no mapping needed) |
| attempts (plural), group | Rep, Confirmation run |

This mapping is written once, in GLOSSARY.md, and each of ACT-50, ACT-51,
ACT-52, and ACT-53 carries a note pointing to this decision and GLOSSARY.md
rather than restating the table.

GLOSSARY.md gains:

- An amendment to **Pipeline** noting the task-judging rule the design
  requires when a pipeline is graded as a whole: the grade is computed from
  the first input and the last artifact only, never by averaging stage
  grades, and a pipeline that stopped early is not gradable as a whole.
- An amendment to **Case** noting the design's Case (spec: "task + corpus +
  judges + thresholds") and the codebase's benchmark case overlap without
  matching field for field: the case declaration pins task, product brief,
  final rubric, per-stage rubrics, pipeline, and target, but has no
  case-level `corpus` field (corpus is chosen per run by `--corpus`) and no
  case-level threshold field (a minimum grade lives inside stage grading, not
  on the case). The amendment records the overlap and the mismatch, not an
  equivalence.
- A new entry for **task graph**: the horizontal chain of stage-node cards
  (grade, status, live tool call, checkpoint, contribution phrase, in/out
  counts) shown on the live monitor and as "the map" on the run-detail
  Contribution layout. UI concept only; nothing in the harness computes or
  stores a graph.
- A new entry for **contribution**: one of the three run-detail layouts,
  which grades a run's outcome on its own from recorded evidence and then has
  an agent (not a deterministic computation) name a likely culprit stage
  among those that ran, disclosed as an opinion and never as a measurement.
  Provisional until the run ends; not an ablation, since ablation needs a
  rerun per node and is a separate planned feature.

## Consequences

Records stay readable under their existing words: 531 commits of run
artifacts, checkpoints, and rubrics never get touched by this decision.
"Task" avoids colliding with backlog cards.

The cost is real: the UI says "task" and "step," the CLI and code say "run"
and "stage," for the same thing. Every UI card carries this cost and pays it
by reading GLOSSARY.md rather than re-deriving the mapping.

The task-judging rule (grade from first input and last artifact only, never
averaged) is not new: the harness already grades a pipeline this way, from
`finalRubric` into a `finalOutcome` of `JUDGED`, `NOT_REACHED`, or
`NOT_APPLICABLE` (`src/benchmark/pipeline-confirmation.ts`,
`confirmation-record.ts`), independent of per-stage grades. ACT-50 and later
run-detail work read this existing record rather than building new grading
logic.

## Acceptance

João accepted this mapping on 2026-09-07, on the card's own terms ("for João
to accept or overturn"). The session that drafted it proposed it; the
acceptance is his.
