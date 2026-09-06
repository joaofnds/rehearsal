---
id: ACT-88
title: halt a run in preflight when anything it needs is missing
status: To Do
assignee: []
created_date: '2026-09-05 23:59'
updated_date: '2026-09-05 23:59'
labels: []
dependencies: []
ordinal: 84008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Running a case whose declared target directory is absent halts before the first stage, naming the missing path
- [ ] #2 Running a case whose declared task, product brief, rubric, or pipeline file is absent halts before the first stage, naming the missing file
- [ ] #3 Running a case halts before the first stage when the requested model is unavailable
- [ ] #4 Running a case halts before the first stage when the declared session budget is absent or not a positive amount
- [ ] #5 Every preflight failure names what is missing and what would fix it, and no stage runs after one
- [ ] #6 A run whose every declared reference resolves proceeds unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Directed by João, 2026-09-06, split out of ACT-34:

'I think we should just halt. If the instructions are not clear on the benchmark, we should just not run the benchmark. And that means that before running anything, we need to validate the whole task. We should go to every referred path and instruction, and everything that we can check and check before even starting. In engineering we call this a pre-flight check. So basically what I'm saying is we should have a pre-flight check before starting a task. We should validate everything that we can necessary for the task to complete successfully, before even allowing to start the task. That also includes inputs, model selection, model availability, budget, etc...'

The model: a case declares a local directory that already exists when the run starts. Cloning is marketplace pre-work, outside the task. Nothing is fetched at run time and nothing skips. Anything missing halts.

Observed 2026-09-06, what exists today: assertControlReady (control repo committed) and assertSourceReady (target is a repo root, not the control repo, on main) in src/benchmark/target.ts, called from src/benchmark/run.ts:845 and src/cli/run-command.ts:310. These already halt on an absent or wrong target, so that criterion is partly met before this card starts. What is missing is a single gate: they run as part of the run rather than in front of it, they cover only the target repository, and nothing validates the other declared paths, the model, or the budget. A case declaration names task, productBrief, finalRubric, pipeline, rubrics, target.path, model, and sessionBudgetUsd (cases/audit-log/case.json).

Open for Shape: whether preflight is one gate for every command that starts work (run, replay, calibrate) or only run; and how model availability is checked without a network call the suite would depend on.
<!-- SECTION:NOTES:END -->
