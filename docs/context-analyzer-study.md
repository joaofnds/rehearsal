# Lessons from context-analyzer

Study dated **2026-09-14**. External source:
[context-analyzer at `2c9e446`](https://github.com/manavgup/context-analyzer/tree/2c9e44682483531c8ba14df5f0d5d7703e4341a7).
Rehearsal baseline: `3765612a39b84aea0cc4239b4a456ccd59114ab8`.
This is a source-code assessment and a set of recommendations. Their accepted
delivery homes are recorded in the [context roadmap](context-visibility.md#integration-and-artifact-investigation);
detailed implementation design remains on the delivery cards. No external project code, hooks, installers, tests, or
compressors were executed. Runtime compatibility and achievable savings remain
unverified. “Cloud code” in the request is interpreted as Claude Code, the
integration implemented by the linked project.

## Recommendation

Borrow the collection and investigation patterns. Rehearsal should connect its
existing evidence normalizer to retained request usage, then let an operator move
from a request's context growth to the tool results, instructions, and agents
behind it. Add an integration breakdown, inspectable multimodal artifacts, and
a bounded analysis API that agents can query. Keep Rehearsal's controlled
quality comparisons as the test of whether an optimization helps.

Context-analyzer's main contribution is a working set of inspection mechanisms:
Claude Code hooks, transcript parsers, SQLite projections, linked charts,
subagent views, and an MCP query surface. Most of its “insights” are deterministic
rules, ratios, and regressions. It does not establish which information a model
used internally or whether deleting a block preserves task quality. Its optional
Headroom experiment is a separate compression analysis path.

Its inspection unit is a session record or delivered content block. Repository
semantics enter through recorded tool results; repository indexing, symbol
graphs, and semantic retrieval would be separate work. The transferable core
here is execution observability and evidence navigation.

Rehearsal already has more of the required foundation than the September 11
[context assessment](context-visibility.md) suggests. Current implementation has:

- [Saved history](../src/benchmark/session-history.ts): ordered tool calls and
  results, source classification, repeated deliveries, recorded excerpts,
  source locations, and inherited/attempt/unknown boundaries.
- [Provider normalization](../src/benchmark/context-evidence.ts) and its
  [contract](../src/benchmark/context-evidence-contract.ts): request joins,
  lineage, instruction loads, compaction signals, coverage/conflict states,
  and model-specific pricing with a persisted rate catalog.
- [Optional attempt persistence](../src/benchmark/session-attempt.ts) for a
  supplied provider bundle. The shipped execution path does not collect that
  bundle, and saved history does not yet expose its request measurements.
- [Comparison resources](../src/benchmark/comparison-resources.ts) and
  [confirmation](../src/benchmark/session-confirmation.ts), which provide a
  way to test resource reductions against outcomes.

The first gap is the path from retained transcript usage to ordered requests to
the operator's view. Richer collection can follow. Replacing these foundations with context-analyzer's
database would lose useful evidence distinctions.

Three concrete seams matter. `requestUsageState` currently returns missing when
there are no OTel logs, even if transcript usage exists. Normalized requests are
sorted by qualified ID and lack a first source locator for timeline navigation.
Finally, optional supplied evidence is normalized before `runClaude` executes;
future runtime collection needs finalization after execution, including failed
attempts. These are visible in the normalizer and session-attempt sources above.

## Mechanism inventory

This inventory precedes the adoption decisions below. IDs describe distinct
mechanisms, including their limits; they do not imply endorsement.

| ID  | Mechanism observed in source                                    | Conditions and boundaries                                                                                 |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| M01 | Lifecycle and tool hooks write a per-session JSONL trace        | Claude Code hook input; payload lengths and metadata supplement transcripts.                              |
| M02 | Reversible hook installation through an installer profile       | Merges marked entries into global settings; pins the interpreter; only a Claude profile exists.           |
| M03 | Historical transcript discovery and ingestion                   | Existing sessions can be inspected without installing hooks; missing hooks reduce coverage.               |
| M04 | Request usage extraction and conversation-turn mapping          | Several parser paths filter or deduplicate assistant records differently.                                 |
| M05 | Context-block reconstruction, resource identity, content hashes | Tool-use/result links and content storage support inspection; token sizes and membership can be inferred. |
| M06 | Compaction epochs and block exit boundaries                     | Combines explicit signals with cache-creation heuristics in the analysis path.                            |
| M07 | Hidden-prefix and content-composition estimation                | Synthetic prefix buckets and proportional token allocation fill unobserved components.                    |
| M08 | Subagent transcript ingestion and separate usage series         | Parent launch association can fall back to description matching.                                          |
| M09 | Workflow run/phase/agent grouping                               | Uses a recognized workflow artifact convention, not a general workflow inference engine.                  |
| M10 | Tool-result offload recognition                                 | Distinguishes saved output from the shortened result retained in the transcript.                          |
| M11 | SQLite summary/detail projections and reingestion               | Main-file mtime controls some refresh decisions; several dashboard endpoints bypass this store.           |
| M12 | Growth, cache-read, and cumulative-usage charts                 | API-call navigation, user-turn mapping, budget annotations, and top-growth selection.                     |
| M13 | On-demand message and image inspection                          | Truncated text previews carry size flags; image content is fetched separately.                            |
| M14 | Built-in/MCP/skill/agent tool classification                    | MCP server/function names are parsed from tool names; results join to calls.                              |
| M15 | Tool-error, retry, and self-correction diagnostics              | Explicit error evidence is mixed with temporal grouping and text heuristics.                              |
| M16 | Staleness, freshness, and health scores                         | Age, resources, lexical references, repeated labels, context pressure, and configurable weights.          |
| M17 | Optimization reports and prompt-specificity analysis            | Thresholds and regex features produce advice and estimated savings.                                       |
| M18 | CLAUDE.md instruction pruning                                   | Keyword overlap with tool names and block labels determines active/rare/unused status.                    |
| M19 | Cross-session trends, scatter plots, and generated insights     | Observational sessions; some claims compare the two context-size extremes.                                |
| M20 | MCP tools for programmatic context queries                      | A separate implementation exposes summaries, tool ranks, churn, health, and lifespans.                    |
| M21 | Codex rollout adapter                                           | Normalizes usage and content into shared dashboard shapes; Claude-specific depth is incomplete.           |
| M22 | Hook-time nudges and configurable thresholds                    | Trace estimates or stored peak metrics drive warnings; does not supply a saved/live consistency model.    |
| M23 | Offline compression screening                                   | Joins full tool outputs to block residency, invokes optional compressors, and models potential savings.   |
| M24 | Aggregate, content-free statistics export                       | Share mode omits prompt content and paths; its “waste” calculation is still heuristic.                    |

## What to adopt

### 1. Use retained request evidence, then fill collection gaps

Start with transcript-only usage normalization and ordered source references.
The current ACT-157 shaping already selects this route: retained transcripts
carry request IDs, models, usage, and cache-write TTL splits. It does not require
a new live collector to build the saved timeline. The adapter must deduplicate
agreeing request records and expose disagreements. Share located row/block
parsing across diagnostics, saved history, and request normalization, as already
identified by ACT-155.1, so the views cannot silently interpret a row differently.

The useful integration pattern is two complementary streams: transcripts for
recorded content and request usage, hooks for lifecycle and automatic-load
metadata. Neither replaces the other. Preserve original records before deriving
analysis, with the provider version, collection configuration, identities, and
coverage attached. Capture child evidence as part of the same task artifact.

For the later collection slice, use Rehearsal's existing provider bundle as the destination. Add a collector at
the provider/session execution boundary, then make equivalent capture available
for pipeline workers, replays, and harness-owned roles. A single CLI invocation
can contain multiple model requests. Worker, Product Owner, Judges, and nested
reviewers need separate identities even when they contribute to one task total.

The upstream [hooks](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/hooks.py)
and [profiles](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/profiles.py)
provide implementation examples. Prefer a configuration scoped to the run over
adopting their global installer as a prerequisite. Record collection settings
consistently across comparison arms.

Current official documentation describes
[instruction-load and lifecycle hooks](https://code.claude.com/docs/en/hooks#instructionsloaded),
[request telemetry](https://code.claude.com/docs/en/monitoring-usage#api-request-event),
and [separate subagent transcripts](https://code.claude.com/docs/en/sub-agents#resume-subagents).
These are integration candidates, not proof of fields emitted by Rehearsal's
installed CLI. Validate the exact launch mode and version with a bounded capture.

### 2. Build an integration explorer from actual delivered results

Context-analyzer's
[tool-intelligence endpoint](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/dashboard.py#L710)
classifies built-in tools, MCP calls, Skill invocations, and Agent/Task calls. It
groups MCP calls by server and function and joins results to the originating
call. This makes a practical question answerable: which integration supplied
the large result at this point in the run?

Extend Rehearsal's source/event explorer with this grouping. Show invocation
count, failures, delivered characters or labeled token estimates, receiving
agents, and links to the exact occurrences. Distinguish call arguments from
returned content. Keep unclassified tools visible. A tool-name namespace is
evidence about a call, not an inventory of every configured server or its schema.

For repeated reads, compare recorded content hashes and read ranges as well as
the path. Two reads of the same file may return different excerpts or versions.
A hash of normalized text and a hash of original bytes have different meanings;
record the method. Show identical repeated delivery as a diagnostic fact, not
automatically as waste.

Do not adopt their token allocation formula: this endpoint proportions character
counts across its block registry to the last snapshot's context total. That
does not measure each tool's token contribution at a selected request, especially
after compaction. Rehearsal should keep delivered-content estimates separate
from request-level provider usage and leave an unexplained remainder visible.

### 3. Make chart selection open the evidence that explains it

The useful visual pattern is the linkage among a request scrubber, growth chart,
ranked growth intervals, composition, messages, and agent details. Their
[dashboard source](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/static/dashboard-v3.html#L2817)
implements top-growth navigation; the
[recorded screenshot](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/docs/screenshots/dashboard-single-session.png)
shows the overall arrangement. The screenshot was inspected; browser execution
was not validated in this study.

Add a measured-request strip above Rehearsal's existing history workbench.
Label the first series **total input tokens**, consistent with the current
design decision. It is the supported sum of request input categories, not a
measurement of the provider's active context window; it omits the request's own
output and supplies no window-limit denominator. Selecting a point should select its related events and source detail, using
stable identities rather than assuming a user turn equals an API request.
Keep these readings separate:

- Total input tokens at a supported request boundary.
- Cumulative processed input/output/cache categories and priced cost.
- Content introduced by selected events, including estimated or unknown parts.

Overlay compactions, resumes, failed calls, automatic instruction loads, and
agent boundaries. Show the opening context separately from activity in the
attempt. A first-turn growth ranking must not charge inherited context as new
work. A compaction can lower context without lowering cumulative spend.

Use separate agent lanes. Parent and child windows cannot be summed into one
context window. Show direct and descendant-inclusive costs with deduplicated
request membership. Upstream's
[subagent view](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/dashboard.py#L928)
is useful interaction precedent, but description-based launch matching is too
weak for cost attribution. Its reconciled parent blocks also use a child's peak
context as the size of a synthetic tool-result block at call zero. That is not
the amount of content the child returned to the parent. Prefer Rehearsal's
lineage evidence and actual returned content for those distinct readings.

### 4. Preserve images and offloaded results as inspectable artifacts

Text-only inspection is insufficient for tasks that involve screenshots,
diagrams, browser work, or image-bearing tool results. Upstream's
[content extraction](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/dashboard.py#L193)
keeps image metadata in the message response and serves image content on demand.
Its [offload parser](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/ccscope/offload.py)
recognizes tool outputs saved outside the inline transcript.

Rehearsal should retain artifact identity, media type, original locator, content
hash when available, and a bounded preview. Distinguish full disk output, the
preview delivered to the model, and subsequent reads of that output. Counting
the full offloaded file as delivered context would overstate growth. Missing
artifacts remain unavailable; current files must not silently replace historical
evidence. Image bytes and text characters are not interchangeable token counts.

### 5. Expose one analysis implementation through UI, CLI, and agent tools

The upstream [MCP server](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/server.py)
makes session summaries, large tool results, churn, and block lifespans queryable
by an agent. Rehearsal could support a diagnostic agent asking for a task's
largest deliveries, a request interval, an agent subtree, or evidence behind a
finding without reading its entire transcript.

First expose pure, versioned projections through the existing server and CLI;
an MCP wrapper can follow. Require explicit attempt/task identity, bounded
results, pagination where needed, source links, units, and evidence state.
Separate summary retrieval from content retrieval. A useful diagnostic record
would carry a rule ID/version, scope, observed quantities, supporting event IDs,
coverage, and the hypothesis it suggests testing.

Do not copy upstream's independent MCP calculations. Its `should_clear` divides
summed input usage across all calls by a fixed window. Twenty requests each
carrying 50,000 tokens can therefore be reported as 100% of a million-token
window, although each request carries only 5%. Its HTTP, MCP, and reconstruction
paths also differ in staleness and compaction interpretation. A common projection
prevents the interface used to ask a question from changing the answer.

### 6. Screen optimization hypotheses, then test outcome quality

Use descriptive diagnostics first: large results, identical repeated content,
explicit errors, bursts of retries, and expensive request intervals. Upstream's
[error endpoint](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/dashboard.py#L1456)
shows how a finding can point back to a turn. Rehearsal already records explicit
errors and exact repeated Bash inputs, so extend those facts rather than adding
an opaque health grade.

The [offline compression audit](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/headroom_audit.py#L549)
contains a useful screening method: join full recorded outputs, measure a
candidate transformation, and weight the change by subsequent request exposure.
Its optional Headroom compressor and tokenizer were not installed or evaluated
here. No claims about their effectiveness are adopted.

For Rehearsal, report an estimated opportunity under stated residency and
measurement assumptions. Reject malformed transformations and record unmatched
content. A cache key for a transformation must include tool context and
configuration when they affect output, not just content bytes. The upstream
audit caches by text hash even though its compressor also receives tool name
and input.

Do not promise a dollar upper bound from a token-volume fraction: requests have
different models and cache rates, and a changed transcript can alter subsequent
behavior. After screening, freeze a variant and use Rehearsal's repeated
baseline/candidate/control comparison with fixed grading. This is where the two
projects complement each other most directly.

## Decisions for every mechanism

“Import” means recommend adapting the mechanism to an observed implementation
gap, not that code has been copied or delivery approved. “Carried” means
Rehearsal already answers the relevant need. Runtime properties that require
executing the external project remain unverified.

| IDs      | Decision                                                                       | Evidence and consequence                                                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M01      | Import for later lifecycle coverage                                            | The normalizer accepts hook records, but production execution does not collect the bundle. Adapt dual-stream collection without blocking transcript-only inspection.                                                    |
| M04      | Import extraction/navigation pattern; carry stronger request identity          | Fix transcript-only usage, retain first-observed order and locators. Upstream's main block parser associates usage by file order rather than a native request-ID join; preserve Rehearsal's stronger identity contract. |
| M02      | Declined                                                                       | Global hook installation is unnecessary for a run-owned collector. Reopen if standalone monitoring of ordinary sessions becomes a product requirement.                                                                  |
| M03      | Carried for saved Rehearsal attempts; decline broad import for now             | Saved history already opens retained evidence without provider spend. Ordinary-session import is a later convenience in the accepted roadmap; imported traces would remain observational.                               |
| M05      | Carried for call/result provenance; import content fingerprints                | Existing history distinguishes repeats, failures, excerpts, and inherited context more carefully. Add fingerprints/ranges for comparison; do not replace locators or evidence states.                                   |
| M06      | Import explicit epochs; decline cache-spike inference as fact                  | Hooks and normalized compactions exist as a contract; the measured history view is missing. A cache miss can occur without compaction.                                                                                  |
| M07      | Declined                                                                       | Rehearsal's unknown-state contract better handles hidden system content, warm starts, and missing token attribution than synthetic exact-looking buckets.                                                               |
| M08      | Import collection and agent views                                              | Lineage normalization exists, but child capture and operator-visible accounting are incomplete. Retain identity ambiguity rather than matching repeated descriptions.                                                   |
| M09      | Carried for declared pipeline structure                                        | Rehearsal owns task/step/role identity. Its explicit workflow boundaries are stronger than adopting another tool's artifact convention. Child integration remains M08.                                                  |
| M10, M13 | Import artifact inspection; carry bounded text detail                          | Existing history bounds text detail but does not supply a general image/offload viewer. Separate recorded artifact from model-visible delivery.                                                                         |
| M11      | Import versioned derived indexing when needed                                  | Rehearsal retains durable evidence, but broad analysis will need efficient projections. Invalidate against all source hashes and derivation version; SQLite is an implementation option.                                |
| M12      | Import linked chart interactions                                               | Current saved history is an event/source workbench without a measured provider timeline. Preserve its existing selection and missing-evidence behavior.                                                                 |
| M14      | Import                                                                         | No served MCP-server/function analysis exists. Group observed tool occurrences without presenting proportional allocation as measured tokens.                                                                           |
| M15      | Carried for explicit errors/repeated commands; import evidence-linked grouping | Existing diagnostics cover factual events. A repeated tool name alone does not prove a retry of the same action.                                                                                                        |
| M16      | Declined as a verdict                                                          | Uncalibrated age and lexical rules cannot establish useless context or attention loss. Reopen as explicitly labeled hypotheses if benchmarked against quality evidence.                                                 |
| M17      | Import report structure; decline assumed savings and specificity grades        | A compact list of locatable findings would help inspection. A regex score or large output threshold does not establish task efficiency.                                                                                 |
| M18      | Declined                                                                       | Keyword absence cannot justify deleting an instruction. A constraint may matter because the model avoided a prohibited action. Use controlled corpus variants instead.                                                  |
| M19      | Import exploratory charts; carry controlled comparisons                        | Scatter plots can locate expensive attempts. Rehearsal's matched cases and repeated trials are stronger evidence for an improvement than unrelated session extremes.                                                    |
| M20      | Import bounded query interface                                                 | Rehearsal has HTTP/CLI inspection but no equivalent context-analysis MCP tools. Reuse common projections and explicit record identity.                                                                                  |
| M21      | Declined as an immediate dependency                                            | A second provider is unnecessary to close current Claude Code capture gaps. Retain provider-specific adapters and capability flags; revisit with a supported Codex execution/import requirement.                        |
| M22      | Declined for collection; retain later operator notifications                   | Runtime nudges can affect experiments and use inconsistent estimates. Saved/live parity should precede measured-threshold UI notifications.                                                                             |
| M23      | Import screening method, not compressor dependency                             | There is no saved-output transformation screen today. Treat its result as modeled opportunity; quality and spend effects require reruns.                                                                                |
| M24      | Import export boundary; decline heuristic waste dollars                        | A content-free aggregate export can help share experiments. Export supported measurements and uncertainty, not inferred waste as money recovered.                                                                       |

## Important limits in the external implementation

The following examples change what Rehearsal should learn from the project:

- **A prefix is inferred.**
  [Reconstruction](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/analysis/reconstruction.py#L378)
  synthesizes up to 6,000 system tokens from initial cache creation, assigning
  the remainder to CLAUDE.md/skills. Those categories are not observed contents.
- **A cache rebuild is treated as compaction.** The same module detects a
  compaction when cache creation exceeds half of input after the first call.
  Changing a prefix or losing cache does not prove that history was summarized.
  The separate `ccscope` parser instead uses an input-size drop below half the
  previous value. Neither inference should override explicit compaction evidence.
- **Freshness is not safety to delete.**
  [Freshness analysis](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/analysis/freshness.py)
  can mark a block superseded because a newer block shares its label and returns
  a `safe_to_drop` list. Different excerpts or versions can both be relevant.
- **Instruction use is lexical.**
  [CLAUDE.md analysis](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/analysis/claude_md.py#L270)
  intersects instruction keywords with recorded tool names and labels, then
  generates a trimmed file. It does not establish compliance or irrelevance.
- **Cross-session scaling is observational.** The
  [insight generator](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/static/sessions.html#L407)
  compares cost/call for the smallest and largest sessions. It does not control
  task, model, cache mix, or outcome. Its headline ratios are not Rehearsal savings.
- **Stored Claude cost uses fixed rates.**
  [Ingestion](https://github.com/manavgup/context-analyzer/blob/2c9e44682483531c8ba14df5f0d5d7703e4341a7/src/context_tracker/ingest.py#L203)
  prices Claude usage with constants independent of the executing model.
  Preserve Rehearsal's request-specific frozen-rate pricing instead.
- **“Live” has multiple meanings.** Hooks collect ongoing events, but dashboard
  playback advances through loaded data. The main initialization has no ongoing
  subscription, and `_ensure_ingested` returns an existing database record
  without a freshness check. This is not a model for saved/live parity.

## Suggested delivery order

The existing context roadmap remains the right sequence. These are recommended
scope refinements, not changes to board status or priority:

| Order | Concrete result                                                                                                                         | Existing roadmap home                                                                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1     | Share located parsing, accept transcript-only usage, preserve request order, and join requests to saved history                         | ACT-155.1 and ACT-157, building on delivered ACT-155/156/157.1; coordinate existing record-compatibility dependency ACT-165 |
| 2     | Add linked total-input/usage/cost charts and integration grouping; finalize richer collection where transcripts lack lifecycle evidence | ACT-157 for the saved timeline; later capture work for hooks and child evidence                                             |
| 3     | Extend the same artifact and projection to pipeline/replay roles and reviewer trees                                                     | ACT-123, ACT-158, ACT-159, ACT-162                                                                                          |
| 4     | Add deterministic diagnostic reports, artifact previews, and bounded machine queries                                                    | Refine the context-inspection stream; scope these additions before implementation                                           |
| 5     | Screen one output/instruction hypothesis and compare quality with resource distributions                                                | ACT-160                                                                                                                     |
| 6     | Stream the same projections and add operator notifications                                                                              | ACT-161                                                                                                                     |

“Any task run” also needs a discovery path: an operator should be able to open a
standalone attempt, confirmation repetition, pipeline step, or replay from one
run index. Current root history lists pipeline runs while saved session pages
depend on explicit IDs or comparison links. Make this entry point explicit
when shaping the shared task report, rather than leaving the new inspector
reachable only by a known URL.

The collection probe should include duplicate usage records, two children with
the same description, an inherited prefix, an explicit compaction, a cache
rebuild without compaction, mixed models/cache TTLs, a changed file reread, an
image result, an offloaded output, and a missing child transcript. Check that
identities deduplicate, unknowns stay visible, and task cost counts each supported
request once. A fresh real capture is necessary before promising provider
coverage; synthetic tests alone establish only the adapter's contract.

## Study coverage

Production files were mapped by responsibility, rather than treating README
claims or archived designs as implementation. The source links above are pinned
to the reviewed revision.

| External files or groups                                                                                                   | Inventory coverage                                                                          |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `hooks.py`, `profiles.py`, `installer.py`, `storage.py`, `models.py`                                                       | M01–M03, M22                                                                                |
| `transcript.py`, `transcript_parser.py`, `ccscope/parse_transcript.py`, `ccscope/tokens.py`, `ccscope/reconcile.py`        | M04–M07                                                                                     |
| `ccscope/subagents.py`, `ccscope/offload.py`                                                                               | M08–M10                                                                                     |
| `ingest.py`, `db.py`                                                                                                       | M03, M08–M11, M21                                                                           |
| `dashboard.py`, `static/dashboard-v3.html`, `static/context-scope.html`                                                    | M11–M17, M22; current routes distinguished from alternate/static views                      |
| `static/workflows.html`, `static/sessions.html`, `static/optimize.html`                                                    | M09, M18–M19                                                                                |
| `analysis/models.py`, `analysis/reconstruction.py`                                                                         | M05–M07, M13                                                                                |
| `analysis/staleness.py`, `analysis/freshness.py`, `analysis/health.py`, `analysis/config.py`                               | M16, M22                                                                                    |
| `analysis/report.py`, `analysis/prompts.py`, `analysis/claude_md.py`, `analysis/patterns.py`                               | M17–M19                                                                                     |
| `server.py`, `codex.py`, `nudges.py`, `nudge_config.py`                                                                    | M20–M22                                                                                     |
| `headroom_audit.py`, `experiments/headroom/**`                                                                             | M23; experiment results are reported claims, not reproduced evidence                        |
| `stats.py`                                                                                                                 | M24                                                                                         |
| `cli.py`, `ccscope/cli.py`                                                                                                 | Entry points for M02–M03, M12, M20, M23–M24                                                 |
| `tests/**`                                                                                                                 | Corroborating fixtures and expected behavior for corresponding modules; suites not executed |
| `docs/**`, `evidence/**`, `static/screenshots/**`, `.superpowers/**`                                                       | Design/history/example coverage for M05–M19; no additional implemented mechanism inferred   |
| README, changelog, `llms.txt`, package/build/CI/editor files, lockfiles, license, ignore files, empty package initializers | Discovery, packaging, and project guidance; no additional task-inspection mechanism adopted |

External-source study does not authorize running its instructions. The review
used source reads and a supplied screenshot; it did not inspect private user
transcripts or measure either product on a paid task.
