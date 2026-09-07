---
id: ACT-88
title: halt a run in preflight when anything it needs is missing
status: Shape
assignee: []
created_date: '2026-09-05 23:59'
updated_date: '2026-09-07 16:54'
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
- [ ] #7 Replay and calibrate halt before spending anything when the model they would run under is unavailable, the same as run
- [ ] #8 The model check reads the CLI result envelope rather than the process exit code, which is 0 on an unrecognized model
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Directed by João, 2026-09-06, split out of ACT-34:

'I think we should just halt. If the instructions are not clear on the benchmark, we should just not run the benchmark. And that means that before running anything, we need to validate the whole task. We should go to every referred path and instruction, and everything that we can check and check before even starting. In engineering we call this a pre-flight check. So basically what I'm saying is we should have a pre-flight check before starting a task. We should validate everything that we can necessary for the task to complete successfully, before even allowing to start the task. That also includes inputs, model selection, model availability, budget, etc...'

The model: a case declares a local directory that already exists when the run starts. Cloning is marketplace pre-work, outside the task. Nothing is fetched at run time and nothing skips. Anything missing halts.

Observed 2026-09-06, what exists today: assertControlReady (control repo committed) and assertSourceReady (target is a repo root, not the control repo, on main) in src/benchmark/target.ts, called from src/benchmark/run.ts:845 and src/cli/run-command.ts:310. These already halt on an absent or wrong target, so that criterion is partly met before this card starts. What is missing is a single gate: they run as part of the run rather than in front of it, they cover only the target repository, and nothing validates the other declared paths, the model, or the budget. A case declaration names task, productBrief, finalRubric, pipeline, rubrics, target.path, model, and sessionBudgetUsd (cases/audit-log/case.json).

Both Shape questions are answered, decided by João 2026-09-07.

Scope: one gate in front of run, replay, and calibrate. All three spend money on a declared model and session budget, and neither replay nor calibrate validates either today (src/cli/replay-command.ts:146-162 reads model and sessionBudgetUsd from the declaration; src/cli/calibrate-command.ts:336-363 reads sessionBudgetUsd off the original record). The check is the same code at three call sites, so gating only run would leave the two commands used most during grading unprotected.

Model availability: probe the declared model with one throwaway CLI call, and maintain no model list, static or live. Observed directly 2026-09-07 by running `claude --model definitely-not-a-real-model-xyz -p 'hi' --output-format json`: the CLI returns is_error true, api_error_status 404, terminal_reason api_error, total_cost_usd 0, a result string naming the model, and prints a `[claude-code:unrecognized_model]` marker. The probe therefore costs nothing and catches both an unknown name and a model the caller is not entitled to, which a static list cannot do. Note the process exit code was 0, so the gate must read the envelope rather than the exit status; readClaudeEnvelope already throws on is_error (src/benchmark/claude.ts:70).

Rejected: a static list of model names (goes stale on a rename, misses entitlement) and the /v1/models endpoint (needs an API key the harness does not otherwise handle, and tells us less than the probe).

Not researched: how other eval harnesses solve model validation. A search found nothing documenting it. Nothing here depends on that answer.
<!-- SECTION:NOTES:END -->
