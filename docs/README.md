# Documentation

Start with the [project README](../README.md) for the purpose and first commands.

## Working with Rehearsal

- [Runbook](runbook.md): setup, first experiment, repeated runs, and inspecting evidence.
- [Harness reference](reference.md): case inputs, corpus delivery, grading, records,
  replay, calibration, comparisons, and target restoration.
- [Current state and priorities](status.md): implemented features, known gaps,
  and useful contribution areas.
- [Contributing](../CONTRIBUTING.md): development checks and documentation upkeep.

## Understanding the project

- [Vision](vision.md): the problem, goals, evidence standards, and longer-term direction.
- [Context visibility](context-visibility.md): current evidence, gaps, and an accepted
  roadmap for understanding context growth and preserving quality at lower token use.
- [Architecture](design.md): current components and execution boundaries.
- [Glossary](../GLOSSARY.md): domain terms, including the UI's vocabulary mapping.
- [Research](research.md): primary sources behind the evaluation methodology.

## Design and historical references

[Design handoff](design-handoff/README.md) explains how to read the UI specification
and prototype. They show intended behavior beyond the implemented client. The
[original design prompt](ui-design-prompt.md) is an archived brief, not a feature list.

[Recovered sources](recovered/README.md) are fragments of an abandoned application.
They are not compiled, served, or used as the current architecture.

The [optional orchestration worker](../tools/orchestration/README.md) is for
externally dispatched maintainer tasks and is not required for experiments.

Files under `cases/*/fixture/` are benchmark inputs, including their READMEs and
agent instructions. Their text affects the experiments; they are not contributor
guidance for Rehearsal.
