---
id: ACT-88
title: halt a run in preflight when anything it needs is missing
status: Build
assignee: []
created_date: '2026-09-05 23:59'
updated_date: '2026-09-07 17:12'
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
- [ ] #9 A pipeline case whose declared settingsFile is absent halts before the first stage on a plain run, not only under --confirm or replay
- [ ] #10 A session case whose declared fixture, transcript prefix, or corpus file is absent halts before the session starts, naming the missing path
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
One gate function, called at the top of run, replay, and calibrate before any
stage or provider call, that walks every reference the loaded case (or, for
calibrate, the frozen record) declares and throws RefusedPreconditionError
(src/benchmark/exit-codes.ts) naming the first missing or invalid one and what
fixes it. Fail-fast on the first failure, not a collector.

Order of checks inside the gate: target readiness, then declared file reads
(task, product brief, final rubric, pipeline, per-stage rubrics), then budget
(already enforced by existing parses, so mostly a call-order guarantee), then
the model probe last, since it is the only one that costs anything (a
throwaway provider call).

Call sites: runRunCommand before dependencies.execute (run-command.ts:141),
runReplayCommand before dependencies.execute (replay-command.ts:136),
runCalibrate before buildJudges is invoked (calibrate-command.ts, right after
judgeKnobsOf(record) is computed since calibrate always runs under the frozen
judgeModel and takes no --model/--judge-model override).

New code: probeModelAvailable(model) runs `claude --model <model> -p 'hi'
--output-format json`, reads the result through readClaudeEnvelope
(src/benchmark/claude.ts:68), which already throws on is_error true using
envelope.result as the message — confirmed this session that the process exit
code is 0 on an unrecognized model, so the gate must read the envelope, never
the exit status.

Everything else the gate calls already exists (assertSourceReady, the file
reads in loadPipelineCase/loadStageRubric, parseSessionKnobs's budget check,
judgesFor's budget check for calibrate); the work is relocating the call ahead
of the first stage, and, for the file-read failures, wrapping the raw ENOENT
in a message that names the missing file and the fix, since AC #2 and AC #5
ask for that framing and today's failure is a bare filesystem error.

AC #6 (a fully-resolvable case proceeds unchanged) is the regression backstop:
every existing passing run/replay/calibrate test.
<!-- SECTION:PLAN:END -->

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

Shaped 2026-09-07. What already exists and needs no new check, verified by
reading the source this session:
- Target readiness (AC #1): assertSourceReady (src/benchmark/target.ts:39)
  already halts on an absent or wrong target with a named reason; it runs
  inside runBenchmark today (run.ts:848), after case loading. The gate moves
  the call earlier, it does not rewrite it.
- Declared file existence (AC #2, partly): loadPipelineCase (case.ts:357) and
  loadStageRubric (stage-grading.ts:263) already throw on a missing task,
  product brief, final rubric, pipeline, or per-stage rubric file (Bun.file
  ENOENT), before any stage runs. The gap AC #2/#5 close is message shape:
  today's failure is a raw filesystem error, not one naming the missing field
  and the fix.
- Budget presence and positivity (AC #4): parseSessionKnobs (config.ts:243)
  already refuses an absent or non-positive sessionBudgetUsd for run and
  replay. Calibrate reads its budget from the frozen record via judgeKnobsOf,
  and judgesFor already refuses an absent one (calibrate-command.ts:356).
  AC #4 is functionally met at all three call sites; confirm each message
  names the fix, not just the absence.

New work: model availability (AC #3, #7, #8) has no existing probe anywhere in
the codebase (checked). Everything else is relocation and message-wrapping,
detailed in the plan field.

Rejected during shape (restated from the direction above): a static
model-name list, and the /v1/models endpoint. Neither reopened.

Unknowns and how each was resolved:
1. Scope (run only, or run+replay+calibrate) — resolved by João 2026-09-07:
   all three, since replay and calibrate both spend under a declared model
   and budget and neither validates either today.
2. Model-availability mechanism — resolved by João 2026-09-07: a throwaway
   probe call, envelope-read, no static list, no /v1/models endpoint.
3. Fail-fast vs. collect-all preflight failures — not settled by the
   directive; resolved by João 2026-09-07 in this shape turn, on the
   recommendation given: fail-fast, since no aggregating-validator precedent
   exists in the codebase and AC #5 does not require exhaustive reporting.

Glossary: no new term. "Preflight" names the mechanism, not a concept of the
benchmarking domain, so GLOSSARY.md is left alone.

First test to write: a run-command test asserting that a case declaring a
target path absent on disk throws RefusedPreconditionError naming that path
before dependencies.execute is ever called (relocates today's deep
assertSourceReady behavior to a command-level assertion). Second: a model
probe test stubbing the claude CLI call to return is_error:true,
api_error_status:404 for an unrecognized model, asserting the same
halt-before-execute shape and exit code 3.

Adversarial review, 2026-09-07 (unprimed reviewer, read-only). Two findings
folded directly:
- The model probe's failure message must be wrapped the same way the file-read
  ENOENT is: readClaudeEnvelope's raw is_error message names the rejected
  model but not the fix, so AC #5 ("what would fix it") is not met by
  surfacing that message unwrapped. The gate wraps it, e.g. naming the model
  and pointing at re-declaring it or checking entitlement.
- AC #5's "no stage runs after one" is worded for run/replay; calibrate has no
  stage, only a rejudge. Read AC #5 for calibrate as "no rejudge/Judge call
  happens after a preflight failure" — the plan's call site (before
  buildJudges) already satisfies that reading, this is a wording note for
  whoever writes calibrate's test.

Two findings reopen scope rather than fold, both verified by reading source:
- settingsFile (case.ts:66, resolved at case.ts:347-355) is a declared
  reference on every pipeline case. The plain, non---confirm run path
  (executeRun -> runBenchmark) never reads or validates it at all today —
  only the --confirm path (run-command.ts:317) and replay
  (replay-command.ts:187) call loadStageSettings. It was absent from every
  existing AC and from this shape's checklist.
- Session-case declared references (fixture, transcript, corpusFiles,
  case.ts:76-86) sit outside every AC's wording, which is uniformly
  pipeline-shaped (target, task/productBrief/rubric/pipeline, budget, model).
  runSessionCase (run-command.ts:118-123) never walks these; a missing
  transcript is only caught deep inside session execution
  (session-attempt.ts:165-182), not preflight.
Neither is folded, because both change what "everything the case declares"
means and are not this session's call.
Two scope questions raised by the 2026-09-07 shape review are settled here rather than sent back, because the directive above already answers both. 'Go to every referred path and instruction, and everything that we can check' covers a declared settings file and a session case's declared inputs; excluding either would contradict the direction that created the card.

Verified 2026-09-07 against the source. settingsFile is declared optional at src/benchmark/case.ts:66 and resolved at case.ts:350-354, and it is checked only on --confirm and replay, so a plain run can start on an absent settings file. Session cases declare fixture (case.ts:76), transcript (case.ts:78), and corpusFiles (case.ts:82), and no acceptance criterion on this card covered any of them before AC #10, since every earlier criterion is pipeline-shaped. Both are now criteria, not open questions.
<!-- SECTION:NOTES:END -->
