---
id: ACT-39
title: replay one stage against an edited instruction and read the comparison
status: Build
assignee: []
created_date: '2026-09-04 01:50'
updated_date: '2026-09-04 23:56'
labels: []
milestone: m-1
dependencies:
  - ACT-38
  - ACT-41
priority: high
ordinal: 41008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The loop the tool exists for, run once: take a checkpoint ACT-38 recorded, change one instruction in the corpus, replay that one stage against the changed corpus, and read the comparison between the two attempts.

This is the inner loop from docs/vision.md and the reason the project exists. Every piece is built (replay, lineage, staleness, comparison reporting) and none has carried a real corpus edit.

Pick an edit whose effect is arguable rather than obvious, so the comparison has to do work. What matters is whether the operator can answer 'did that edit help' from what the tool prints, without reading the raw transcripts.

Depends on ACT-38: there is no checkpoint to replay until a run has recorded one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The shape stage passes its judge once and records a stage checkpoint
- [ ] #2 One stage is replayed from that checkpoint against a corpus with exactly one instruction file changed
- [ ] #3 `rehearsal stale` reports the checkpoints that edit invalidated, before the replay runs
- [ ] #4 The question 'did that edit improve the stage' is answered on this card from the two attempt records, with the sentence that answered it quoted, or recorded as unanswerable with what was missing
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Bet, 2026-09-04: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet.

Oversight probes, 2026-09-05 (iterate session). Both of the shape agent's blocking claims were checked directly and both hold.

No stage checkpoint exists. Both recorded runs' checkpoint directories contain only `initial`; neither holds a shape checkpoint. Both runs ended `STAGE_JUDGE_FAILED`. So acceptance criterion #1 is not reachable today: there is nothing to replay a stage from.

Correction to the stage's cost figure: the two failed attempts cost 0.4304 and 0.5278 USD, 0.958 USD together, not 0.43. The stage quoted one run's cost as if it were both.

`compare` cannot produce a report over two attempts. The report schema in src/benchmark/comparison-record.ts requires cases min 2 (line 311), reps min 2 (line 310), caseDeltas min 2 (line 170), and comparison-loader.ts loads three arms per case with control mandatory (lines 314-326). Acceptance criterion #3 as written cannot be satisfied by a replay pair; it needs a second benchmark case and full confirmation groups.

Card left in To Do pending João's two calls.

Reshaped 2026-09-05 at João's direction, after the probes above.

Two calls answered yes. Fix the two shape-judge findings first, then pay for one clean shape pass to get a checkpoint worth replaying. The full `compare` path is split onto ACT-69 with its own budget.

Acceptance criteria restated to match. The old criterion #3 (`rehearsal compare` produces a report over the two attempts) moved to ACT-69, because the report schema cannot express a two-attempt comparison. Reading the two attempt records directly is what answers the card's question now.

The card's own order of work: fix the corpus defects, run shape once, confirm a checkpoint landed, edit one instruction, check `stale`, replay, read both records.

Oversight probes, 2026-09-05 (second shape step). The stage was right that the corpus is clean and wrong that the evidence is gone.

Corpus is clean, confirmed. cases/audit-log/product-brief.md states 202 once and states all three validation rules (trimmed, non-empty, non-null JSON object not an array). cases/audit-log/rubric.md agrees. No 201 anywhere in cases/audit-log/. So criterion #1's wording, 'fixed in the corpus', is wrong.

The shape agent's output is NOT gone. It survives in the failed run artifacts under input.taskState and input.transcript.exchanges. Both defects are readable there right now.

The 201/202 contradiction is in run 2026-09-04T02-09-23.870Z's shaped card, acceptance criterion #1: 'returns 201/202 without the row existing in the database yet'. The brief settles 202.

The dropped validation rules are in the same card's criterion #2: 'actionType or resourceName missing or not a string, or details not a JSON object'. That drops trimmed and non-empty for the two strings, and drops 'not an array' for details.

The second run (17-34-35) shaped a clean card: 202 throughout, all three rules stated. It still graded F, so its failure has a different cause, and the judge's reasoning is what the artifact does not keep. Run 2 also self-reported editing the task file directly instead of through the CLI, which is ACT-64's defect.

So the real gap is that STAGE_JUDGE_FAILED keeps status, stage, a one-line error, and the input, but never the judge's findings. That is what makes run 2's failure unexplainable.

Criterion #1 removed 2026-09-05. It directed a fix at the corpus, and the probe showed the corpus already says the right thing. There is nothing there to fix. The defects belonged to one run's output, and a fresh run either repeats them or does not.

The card now starts by paying for one shape run. ACT-70 carries the judge-findings gap, so a second failure would at least be diagnosable.

Moved to Build 2026-09-05 by the iterate session. The shape step asked whether to hand off to build or wait for budget approval; João had already approved the paid run, so the question was already answered and the card moved rather than re-asking.

Budget for the shape run: 1.50 USD cap, about triple the prior attempts (0.4304 and 0.5278).

Precondition checked before spending: template-postgres-1 is up and healthy on 5432, which ACT-38's handoff named as required.

Paid run attempted and not made, 2026-09-05. Two routes tried, both closed, recorded so the next session does not repeat them.

The build stage proposed either a shape-only pipeline or killing a full run mid-flight. It recommended killing the run. That is the wrong one: a killed run leaves no checkpoint, which is the whole point of the run, and ACT-38 already recorded a stopped run confusing 'list runs' (ACT-44).

The shape-only pipeline route is closed by the schema. src/benchmark/pipeline.ts:217 requires a pipeline to declare exactly one delivery stage, and :227 requires it last. A planning-only pipeline is rejected. --pipeline is a real flag and cases/audit-log/pipelines/ is built to hold alternatives, so the idea was sound; the constraint is that every pipeline must end in delivery.

--session-budget-usd is per session, not per run. ACT-38 passed 4 and the whole run cost 0.43 because it stopped at the shape judge. So there is no flag that bounds a run's total spend.

Consequence for the budget: the 1.50 USD cap cannot be enforced by the tool. If shape fails again the run stops at the judge and costs roughly what the prior two did. If shape passes, the build stage runs and spends materially more, which is beyond what was approved.

Also confirmed before spending: template-postgres-1 up and healthy on 5432. The prior runs used --model sonnet --effort medium, per ACT-38's note; the failed artifacts do not record the model, which is worth its own card.

Unblocked by: João naming a total he accepts for a run that may include the build stage.

Budget approved 2026-09-05: 10 USD total for the run, explicitly covering the build stage if shape passes. Per-session cap set to 3 USD, since the tool enforces only per session and the run has several sessions plus judges. Total is watched, not enforced.

Paid run made 2026-09-05. Record: .benchmark-runs/2026-09-04T23-53-48.458Z.shape.json. Cost 0.4533 USD, well under the 10 USD approved. Command: rehearsal.ts run --case audit-log --model sonnet --effort medium --session-budget-usd 3.

Result: shape graded F again, third failure. No checkpoint recorded, so acceptance criterion #1 is still unmet and the replay still cannot happen.

The cause is now known and it is not the corpus. The only failing hard blocker is invalid-stage-delivery, from harness validation reporting 'Target baseline changed unexpectedly'. Every other hard blocker passed, including contradicts-source, whose evidence explicitly confirms the recorded validation rules match the brief. The 201/202 and dropped-rules defects from the first run did not recur.

This is ACT-64 reproduced. That card's single acceptance criterion is precisely a shape stage completing without this harness failure, so ACT-64 now blocks ACT-39.

Quality without the blocker would have been B across all four dimensions, which is the minimum grade. So the stage is one harness defect away from passing.

ACT-70 verified live, which was the open item on that card. The artifact now has eight keys (status, stage, error, input, hardBlockers, requirements, dimensions, summary) where the two prior failed runs had four. The judge's findings, including the blocker's evidence, were readable straight from the artifact with no re-run. That is what made this diagnosis possible at all.
<!-- SECTION:NOTES:END -->
