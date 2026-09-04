---
id: ACT-39
title: replay one stage against an edited instruction and read the comparison
status: To Do
assignee: []
created_date: '2026-09-04 01:50'
updated_date: '2026-09-04 23:33'
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
<!-- SECTION:NOTES:END -->
