# Research and evaluation methodology

These sources motivate Rehearsal's measurement choices. They do not prove that
an instruction helps on a particular repository. The [vision](vision.md) states
the project's evidence standard; [current state](status.md) identifies which
parts of that standard the implementation supports.

Sources checked on 2026-09-10. The choices below are Rehearsal's interpretation,
separate from each paper's reported findings.

## Evaluate instructions instead of assuming they help

[Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding
Agents?](https://arxiv.org/abs/2602.11988v2) studies generated and developer-written
repository context files. The revised paper reports that context files do not
generally improve success in its tested settings and increase inference cost.
It also distinguishes useful non-standard constraints from repository overviews.

For Rehearsal, this motivates a minimal-corpus control and reporting cost beside
quality. It does not establish that all instructions are harmful, nor that a
shorter corpus will perform better on every task. Pruning needs measurement too.

## Report uncertainty and pair comparisons by case

[Adding Error Bars to Evals](https://arxiv.org/abs/2411.00640) treats evaluations
as experiments and describes how to estimate uncertainty and differences between
models. Reusing the same tasks across conditions permits paired comparisons.

Rehearsal pairs arms by benchmark case, reports standard errors with means, and
retains unsuccessful repetitions. A few repeated attempts are useful for
exploration, but their variability and the diversity of cases limit the claims
a report can support. The default of five confirmation reps is a project
convention, not a universal statistically sufficient sample size.

## Measure repeated success

[τ-bench](https://arxiv.org/abs/2406.12045) introduces pass^k to measure whether
an agent succeeds consistently across repeated trials. That differs from
pass@k, which asks whether at least one trial succeeds.

Rehearsal uses reliability measures because an unattended workflow needs repeated
success. A best attempt is useful debugging evidence but cannot substitute for
the distribution of outcomes.

## Calibrate model Judges

[Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685)
examines model judging and biases including position, verbosity, and
self-enhancement. Its results concern the evaluated tasks and judges, not an
assurance of reliability for Rehearsal's rubrics.

Rehearsal prefers deterministic checks for directly observable outcomes. Model
Judges receive explicit rubrics and must cite supplied evidence. Human findings
support agreement summaries by exact Judge model and rubric contract. The CLI
normally chooses a different Claude model family from the worker; this is a
mitigation, not independence from provider-wide biases. Agreement counts and
sample sizes matter alongside Cohen's kappa; no fixed kappa threshold here
certifies a Judge as safe to trust.

## Keep room for automated proposals

[GEPA: Reflective Prompt Evolution Can Outperform Reinforcement
Learning](https://arxiv.org/abs/2507.19457) uses reflection on execution
trajectories to propose and evaluate prompt changes.

Rehearsal's inspect/edit/replay loop could supply inputs to a future optimizer.
This motivates machine-readable evidence and scriptable commands. Automated
optimization and ablation are not current features. Logical instruction blocks,
such as bullets and skill sections, are the intended pruning unit because they
produce interpretable edits; that is a design choice, not a proven universal
limit on attribution.
