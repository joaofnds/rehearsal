---
id: doc-59
title: Session skill benchmark scope
type: other
created_date: '2026-09-09 15:48'
updated_date: '2026-09-09 15:52'
---
## Goal and approval

Make the triage-skill experiment possible through Rehearsal: generate a board fixture with git history, run fresh sessions against skill variants, grade the resulting state, repeat and compare quality with cost, and correct graders without buying new sessions.

On 2026-09-09 João supplied the report "Rehearsal against today's use case" and asked for discussion before cards. After reviewing the proposed six-part breakdown he replied: "Yes, it matches pretty much what I want to pursue". The accepted breakdown covers frozen session skills, generated fixtures, preserved state and command checks, confirmation groups, session comparisons including a single case, and regrading. The discussion also identified transcript diagnostics and elapsed-time comparisons, reuse of ACT-90, and an advisory-only possibility for fixture identifier leakage.

## Report evidence and its limits

The supplied report describes nineteen deterministic board outcomes, six repetitions per variant, sixty sessions, and approximately USD 220. It reports three initially incorrect checks and two sessions spending six to eight tool calls repairing CLI ID collisions on backlog 1.51.0. These are the source session's measurements, not independently reproduced here; reproducing them requires that session's saved runs, fixtures and scorer, which are not attached. Do not present them as current measurements of this repository.

Repository inspection found that explicit directory corpus sources refuse declared skills, while live sources bypass the refusal without freezing their bytes. Session checks run before cleanup but accept only reply and transcript tool-use evidence. The working tree is removed, and NO_REPLY prevents all checks. The comparison estimator requires distinct cases and derives uncertainty across case means, so repetitions of one fixture need an explicit statistical treatment. ACT-140 now covers session confirmation groups and is reused.

Recheck commands, inspected 2026-09-09: `rg -n 'refuseDeclaredSkills|snapshotSessionCorpus' src/benchmark/session-corpus.ts`; `rg -n 'NO_REPLY|evaluateChecks|removeAttemptFiles' src/benchmark/session-attempt.ts`; `cat src/benchmark/session-lineage.ts src/benchmark/comparison-estimator.ts src/benchmark/comparison-quality.ts`. These locate current behavior rather than assuming the report's older line numbers remain valid.

Focused baseline validation on 2026-09-09: `mise exec -- bun test src/benchmark/session-corpus.test.ts src/benchmark/session-attempt.test.ts src/benchmark/session-check.test.ts src/benchmark/confirmation.test.ts src/benchmark/confirmation-record.test.ts src/cli/session-run-command.test.ts` returned 119 pass, 0 fail. No provider calls were launched for this assessment.

## Boundaries carried into the cards

Freeze the surrounding declared corpus and behavior settings consistently while varying one skill. A live corpus can supply the initial bytes, but a changing live installation cannot identify a fixed experimental arm. ACT-28 and ACT-37 provide prior mechanisms and settings decisions; test same-name installed skills and declared file-editing/CLI permissions on the session path.

Generated fixtures need a recorded realized starting state, including git history, rather than only the setup command. Preserve post-session evidence before a grader runs; a command can mutate its working directory, so each grading pass must leave the saved evidence intact. Completion status, state grades, and grader execution errors must remain distinguishable when a session exhausts its budget without a reply.

Report named checks and partial scores alongside whole-task success. Retain control arms and existing multi-case comparison guarantees; define single-case uncertainty without counting correlated checks or arbitrary repetition numbers as independent cases. A regrade identifies its check definitions and source evidence and preserves the earlier assessment.

## Ordering and remaining design

Capture these as To Do work, without changing milestone order or reprioritizing the existing queue. State preservation precedes regrading; bring regrading into use before expensive experiments. Confirmation execution and comparison reporting are separate tasks. A small generated board case and deterministic scorer should demonstrate the complete path once the capabilities meet; the original my.files harness is a useful reference if it becomes available, not a prerequisite.

Exact setup/scorer declaration formats, retention limits, and the single-case estimator remain implementation design work on the relevant cards. The cards record user-visible acceptance, not a completed build plan.

## Related work and deferred suggestion

ACT-102 and ACT-109 cover distributions and per-repetition grades for existing reports. ACT-105 concerns provider-duration aggregation; comparing total attempt elapsed time is separate and should preserve that distinction. ACT-123 concerns pipeline transcript capture; session diagnostics can begin with the session transcripts already retained. ACT-90 owns archived-ID reuse; attach the benchmark impact there and verify CLI-version behavior before reprioritizing it.

Fixture identifier matching may support an advisory check, but cannot prove contamination. It remains a note on the skill-delivery work. No automatic rejection rule is authorized by this discussion.

## Card map

- [ACT-143](<../tasks/act-143 - deliver-frozen-skills-to-session-cases.md>): skills.
- [ACT-144](<../tasks/act-144 - build-and-freeze-generated-fixtures-for-session-cases.md>): setup.
- [ACT-145](<../tasks/act-145 - grade-and-preserve-post-session-files-and-git-state.md>): checks.
- [ACT-146](<../tasks/act-146 - compare-session-experiments-including-a-single-case.md>): compare.
- [ACT-147](<../tasks/act-147 - regrade-preserved-session-evidence-without-another-model-run.md>): regrade.
- [ACT-148](<../tasks/act-148 - explain-session-tool-errors-and-repeated-commands-from-saved-transcripts.md>): diagnostics.
- [ACT-149](<../tasks/act-149 - carry-session-elapsed-time-into-comparison-reports.md>): elapsed.
- ACT-140: existing confirmation execution card, extended with frozen inputs, isolation and failure accounting.
- ACT-90, ACT-102, ACT-105 and ACT-109: related evidence and scope notes appended; existing priorities and dependencies retained.

ACT-146 depends on ACT-140, ACT-143, ACT-144 and ACT-145. ACT-147 depends on ACT-145 and can precede comparison work. ACT-149 follows ACT-146. ACT-148 uses existing saved session transcripts.

## Review and validation

Independent adversarial review found no blocking or should-fix findings. It left two notes: ACT-105 still calls a provider-duration sum wall-clock time in its existing criterion, and a no-skill control needs explicit coverage when a same-name live skill is installed. The first is recorded on ACT-105 for its shaping pass; ACT-143 now carries an acceptance check for the second. No second review round was needed: these dispositions clarify the recorded scope and do not claim an implemented behavior.

CLI readback verified schemaVersion 1, To Do status, unassigned new cards, unchecked sourced acceptance criteria, existing reference/document paths and acyclic new dependencies. Existing priorities and dependencies were retained. The supplied benchmark measurements remain attributed to the report rather than presented as reproduced results.
