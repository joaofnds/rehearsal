# Promptfoo: product, architecture, and engineering tradeoffs

Part of the [Promptfoo study](../promptfoo-study.md). All Promptfoo code and
repository documentation links are pinned to `e299e30c27d4da9c68c4a4e375ccfc332e78808a`.
**Executed**, **Inspected**, **Documented**, and **Inference** have the meanings
in the [evidence record](evidence.md). Recommendations here remain proposals.

## Product and first use

**Documented.** Promptfoo serves developers testing prompts, models, RAG systems,
and agents, alongside security teams evaluating adversarial behavior. Its two
entry paths are an ordinary evaluation and a red-team scan. Both lead to a
configuration, execution, and a browser report. The ordinary quickstart offers
an example project, an interactive CLI, or `eval setup` in the browser; the
example makes the prompt/provider/test matrix visible before introducing more
configuration. This lowers the cost of making the first useful test.
[Introduction][p-intro], [getting started][p-start].

**Inference.** The reusable product idea is a short path from a concrete failure
to an inspectable test. Rehearse's smallest public session recipe serves this
purpose, but a coding engineer also needs evidence about the files produced.
A translation example or a tool-call assertion cannot demonstrate that a coding
instruction improved an implementation. Rehearse's next onboarding milestone
should exercise its accepted realistic-session work, rather than add a generic
model picker. See [P1](proposals.md#p1-complete-the-realistic-session-loop).

## How the pieces fit

```text
CLI / library / browser setup
  → resolve config, prompts, datasets, defaults, variables, hooks
  → enumerate permitted test × prompt × provider × repeat cells
  → scheduler + provider adapter + optional cache
  → provider output, metadata, usage, traces, errors
  → transforms → assertions / model graders → component and named scores
  → result store + exports
  → terminal matrix / browser drill-down / CI outcome / explicit sharing

Red-team generators + attack strategies → generated tests → same evaluation path
```

**Inspected.** The TypeScript evaluator owns matrix expansion, execution, and
scoring. Provider adapters implement a common call/response interface. A runtime
store interface separates evaluation operations from the Node persistence
implementation. The Node application stores results with Drizzle/libSQL; an
Express server and React browser expose them. Trace storage and blob/media
handling supplement result records. The architecture boundary configuration
still names legacy layers, so this is an evolving monorepo rather than a tiny
standalone evaluator. [Evaluator][p-eval], [store contract][p-store],
[database][p-db], [server][p-server], [layer rules][p-layers].

**Inference.** This architecture lets a new provider inherit assertions,
reporting, and automation. It also means the generic evaluator cannot guarantee
what an arbitrary provider did to a filesystem, remote application, or session.
Rehearse can borrow the separation between execution, evidence, grading, and
presentation while retaining its own checkpoint and comparison contracts.
Replacing its harness with Promptfoo would require rebuilding those contracts
around the provider interface; it is not an evidenced shortcut.

## Configuration, datasets, and extensibility

**Inspected / Documented.** A suite contains prompts, providers, tests or
scenarios, defaults, and optional derived metrics. Variable arrays expand into
combinations; provider/prompt filters constrain the matrix. Test data can be
inline or file-backed. The documentation covers YAML/JSON, JSONL, CSV, executable
JavaScript/TypeScript datasets, and external sources such as Google Sheets and
Azure Blob Storage. Defaults and assertion templates reduce duplication.
Transforms operate at different boundaries: provider normalization, test output,
and individual assertions. Lifecycle hooks can prepare and clean up application
sessions. [Schema][p-types], [configuration guide][p-config],
[configuration reference][p-config-ref].

**Inference.** Configuration is both data and a program. Scripts, transforms,
hooks, and custom providers make unusual systems testable, but broaden the set
of inputs needed to reproduce a result. A saved YAML file is insufficient when
it references mutable scripts, remote rows, installed skills, or environment
variables. Rehearse should expand authoring convenience only with a resolved,
versioned input manifest. Start with public fixture cases and immutable artifact
scorers; defer a large import ecosystem until actual users need it.

**Inspected.** Promptfoo exposes an MCP server with discovery, result inspection,
config validation, execution, generation, debugging, and sharing tools. This is
more than a read interface. Tool annotations distinguish mutating and read-only
operations, but annotations do not provide isolation. [Tool registry][p-mcp].
Rehearse already accepts bounded shared queries and a read-only MCP interface in
its [integration roadmap](../context-visibility.md#integration-and-artifact-investigation).
That work should remain the first agent interface; an execution tool would
need its own budget and authority contract.

## Grading and the meaning of a score

**Inspected.** Deterministic assertions, custom code, model rubrics, comparative
judges, and trace assertions coexist. Results preserve component verdicts,
reasons, named dimensions, and token usage. By default, an assertion failure
fails the test. An explicit numeric test threshold instead gates the weighted
aggregate score, allowing other scores to compensate for a failed assertion.
Custom scoring functions can replace aggregate behavior.
[Assertion aggregation][p-aggregation].

**Inspected.** Trajectory assertions match observed tools, sequences and arguments;
they require trace evidence. `agent-rubric` goes further than a text Judge: it
requires an agentic provider and can gather evidence with that provider's
configured tools and workspace. This can verify artifacts omitted from a final
reply, but makes the grader another execution with its own cost, permissions,
state and failure modes. Rehearse should prefer preserved, sealed evidence plus
bounded deterministic artifact checks first. A tool-assisted Judge would need a
separate immutable or disposable grading workspace and calibration contract.
[Trajectory assertions][p-trajectory], [agentic grading][p-agent-grader],
[agent-rubric documentation][p-agent-rubric-doc].

**Executed.** An `echo` row with one passing and one failing equality assertion,
plus `threshold: 0.5`, passed with score `0.5` and exit code `0`. This is intended
configurability, not evidence of a defect. It is unsuitable for requirements
such as “the protected tests were not modified” unless those requirements have
a separate noncompensable gate. [Probe B](evidence.md#provider-free-probes).

**Inspected.** The rubric grader can retain its rendered grading prompt and
parse structured pass/score/reason output. `select-best` supplies outputs in
existing order and interprets an integer winner; that path has no built-in
order reversal or tie/abstain verdict. A caller can build stronger procedures
around it. [Rubric processing][p-rubric], [comparison matcher][p-match].

**Inference.** The component evidence is worth adapting; a single composite
score is a poor headline for instruction experiments. Rehearse's sealed Judges,
citation checks, deterministic overrides, and calibration by exact model/rubric
already address important grading risks. A valid citation proves that the
referenced source was supplied, not that the Judge's interpretation is correct.
Any comparative Judge should blind labels, reverse presentation order, retain
disagreement and abstention, and keep absolute correctness gates. The existing
[Judge research](../research.md#calibrate-model-judges) remains relevant; these
procedures would still need validation on Rehearse tasks.

## Repeated trials, regressions, and reproducibility

**Inspected and tested.** Repeats produce separate cells. Promptfoo namespaces
cache operations by repeat index, avoiding the mistake of using repeat zero's
answer for every repetition. The repeat-cache tests also verify that a second
evaluation can retrieve the same per-repeat responses from cache. Consequently,
a rerun can be cheaper without being a new sample of agent behavior. Cache is
on by default in the CLI; `--no-cache` disables reads and writes.
[Repeat namespace][p-repeat], [cache tests][p-cache-test],
[CLI options resolution][p-cli-options].

**Inspected.** Seeded test sampling controls which cases are selected. It does
not establish a seed for model behavior. Core statistics count successes,
failures, errors, usage, and timing. The inspected evaluator, matcher, output,
and optimizer paths do not supply Rehearse's paired case-difference estimator
or enforce baseline/candidate/minimal-control arms. This is a bounded finding
about those paths, not a claim that a custom extension or commercial workflow
cannot do statistical analysis. [Sampling][p-sampling], [stats schema][p-stats].

**Executed.** A two-prompt, two-case, three-repeat local matrix produced twelve
rows, nine passes, three assertion failures, zero errors, and exit code `100`.
**Inspected.** The CLI's default pass-rate gate is 100%; errors remain in the
result denominator. JUnit distinguishes assertion failures from execution
errors. These are useful automation primitives, but a threshold on one run is
not an estimate of instruction effect. [Probe A](evidence.md#provider-free-probes),
[CLI gate][p-gate], [JUnit][p-junit].

**Inspected.** `retry` reruns error cells in the existing evaluation. Once the
retry operation completes and its results persist, it deletes the original error
rows even if a replacement cell is another provider error. An evaluation
exception or detected persistence failure preserves the originals. Resume skips
recorded completed cells. These choices help finish an expensive batch. They
require care when interpreting the final table as an account of all attempts
and their cost. Rehearse should preserve original attempts and
link retries as new evidence. [Retry implementation][p-retry].

**Inspected / Inference.** `optimize` generates candidate prompt rewrites from
observed outcomes and searches one selected prompt/provider pair. An optional
validation split reserves the tail of the explicit test list; validation scores
participate in candidate selection over rounds. This is useful search data,
not an untouched final test set. Ordering the cases can also skew that split.
The default searches the full suite and warns about the lack of validation.
Rehearse should borrow the failure-to-hypothesis loop before automated search,
then confirm any selected winner on independently reserved cases.
[Optimizer partition and selection][p-optimize], [optimizer CLI][p-optimize-cli].

## Running coding agents

The providers below are **code-inspected**, not exercised against live agents
in this study. Defaults are not guarantees about underlying runtime behavior.

| Boundary           | Claude Agent SDK                                                                             | Codex SDK                                                              | Codex app-server                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Working directory  | Empty temporary directory without `working_dir`; supplied directory otherwise                | Defaults to current directory; validates Git context unless overridden | Resolves supplied/current directory; starts its own app-server subprocess                                |
| Default access     | No tools without a directory; read tools with one; configurable permissions, sandbox and MCP | Forwards sandbox and writable-directory policy to SDK                  | Explicit defaults: read-only, no network, no approval prompts                                            |
| Conversation state | Fresh or configured resume/continue/session/fork                                             | Fresh, explicit resumed, or pooled threads                             | Ephemeral by default; configurable persistent threads and cleanup                                        |
| Concurrency        | Generic evaluator scheduling; no same-session queue found in this adapter                    | Serializes turns on reused threads; queued calls can abort             | Deduplicates thread setup, serializes same-thread turns, protects active threads from eviction           |
| Cancellation       | AbortController reaches SDK query                                                            | Abort signal reaches run/stream                                        | Sends `turn/interrupt`; startup/request/turn timeouts; request timeout closes uncertain connection       |
| Returned evidence  | Terminal result, tool inputs/results, skill calls, model usage, reported cost                | SDK turn/items, normalized usage, skill-read metadata, estimated cost  | Thread/turn/items, commands, file-change events, tool calls, server requests, optional raw notifications |

Sources: [Claude defaults and lifecycle][p-claude], [Codex SDK][p-codex],
[app-server][p-appserver].

**Inference.** Session resume, cached response reuse, and Rehearse checkpoint
replay solve different problems. Resume continues conversation history; cache
returns stored output; checkpoint replay restores source and upstream workflow
artifacts before a new stage attempt. The inspected provider implementations
and docs do not manage Rehearse-style worktree restoration and frozen stage
lineage. SDK file-checkpoint options and file-change events must not be mistaken
for a complete retained repository snapshot.

Promptfoo's coding-agent guide explicitly assigns setup/teardown to the caller
and recommends evaluating artifacts. Its coding-agent red-team guide also
distinguishes model failure, harness boundary failure, verifier tampering, and
cross-row contamination. This is relevant engineering guidance even without
adopting its security product. [Coding-agent guide][p-agent-guide],
[coding-agent security guide][p-agent-security].

**Inference.** Runtime adapters are useful references for abort propagation,
state reuse, and observable capability differences. Their scheduler limits
provider calls, not necessarily descendant tool processes, memory, disk, or
aggregate experiment spend. Rehearse needs a run-level policy above its provider
adapter. Container or VM execution would be a separate, larger bet, with
fidelity and portability costs. See [P3](proposals.md#p3-bound-execution-and-record-the-environment).

## Trajectories, instructions, tokens, and dollars

**Inspected.** Promptfoo associates OpenTelemetry traces with result rows and
supports provider instrumentation, external trace ingestion, span inspection,
and assertions about trace behavior. Its result detail component connects
prompt, output, grading, metadata, and traces. This gives an engineer a route
from a failed cell into the evidence behind it. [Trace linkage][p-trace-test],
[result inspector][p-inspector], [tracing guide][p-tracing].

**Inspected.** Claude usage aggregation prefers per-model `modelUsage`, which
includes child-agent work, over main-agent-only usage. It returns the SDK's dollar
total, but falls back to zero if that field is absent. Token absence is handled
separately. Codex SDK estimates dollars from model pricing. Raw and synthetic
span sources can overlap; the Claude adapter prefers native SDK spans when
available. [Claude usage][p-claude-usage], [Codex usage][p-codex-usage].

**Inference.** Useful totals do not establish dollars caused by a particular
instruction. Rehearse should retain provider-reported cost separately from
calculated cost, missing separately from zero, and direct separately from
descendant usage. Its accepted frozen-rate and request-identity work is a better
foundation for attribution than copying aggregate fields alone.

**Inspected.** Claude derives skill calls from the `Skill` tool. Codex skill
metadata examines command items and recognized `SKILL.md` paths, distinguishing
attempted from confirmed reads. Neither is proof of compliance, exact request
exposure, or marginal instruction cost. Deep tracing offers more protocol
activity at greater collection/startup cost; app-server disables connection
reuse for that mode. [Skill heuristic][p-skills], [app-server][p-appserver].
Rehearse's existing declared/observed/unknown distinctions should survive any
adapter or OTEL integration.

## Browser, automation, and operational reliability

**Inspected / Documented.** The CLI supports filtering failing cases, model
outputs supplied from disk, validation, watch mode, export, resume, and retry.
The browser includes result matrices and detail panels, configuration views,
evaluation setup, red-team setup/reporting, and media inspection. The Node
library, custom providers, CI integrations, and MCP make those capabilities
usable from several workflows. Browser usability and hosted collaboration were
not exercised. [CLI reference][p-cli], [result inspector][p-inspector],
[server][p-server], [CI guide][p-ci].

**Inspected.** Database code configures WAL and busy timeouts, serializes selected
operations, retries transient locks, and avoids retrying scripts that could
duplicate partial writes. Result storage exposes persistence-failure states.
These details matter for long batches: a provider success is not enough if its
evidence could not be retained. [Database][p-db], [store contract][p-store].
**Inference.** Rehearse should preserve authoritative attempt artifacts and
explicit incomplete records; adopting Promptfoo's database is unnecessary to
borrow these failure semantics. Neither a read-through nor passing unit tests
establishes crash durability under disk exhaustion or process termination.

## Security product and commercial boundary

**Documented / Inspected.** Red-team plugins generate classes of attacks;
strategies transform or iteratively pursue them; graders and reports interpret
target responses. This builds on the evaluation machinery while changing the
objective from ordinary correctness to adversarial failure discovery. The
repository also exposes code scanning and model-audit entry points, which
address additional security surfaces. Their effectiveness was not measured.
[Red-team quickstart][p-redteam], [generation/strategy orchestration][p-redteam-code],
[shared evaluation dispatch][p-redteam-shared], [CLI reference][p-cli].

**Inspected.** Coding-agent graders combine model rubrics with concrete verifier
evidence, including canaries, protected artifact expectations and sidecar reports.
That is a useful pattern for testing instruction trust and verifier integrity.
The CLI offers strict generation failure handling; without it, failed plugin
generation can leave coverage incomplete while the scan proceeds. A clean
report should therefore name generated versus requested coverage as well as
observed failures. This is a coverage requirement, not proof that the target is
secure. [Coding-agent verifiers][p-verifiers], [red-team run options][p-redteam-run].

**Documented.** Enterprise offers hosted and on-prem deployments, team access,
RBAC, and additional integration/reporting capabilities. The commercial page
marks some community functions quantity-limited. These are vendor claims,
not capabilities validated by inspecting an open-source checkout. The local
viewer is not the commercial collaboration service. [Enterprise comparison][p-enterprise].

**Inspected / Documented.** Local evaluation can still call model providers and
graders. Remote generation can be selected or used when local credentials are
unavailable; sharing uploads an evaluation snapshot. Telemetry, update checks,
remote generation, sharing, and cloud flows have separate controls. The security
policy treats configs, executable hooks, and local interfaces as trusted local
operations, not multi-user security boundaries. Read “local” as an execution
location, not a guarantee of no network transfer.
[Remote selection][p-remote], [sharing][p-share], [security policy][p-security].

**Inference.** Rehearse should adapt adversarial fixture design, protected
verifier checks, and explicit boundary evidence. A general red-team catalog,
compliance dashboard, hosted collaboration service, or scanner would serve a
different primary job and carry substantial maintenance cost. Those are
[deferred or rejected directions](proposals.md#ideas-to-defer-or-reject), not
missing parity requirements.

<!-- source references -->

[p-intro]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/site/docs/intro.md
[p-start]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/site/docs/getting-started.md
[p-eval]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/evaluator.ts#L2567
[p-store]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/evaluator/runtime.ts
[p-db]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/database/index.ts#L154
[p-server]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/server/server.ts
[p-layers]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/architecture/layers.json
[p-types]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/types/index.ts#L870
[p-config]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/site/docs/configuration/guide.md
[p-config-ref]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/site/docs/configuration/reference.md
[p-mcp]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/commands/mcp/lib/toolRegistry.ts#L112
[p-aggregation]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/assertions/assertionsResult.ts#L253
[p-trajectory]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/assertions/trajectory.ts
[p-agent-grader]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/matchers/agent.ts
[p-agent-rubric-doc]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/site/docs/configuration/expected-outputs/model-graded/agent-rubric.md
[p-rubric]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/matchers/rubric.ts#L866
[p-match]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/matchers/comparison.ts#L16
[p-repeat]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/evaluator.ts#L458
[p-cache-test]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/test/evaluator/repeatCache.test.ts
[p-cli-options]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/node/doEval.ts#L599
[p-sampling]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/util/eval/filterTests.ts#L321
[p-stats]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/types/index.ts#L485
[p-gate]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/node/doEval.ts#L1289
[p-junit]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/util/junit.ts#L235
[p-retry]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/node/retry.ts#L336
[p-optimize]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/optimizer/promptOptimizer.ts#L314
[p-optimize-cli]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/commands/optimize.ts
[p-claude]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/providers/claude-agent-sdk.ts#L304
[p-codex]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/providers/openai/codex-sdk.ts#L985
[p-appserver]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/providers/openai/codex-app-server.ts#L1411
[p-agent-guide]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/site/docs/guides/evaluate-coding-agents.md
[p-agent-security]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/site/docs/red-team/coding-agents.md
[p-trace-test]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/test/evaluator/traceLinkage.test.ts
[p-inspector]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/app/src/pages/eval/components/EvalOutputPromptDialog.tsx#L329
[p-tracing]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/site/docs/tracing.md
[p-claude-usage]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/providers/claude-agent-sdk.ts#L2162
[p-codex-usage]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/providers/openai/codex-sdk.ts#L2447
[p-skills]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/providers/openai/codexSkillMetadata.ts#L27
[p-cli]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/site/docs/usage/command-line.md
[p-ci]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/site/docs/integrations/ci-cd.md
[p-redteam]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/site/docs/red-team/quickstart.md
[p-redteam-code]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/redteam/index.ts#L594
[p-redteam-shared]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/redteam/shared.ts#L130
[p-verifiers]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/redteam/plugins/codingAgent/verifiers.ts
[p-redteam-run]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/redteam/commands/run.ts#L25
[p-enterprise]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/site/docs/enterprise/index.md
[p-remote]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/src/redteam/remoteGeneration.ts#L161
[p-share]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/site/docs/usage/sharing.md
[p-security]: https://github.com/promptfoo/promptfoo/blob/e299e30c27d4da9c68c4a4e375ccfc332e78808a/SECURITY.md
