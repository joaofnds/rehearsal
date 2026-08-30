# Research

Published methodology relevant to the tool in [vision.md](vision.md), with the
implication each finding has for the design. Findings marked **adopted** are
reflected in [design.md](design.md).

## Context files: the closest published experiment

ETH Zurich built AGENTBENCH (138 real-world Python tasks from niche
repositories, four frontier agents including Claude Code with Sonnet-4.5) to
test whether `AGENTS.md`/`CLAUDE.md` files help
([paper summary](https://arxiviq.substack.com/p/evaluating-agentsmd-are-repository),
[DAIR.AI writeup](https://academy.dair.ai/blog/agents-md-evaluation)):

- LLM-generated context files degraded success on every benchmark tested.
- Human-written files helped only ~4% on average, concentrated in
  undocumented repositories.
- Context files added ~3.92 trajectory steps on average and over 20% inference
  cost per instance for some models, showing up behaviorally as excess
  exploration: more greps, file reads, and redundant test loops.
- Authors recommend manually authored files restricted to indispensable
  operational constraints.

Implications, all **adopted**:

- The no-corpus control arm is mandatory in every comparison, not opt-in
  (settles a PRD open question). Without it, the tool rewards verbosity.
- Cost and trajectory length are first-class metrics beside quality. An
  instruction that raises a score while bloating trajectories is a regression
  the report must show.
- Pruning is a goal equal to improvement. The literature says corpora
  over-accumulate; the tool must make removal as cheap as addition.
- LLM-generated instructions hurt _when unvalidated_. Machine-proposed edits
  are acceptable only through the same outer-loop confirmation as human edits.

## Variance and statistics

Anthropic's "Adding Error Bars to Evals"
([paper](https://arxiv.org/abs/2411.00640),
[summary](https://www.anthropic.com/research/statistical-approach-to-model-evals))
gives the reporting framework:

- Report CLT-based standard errors beside every mean score.
- When comparing two variants on the same tasks, use **paired differences**:
  per-task score deltas have far lower variance than independent comparisons,
  so the same confidence costs fewer reps.
- Cluster standard errors when scores within a group are correlated — for us,
  reps sharing a checkpoint are a cluster.

τ-bench introduced **pass^k** — the probability that all k trials succeed —
against pass@k, at least one of k
([paper](https://arxiv.org/abs/2406.12045)). The gap is dramatic (GPT-4o:
61% pass@1 vs 25% pass^8 on retail tasks). The broader literature reports no
universal rep count; 5 reps with mean and deviation is the common floor, and
single runs are explicitly called unrepresentative for multi-step agents
([reliability survey](https://arxiv.org/html/2602.16666)).

Implications, all **adopted**:

- Corpus A/B runs execute both variants from identical checkpoints and report
  paired per-task deltas, not two independent distributions.
- The headline metric for the unattended-workflow goal is pass^k, because the
  goal is reliability, not best-of-k capability.
- Default reps: 5 for confirmation runs; 1 is permitted only in the inner
  loop and is never presented as a score.

## Judge reliability

Converging practitioner guidance
([Deepchecks](https://deepchecks.com/llm-judge-calibration-automated-issues/),
[survey](https://futureagi.com/blog/llm-as-a-judge/),
[W&B](https://wandb.ai/site/articles/exploring-llm-as-a-judge/)):

- Validate the judge against human labels: collect ~100+ human-labeled
  examples per rubric, compute agreement (Cohen's kappa ≥ 0.6 acceptable,
  ≥ 0.8 strong); a judge below ~0.5 against humans means the rubric prompt
  needs rework. Re-validate on every judge-model swap.
- Known biases and mitigations: position bias (randomize or run both
  orderings), verbosity bias (length penalty in the rubric), self-preference
  bias (judge from a different model family than the worker).
- Rubrics: explicit criteria, correctness separated from style, rationale
  required — vague "rate 1–10" prompts are the documented failure mode.

Implications:

- **Adopted:** the judge model defaults to a different family or at least a
  different model than the workflow model.
- **Adopted:** calibration findings (`CAUGHT`/`MISSED`/`FALSE_POSITIVE`)
  already are human labels; the harness accumulates them into a running
  judge-vs-human agreement figure per rubric, so judge drift is measured, not
  suspected.
- Already current practice: deterministic checks preferred, rationale and
  citations required, non-compensating grades.

## Automated instruction optimization

GEPA (DSPy's reflective optimizer,
[ICLR 2026 oral](https://arxiv.org/abs/2507.19457)) evolves instructions by
reflecting in natural language on execution traces, keeping a Pareto frontier
of candidates. It beats RL-based optimization by ~6–20% with up to 35× fewer
rollouts and MIPROv2 by >10%.

Implication: the inner loop in [vision.md](vision.md) is GEPA performed by
hand, and everything GEPA needs — frozen inputs, execution traces, a scoring
judge, cheap replay — is exactly what the checkpoint/replay design produces.
**Adopted** as a design constraint, not a feature: keep the replay and judging
contracts machine-drivable so a reflective optimizer can later propose corpus
edits, which then pass the same outer-loop confirmation as human edits. Not
scheduled for any near phase.

## Ablation unit

Published prompt-ablation work operates on labeled sections and components
removed one at a time
([example methodology](https://arxiv.org/pdf/2601.02683)); nothing in the
literature supports line- or token-level attribution at individual budgets —
effects that small drown in run variance. **Adopted:** the pruning unit is
the logical block (an instruction bullet, a skill section), settling a PRD
open question.

## Prior art

[Promptfoo](https://www.promptfoo.dev/docs/configuration/expected-outputs/)
is the closest existing harness: YAML-declared prompts × providers × test
cases, `--repeat` for reps, deterministic assertions plus LLM rubrics, matrix
reports. It validates the shape of the comparison layer but operates on
single calls; no existing tool runs a staged SDLC pipeline with judged
transitions, checkpoints, and replay against a real repository. The staged
loop stays custom; promptfoo's assertion vocabulary is worth borrowing when
the deterministic-judge config is designed.
