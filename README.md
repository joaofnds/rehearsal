# Template Agent Benchmark

This control repository runs a three-session workflow against a disposable clone of a separate target repository. It temporarily commits the backlog task and instruction corpus to the clone, runs a read-only Discuss session, supplies fixed Product Owner answers, runs a fresh Build session, checks the result, and grades the complete implementation diff with a separate judge session.

## Run

Install dependencies:

```sh
bun install
```

Run with full model IDs so repeated iterations do not silently move to a newer model:

```sh
bun run benchmark -- \
  --target /absolute/path/to/template \
  --model claude-opus-4-8 \
  --judge-model claude-sonnet-4-6 \
  --session-budget-usd 5
```

`--judge-model` defaults to `--model`. The equivalent environment variables are `BENCHMARK_TARGET_DIR`, `BENCHMARK_MODEL`, `BENCHMARK_JUDGE_MODEL`, and `BENCHMARK_SESSION_BUDGET_USD`. The budget applies separately to Discuss, Build, and Judge sessions.

The control repository must be committed and clean. The target must be a clean Git repository on `main`. The harness creates a disposable local clone at the captured source commit, removes its remote, and runs the agent directly on the clone's `main`. Baseline and treatment checks run with `CONFIG_PATH=src/config/test.yaml`. Completed assessments are recorded under `.benchmark-runs/` with the control and source identities; the disposable clone is deleted in a `finally` block, and the source repository is verified unchanged.
