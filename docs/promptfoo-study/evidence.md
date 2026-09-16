# Evidence, provenance, and coverage

This record supports the [Promptfoo study](../promptfoo-study.md). The study is
an assessment of specific revisions, not an evergreen feature inventory.

## Revisions and workspace

| Item                           | Recorded state                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Study date                     | 2026-09-16                                                                                                                                                                            |
| Promptfoo source               | Public Git clone, commit `e299e30c27d4da9c68c4a4e375ccfc332e78808a`                                                                                                                   |
| Promptfoo commit date          | `2026-09-16T12:28:23-07:00`                                                                                                                                                           |
| Promptfoo package              | `package.json` version `0.123.0`; this is the checked-out main revision, not a claim to have tested the published npm release                                                         |
| Rehearse source baseline       | `a8936af582b8ff5cdec660f9160b692f254f0451`, commit date `2026-09-16T21:00:50+02:00`                                                                                                   |
| Rehearse working tree at start | Clean tracked/untracked status; `main` 14 commits ahead of local `origin/main`; no remote refresh used to characterize that relation                                                  |
| Personal workspace             | A `backlog` symlink points to the maintainer's external board. It was consulted read-only. Public accepted roadmap documents support the study without requiring access to that board |
| Study changes                  | Documentation only: this study bundle and its documentation-index entry. Product code, fixtures, accepted vision, roadmap and board status were not changed                           |
| Probe environment              | macOS arm64, Node `v26.8.2`, npm `11.19.1`; Rehearse tests used pinned Bun `1.4.0` (`34cbb9a40`)                                                                                      |

Promptfoo dependencies were installed in a disposable clone with
`npm ci --ignore-scripts --workspaces=false --no-audit --no-fund`. Probes used the
source development entrypoint; it reports `0.0.0-development` because this was
not a release build. Temporary configs, databases and output lived outside
Rehearse. No dependency was added to Rehearse. The initial version invocation
performed an update check; later probe commands disabled update checks as well
as telemetry, remote generation and sharing. No model or commercial-service
execution was requested.

Promptfoo links are commit-pinned throughout. Rehearse links are relative so the
study travels with its source checkout; the baseline SHA above fixes their
interpretation. Because the baseline includes local commits ahead of the remote
tracking ref, this study does not assume a public GitHub URL for that SHA is
already resolvable.

## Evidence vocabulary

- **Executed:** a command ran in this study, with its scope and result below.
  Mocked/provider-free tests establish local behavior, not live-provider fidelity.
- **Inspected:** the cited implementation was read. Neighboring tests support
  interpretation, but count as execution only when listed below.
- **Documented:** an upstream or Rehearse document states the capability or
  intention; commercial claims remain in this category.
- **Inference / proposal:** analysis drawn from the above, including causal
  limitations, product value and prioritization. These are not measured benefits.

“Not found” is bounded to the named paths and feature, never proof of global
absence. Custom providers/hooks can add behavior beyond the built-in engine.
Third-party source instructions were treated as material to study, not as
instructions governing this task.

## Provider-free probes

The following configs are original study inputs. They contain no private corpus,
provider credentials or user transcripts. Run them from a disposable checkout
of the pinned Promptfoo source after the dependency installation above. A
separate `PROMPTFOO_CONFIG_DIR` prevents mixing records with an ordinary install.
The local command equivalent used for both was:

```sh
PROMPTFOO_CONFIG_DIR=/tmp/rehearse-promptfoo-probe/state \
PROMPTFOO_DISABLE_TELEMETRY=1 \
PROMPTFOO_DISABLE_REMOTE_GENERATION=1 \
PROMPTFOO_DISABLE_SHARING=1 \
PROMPTFOO_DISABLE_UPDATE=1 \
node node_modules/tsx/dist/cli.mjs src/localEntrypoint.ts eval \
  -c /tmp/rehearse-promptfoo-probe/config.yaml \
  --repeat 3 --max-concurrency 1 --no-cache --no-progress-bar \
  -o /tmp/rehearse-promptfoo-probe/result.json
```

### Probe A: repeated matrix, row evidence, and exit gate

```yaml
description: Rehearse study deterministic probe
prompts:
  - "{{value}}"
  - "prefix {{value}}"
providers:
  - echo
tests:
  - vars:
      value: alpha
    assert:
      - type: equals
        value: alpha
  - vars:
      value: beta
    assert:
      - type: contains
        value: beta
```

Observed result: **12 rows, 9 successes, 3 assertion failures, 0 errors, exit
100**, using the default pass-rate gate. The JSON included resolved config,
runtime options, prompt metrics, per-row grading, provider responses and failure
reasons. All token counts and costs were zero from the local echo provider; its
request count was 12. The unprefixed prompt passed six rows; the prefixed prompt
passed the three beta rows and failed the three alpha rows. This establishes
matrix/repeat/gate behavior, not model randomness or agent correctness.

### Probe B: aggregate threshold can compensate for a failed assertion

```yaml
description: Rehearse study aggregate threshold probe
prompts: [alpha]
providers: [echo]
tests:
  - threshold: 0.5
    assert:
      - type: equals
        value: alpha
      - type: equals
        value: beta
```

Used `threshold.yaml` and `threshold.json`, omitted `--repeat` and
`--max-concurrency`, and added `--no-table`. Observed **1 success, score 0.5,
component passes `[true, false]`, exit 0**. The config explicitly requests
aggregate gating. This supports keeping Rehearse's hard requirements distinct
from compensable dimensions; it does not show Promptfoo failing its contract.

## Focused execution checks

Promptfoo command, with the same disable controls and no paid provider calls:

```sh
node node_modules/vitest/vitest.mjs run \
  test/evaluator/repeatCache.test.ts \
  test/evaluator/replicate-cancellation.test.ts \
  test/evaluator/traceLinkage.test.ts \
  test/node/retry.test.ts --maxWorkers=2
```

**53 tests passed across 4 files.** Coverage includes per-repeat cache separation
and later cache reuse, Replicate cancellation handling, result/trace linkage, and
retry behavior with test doubles. In particular, the cancellation file tests a
Replicate path; it is **not** evidence of live Claude/Codex cancellation or OS
child-process termination. Native agent adapter behavior in the study remains
code-inspected.

Rehearse command:

```sh
mise exec -- bun test \
  src/benchmark/comparison-estimator.test.ts \
  src/benchmark/comparison-comparability.test.ts \
  src/benchmark/session-comparison.test.ts \
  src/benchmark/judge-agreement.test.ts
```

**61 tests passed across 4 files, 93 expectations.** They cover within-case
averaging and case-difference estimation, refusal of mismatched inputs and
contracts, retained failed/no-reply/missing-metric session evidence, malformed
record rejection, and calibration grouping. They use local fixtures. Passing
these tests does not validate an interval's statistical coverage, a live Judge,
or the current real-provider session comparison path.

Both test commands ran once successfully. Full application suites, UI builds,
paid runs and browser usability checks were outside this study. Documentation
link/reference and formatting checks are separate from these behavioral probes.

## Primary source map

The linked [architecture account](architecture.md) supplies pinned Promptfoo code
and documentation for each consequential claim. These are the main Rehearse
sources used to test the comparison against implementation rather than intent:

| Area                          | Rehearse source at the recorded baseline                                                                                                                                                          | What it establishes                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Product and evidence standard | [Vision](../vision.md), [research](../research.md), [status](../status.md), [architecture](../design.md)                                                                                          | Intended user, two loops, implementation limits and research interpretation                        |
| Public first use              | [README](../../README.md), [runbook](../runbook.md), [reference](../reference.md)                                                                                                                 | Supported recipe and environment/corpus boundaries                                                 |
| Frozen session inputs         | [session-confirmation.ts](../../src/benchmark/session-confirmation.ts), especially lines 79–154                                                                                                   | Refusal of unsupported global/skill delivery and capture of supported shared inputs                |
| Session execution/outputs     | [session-attempt.ts](../../src/benchmark/session-attempt.ts), especially lines 253–372 and 533–577                                                                                                | Temp fixture, transcript retention, deterministic grade, cleanup                                   |
| Rep scheduling                | [confirmation.ts](../../src/benchmark/confirmation.ts), line 174 onward                                                                                                                           | All requested plans dispatched via `Promise.all`                                                   |
| Reliability                   | [confirmation-report.ts](../../src/benchmark/confirmation-report.ts), lines 65–125                                                                                                                | Requested/attempted/failed counts, plug-in SE and `passK`, success eligibility                     |
| Paired estimates              | [comparison-estimator.ts](../../src/benchmark/comparison-estimator.ts), line 54 onward                                                                                                            | Case arm means followed by case-delta mean and SE                                                  |
| Comparability                 | [comparison-comparability.ts](../../src/benchmark/comparison-comparability.ts), [session-comparison tests](../../src/benchmark/session-comparison.test.ts)                                        | Controlled inputs and record/lineage validation                                                    |
| Judge validity mechanisms     | [judge.ts](../../src/benchmark/judge.ts), [judge-agreement.ts](../../src/benchmark/judge-agreement.ts)                                                                                            | Requirement consistency, supplied-source citation checks, harness overrides and agreement grouping |
| Worktree/replay boundary      | [pipeline-confirmation.ts](../../src/benchmark/pipeline-confirmation.ts), [replay.ts](../../src/benchmark/replay.ts)                                                                              | Frozen pipeline repetitions, checkpoint lineage and artifact checks                                |
| Timeouts/cancellation         | [command.ts](../../src/benchmark/command.ts), [run-abort.ts](../../src/benchmark/run-abort.ts), [config.ts](../../src/benchmark/config.ts)                                                        | Process-group kill, pipeline abort and configured session/command limits                           |
| Provider and context evidence | [claude.ts](../../src/benchmark/claude.ts), [context-evidence.ts](../../src/benchmark/context-evidence.ts), [session-history.ts](../../src/benchmark/session-history.ts)                          | Aggregate provider fields, normalization seam, source/request evidence and loss states             |
| Accepted work                 | [context roadmap](../context-visibility.md#accepted-roadmap), [integration roadmap](../context-visibility.md#integration-and-artifact-investigation), [prior study](../context-analyzer-study.md) | Existing homes for proposals and saved-before-live sequence                                        |

The existing research already motivates controls, paired comparisons,
reliability, Judge calibration and later optimization. The primary abstracts of
[Adding Error Bars to Evals](https://arxiv.org/abs/2411.00640v1),
[LLM-as-a-Judge](https://arxiv.org/abs/2306.05685v4), and
[τ-bench](https://arxiv.org/abs/2406.12045v1) were checked in this study. Their
experiments were not reproduced, and their reported findings are not treated as
validation of Rehearse's implementation. Detailed estimator selection needs
further methodological work under P2.

## Independent documentation review

The [review record](review.md) retains the independent reviewer's findings and
separate dispositions. Its scope is source and document accuracy; it does not
supply the unexecuted real-provider or usability evidence.

## Coverage and material gaps

| Requested area                                 | Depth and evidence                                                                                     | Remaining gap                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Positioning, target users, onboarding          | Repo/live primary docs and setup code; comparison to public Rehearse recipe                            | No user interviews or observed onboarding session                                          |
| CLI/config/workflows/datasets                  | Evaluator/schema/config/source reads; two CLI probes                                                   | External connectors and complex executable datasets not exercised                          |
| Browser/reporting/debugging                    | Result inspector, server, trace paths, setup/export documentation inspected                            | No visual/interaction usability evaluation; no claim of browser verification               |
| Evaluations/assertions/Judges                  | Aggregation, rubric/comparison matchers, thresholds, tests and probe                                   | No model Judge calibration corpus or live grader experiment                                |
| Experimentation/regressions                    | Repeat cache, stats, sampling, optimizer selection, CI/retry inspection; focused tests                 | No global proof that extensions/commercial services lack additional statistics             |
| Coding-agent state/isolation/artifacts/replay  | Claude SDK, Codex SDK/app-server implementations/docs and selected test reads; Rehearse execution code | No paid agent run, sandbox penetration test or full provider dependency audit              |
| Cancellation/concurrency/resources/reliability | Runtime/queue/timeout, scheduler, persistence, retry and Rehearse abort reads                          | Crash/disk-full/host load behavior not executed; descendant resource limits unverified     |
| Context/instructions/tokens/costs              | Skill metadata, usage normalization, tracing, Rehearse history/pricing seam                            | Exact model exposure and causal instruction cost unavailable from inspected evidence alone |
| Integrations/automation/extensibility          | Library/runtime boundary, hooks, MCP, CI and export sources                                            | Did not exercise all provider/connectors or deploy remote automation                       |
| Security/red teaming                           | Generator/strategy workflow, coding-agent guide, remote-generation selection and security policy       | Attack efficacy, model auditing and code scanning received survey depth, not a benchmark   |
| Hosted/commercial                              | Pinned enterprise docs plus live vendor page checked 2026-09-16                                        | No account, pricing/contract review, hosted run or on-prem deployment                      |
| Licensing                                      | Pinned MIT license and Rehearse license read                                                           | No vendoring proposed or dependency-by-dependency license audit                            |

Depth follows the instruction-experiment question. Media UI, RAG/retrieval
metrics, individual attack plugins, individual cloud connectors, code scanning
and model-audit internals are surveyed rather than comprehensively audited.
This study offers no comparative performance, usability, security certification,
or cost benchmark for either product.

The [proposal investigations](proposals.md#investigations-before-implementation-commitments)
identify the smallest next evidence needed. The remaining uncertainty is
substantive: real-provider fidelity, representative tasks, grader validity,
statistical decision quality, operating limits and user demand must be tested
before the corresponding benefits can be claimed.
