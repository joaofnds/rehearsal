---
id: doc-69
title: Triage rehearsal factual evidence
type: other
created_date: '2026-09-09 16:24'
updated_date: '2026-09-09 16:26'
---
# Triage factual evidence, 2026-09-09

Parent record: doc-61. These independent audits are retained in their original words. The parent dispositions and fresh probes in doc-61 supersede recommendations where stated: retain Done dependencies; retain pipeline elapsed time on ACT-105; ACT-141 starts with shaping; assign ACT-69 Medium after its recorded budget; preserve the external scope boundary.



# Core-card factual audit, 2026-09-09

Scope: the open cards in `/tmp/rehearsal-triage/cards.json` whose numeric IDs are at most 95 (including ACT-26.7), plus ACT-115, ACT-116, ACT-117, ACT-118, ACT-120, ACT-121, ACT-127, ACT-128, ACT-129, ACT-131 and ACT-138. Repository revision: `1d02c8eef9ee330b31091f94ea24c4a4bf01d6c1`. The Rehearsal tree was clean when this audit began and this audit made no repository writes. During the shared run, another session added untracked triage docs doc-61 through doc-64; none was used as implementation evidence here. External reads used dotfiles `main`/HEAD `34bf9ebf8a7106810b71a02e75842bedb9f92c91`; no external tree was changed.

Focused validation: `mise exec -- bun test` over preflight, session capture/case/attempt/corpus, staleness/stale CLI, replay CLI, pipeline confirmation, comparison server and comparison client tests returned 194 pass, 0 fail. This is not a full-suite result. `command -v claude` and searches of `/opt/homebrew/bin` and `/usr/local/bin` found no executable, so provider-backed claims are currently unrepeatable through the ordinary environment. No provider call was attempted.

## Recommended structural changes

1. Merge ACT-121 into ACT-117 and archive ACT-121 as a duplicate. ACT-117's second criterion is already met by the `$0.1` ceiling; its first criterion and both ACT-121 criteria describe the same remaining `terminal_reason: budget_exhausted` distinction.
2. Add ACT-114 as a dependency of ACT-50. Its only remaining browser acceptance requires a real comparison on disk, and `.benchmark-runs/comparisons` is empty.
3. Keep ACT-69 at Medium in m-7 behind ACT-140 and the smallest session-comparison compatibility slice of ACT-146. ACT-140 can produce session confirmation evidence, but current comparison loading/reporting also needs to accept that evidence. A normal CLI readiness probe is additionally unavailable until `claude` is on `PATH`; that is a resource condition, not a product dependency.
4. Narrow ACT-120 to the remaining pre-execution guard. The dotfiles iterate implementation now advances a shaped card left in Shape and detects a stage that leaves status unchanged, so its first criterion is effectively met and the repeated unbounded loop is fixed. It still spends one redundant stage before detecting the stale record, so the second criterion remains.
5. Retain completed ACT-132 on ACT-129's dependency list so the next session sees the landed prerequisite, per the board rule. ACT-128 is the only unfinished prerequisite.

## Card-by-card coverage

### ACT-26.7 — keep, Low, m-6, implementation

- **Confirmed:** direct progress still reaches stdout. `rg -n 'console\.log' src/benchmark` found direct writes in `run.ts`, `checks.ts`, and `target.ts`, plus two injected `log: console.log` defaults. `runBenchmark` prints target, original SHA, backup, grade and artifact paths. This violates the JSON/data-only stdout contract.
- **Contradicted/stale:** the description's count of 17 and its claim about `workflow.ts` are stale; the current source has fewer occurrences and none in `workflow.ts`. AC5's literal zero-match rule would also reject legitimate injection defaults, so rewrite it to forbid direct harness writes and require an injected writer.
- **Benefit/cost of delay:** machine consumers can receive invalid JSON; no current recorded consumer demonstrates immediate harm. Keep Low and m-6. It remains a real prerequisite for ACT-27/31 only if those extractions share the output seam.
- **Next action/resources:** shape the writer boundary, then implement provider-free subprocess tests with fake execution.

### ACT-27 — keep, downgrade Medium to Low, no milestone, depends ACT-26.7

- **Confirmed:** `wc -l` reports `run-command.ts` 438 and `replay-command.ts` 410; both mix policy with production dependency assembly. `.oxlintrc.json` disables `import/prefer-default-export`, so the recorded historical blocker is gone.
- **Contradicted/stale:** the 236/282 line counts and lint-block explanation are historical. A real run exists (`rehearsal list runs` shows the 2026-09-06 audit-log run), so the “never run” rationale is stale too.
- **Benefit/cost of delay:** smaller modules reduce change and review cost, but no operator behavior is missing. Low is consistent with the consequence scale; Medium overstates current harm.
- **Next action/resources:** after ACT-26.7 settles output injection, extract cohesive run/replay production wiring without arbitrary exports.

### ACT-31 — keep, downgrade Medium to Low, no milestone, depends ACT-26.7

- **Confirmed:** `runBenchmark` remains a production-wired function at `run.ts:861`; `rg runBenchmark src/benchmark/run.test.ts` returns no direct test. The procedure is now 1,166 lines, not 292.
- **Unverified:** the exact retention-before-teardown defect risk has no failing reproduction; it is a coverage claim.
- **Benefit/cost of delay:** a wiring regression could corrupt cleanup/retention, but extracted lower-level decisions have tests and no present failure is recorded. Low, behind the output/wiring boundary.
- **Next action/resources:** shape a `RunDependencies` seam and drive one complete no-pause run using fakes.

### ACT-50 — keep, Medium, m-7, add ACT-114 dependency, implementation

- **Confirmed:** comparison and corpus screens, routes, empty states and attribution exist. The server now returns `qualityReadings` (`src/server/comparisons.ts`), while `comparison-page.tsx:172` still renders `PlannedFeatureBlock` with the obsolete “cannot supply yet” copy. Focused server/client tests pass. `.benchmark-runs/comparisons` is empty.
- **Contradicted/stale:** the first 12 checked criteria describe completed work; the card's broad original description is obsolete. The old claim that a paired estimate cannot supply readings is contradicted by the served response.
- **Unverified:** AC14 cannot be observed without a real recorded comparison.
- **Benefit/cost of delay:** this is the UI surface that answers whether an edit helped; delay blocks m-7. Keep Medium.
- **Next action/resources:** render `qualityReadings`, update the client test, then use ACT-114's real record for browser verification. Dependencies ACT-47/48/49/52/53 are Done and should remain as history.

### ACT-68 — keep, Low, m-1 label retained but not a milestone gate, shaping

- **Confirmed:** `captureStageCorpus` and `snapshotStageCorpus` still take instruction bytes as a separate string while other corpus kinds resolve from roots; focused checkpoint/staleness paths pass.
- **Contradicted:** treating this as necessary to “prove the loop once” conflicts with ACT-39's completed observable milestone. The interface asymmetry is maintenance risk, not missing loop behavior.
- **Benefit/cost of delay:** types can again permit recorded bytes to diverge from delivered bytes, but ACT-65 fixed the known occurrence. Delay has little current user cost.
- **Next action/resources:** decide and document whether instruction bytes intentionally come from the loaded case/source boundary; change code only if the asymmetry is rejected.

### ACT-69 — defer, Medium, m-7, depends ACT-140 and session-comparison support from ACT-146

- **Confirmed:** session confirmation is deliberately refused in `executeSessionRun`; ACT-140 owns that path. `list groups` and `list comparisons` return no records. The recorded $25 session-mode authorization exists. Two cases, three arms and two reps require 12 attempts.
- **Contradicted/stale:** the second-pipeline-case blocker and “budget unset” text are obsolete. The earlier command's projection/refusal output cannot currently be reproduced because `claude` is absent from `PATH`. Parent audit additionally observed that a session-mode comparison currently fails because a session rep has no pipeline `finalOutcome`; ACT-140 alone is insufficient.
- **Benefit/cost of delay:** the run supplies the first real comparison and unlocks real-data UI acceptance, but spending before both producer and reader paths work would waste the budget.
- **Next action/resources:** complete ACT-140, land the smallest ACT-146 compatibility slice for multi-case session evidence, restore a discoverable `claude` executable, run provider-free fixtures, then execute within the already authorized $25 ceiling. Medium preserves the value of this blocked m-7 outcome.

### ACT-83 — defer/park, Low, no milestone

- **Confirmed:** comparison records are versioned; run artifacts and case declarations are not comprehensively versioned, and no public/internal protocol inventory exists.
- **Confirmed decision:** João explicitly deferred compatibility promises until beta. Nothing inspected indicates beta has begun.
- **Benefit/cost of delay:** early versioning would create migration cost during active schema change; delay is intentional.
- **Next action/resources:** reconsider at the beta trigger; keep out of the ready queue.

### ACT-84 — keep, downgrade Medium to Low, no milestone, shaping

- **Confirmed:** version refusal exists only at `rehearsal.ts` startup; package scripts still invoke bare Bun. The historical failure mode is plausible.
- **Unverified/currently absent:** both `bun --version` and `mise exec -- bun --version` return 1.4.0 here, so the mismatch and phantom failures cannot be reproduced in the present environment. Focused tests pass.
- **Potentially misleading criterion:** removing the CLAUDE prefix instruction is justified only if every supported CLI/test entry path enforces the pin; wrapping package scripts alone does not protect direct `bun rehearsal.ts` use.
- **Benefit/cost of delay:** avoids wasted diagnosis when local Bun drifts, but there is no current mismatch. Low.
- **Next action/resources:** shape one entry-point mechanism, test with an explicit alternate Bun binary, and retain the instruction until direct invocations fail clearly too.

### ACT-86 — keep, Medium, blocked on ACT-115 and later observation

- **Confirmed:** current rendered shape/build skills do not name `--append-notes`; the card records repeated destructive overwrites. João rejected a hook, satisfying the “why prose” half.
- **Unverified:** prose cannot prove a session “cannot” destroy notes; even after ACT-115 it needs an observed later write. Its AC1 overstates the strength of the approved mechanism.
- **Benefit/cost of delay:** another overwrite can destroy the only card record. Medium is justified by recurrence.
- **Next action/resources:** after ACT-115, observe a real shape/build handoff and rewrite AC1 as the observable approved behavior (the session uses `--append-notes` and prior text remains), rather than impossibility.

### ACT-90 — keep, Low, no milestone, investigation

- **Confirmed:** the absence search `ls backlog/tasks backlog/archive/tasks | sed ... | uniq -d` returns `act-52`, `act-53`, `act-89`. `backlog --version` is 1.50.1, matching `mise.toml`; doctor/version behavior reported under 1.51.0 was not reproduced. The external doc-59 report attributes 6–8 repair calls to collisions, but its evidence is not attached here.
- **Unverified:** exact root cause and current 1.51.0 behavior; no scratch-board mutation was authorized in this audit.
- **Benefit/cost of delay:** ambiguity grows and has measured external workflow cost, but current dependency edits are not shown blocked. Low investigation remains proportionate.
- **Next action/resources:** reproduce create/archive/create and dependency traversal on scratch boards at 1.50.1 and 1.51.0; coordinate with owning DOT-71 rather than implementing the third-party CLI here.

### ACT-92 — keep, Low, no milestone, implementation

- **Confirmed:** `executeReplay` passes `await replayCorpusRoots(paths.manifestFile)` into the stage request; an isolated test covers `replayCorpusRoots`, but no test drives production `executeReplay` far enough to pin that call. Focused replay tests pass.
- **Unverified:** no present behavioral failure; this is a mutation-derived coverage gap.
- **Benefit/cost of delay:** a regression would replay against the wrong corpus without an obvious error, but the current code is correct.
- **Next action/resources:** add dependency injection at `executeReplay` or the CLI boundary and mutation-check the production wiring without a provider.

### ACT-93 — keep, Low, m-1 label retained but not a milestone gate, implementation

- **Confirmed:** `currentStageCorpus` deliberately uses `[source.root]` for the operator-selected live source, and current tests do not inject the home/live root at that boundary. Focused staleness tests pass, including live-source behavior at the CLI level where available.
- **Contradicted:** Medium priority as a remaining m-1 gate is not supported; ACT-39 already demonstrates the milestone outcome. Current `cards.json` already shows Low.
- **Benefit/cost of delay:** protects a twice-decided semantic choice; no current failure. Low.
- **Next action/resources:** inject the live-root resolver and mutation-test the branch. It no longer needs to precede ACT-137, which is Done.

### ACT-95 — keep, Medium, no milestone, implementation

- **Confirmed:** `deriveStaleness` supports `settingsFile`, and replay paths pass it. `staleCheckpoints` builds current corpus and calls `deriveStaleness` without a current settings-file hash. Search of staleness tests finds no settings-file case. Focused stale tests pass because they do not cover this input.
- **Benefit/cost of delay:** settings-only edits report checkpoints fresh, directly undermining trust in `stale`. Medium is justified.
- **Next action/resources:** load/hash the current declared settings per manifest in `staleCheckpoints` and add one settings-only regression.

### ACT-115 — keep as an external wait, Medium, no milestone

- **Confirmed:** in dotfiles, object `e33c7abf` still exists and contains the two additions, but `branch -a --contains`, `for-each-ref --contains`, and `log -S append-notes` on main return nothing. Dotfiles main/HEAD is `34bf9ebf`; source and rendered shape/build skills lack the lines.
- **Contradicted/stale:** the card says the commit “sits on a session checkpoint ref” and also says “no ref contains it.” Today no ref contains it; only the unreachable object remains. The object may disappear under GC.
- **Benefit/cost of delay:** blocks ACT-86's approved mitigation and risks losing the convenient patch object, though the exact text is copied onto the card.
- **Next action/resources:** execute in the dotfiles owner under review-instructions, commit to dotfiles main, render, verify both installed skills. The local Rehearsal card should record the reciprocal owning task if one is created.

### ACT-116 — keep, Medium, no milestone, implementation

- **Confirmed:** `case capture` resolves only recursively under `claudeProjectsDirectory()`; completed harness transcripts live under `.benchmark-runs/sessions`. Session attempts themselves intentionally persist/copy transcripts, while pipeline provider calls use `--no-session-persistence`. Existing capture tests cover only a supplied projects directory.
- **Contradicted/stale:** the description's generic statement that “a harness run invokes ... --no-session-persistence” is too broad and gives the wrong reason for session attempts. The gap is simply that capture searches one store.
- **Benefit/cost of delay:** forces hand placement of useful fixtures and blocks repeatable capture from the harness's own evidence. Medium fits the session-benchmark goal.
- **Next action/resources:** reshape source resolution over both stores with explicit ambiguity handling; retain the existing projects-directory test.

### ACT-117 — keep as merge survivor, Medium, no milestone, implementation

- **Confirmed:** budget is now `$0.1` with the cold-cache measurement documented, so AC2 is complete. `readClaudeEnvelope` discards the typed reason by throwing a bare Error; `probeModelAvailable` relabels every such error as unavailable. Tests cover accepted, rejected, malformed and missing executable paths, but no `budget_exhausted` envelope.
- **Contradicted/stale:** title/description still say a normal-cost completion fails under `$0.02`; that immediate trigger was fixed. Rename to the remaining classification defect.
- **Benefit/cost of delay:** an unusual probe overrun sends the operator to fix entitlement instead of budget. Medium is reasonable but should sit behind currently reproducible product blockers.
- **Next action/resources:** absorb ACT-121, type `terminal_reason`, distinguish exhaustion from rejection, and add the regression.

### ACT-118 — keep, Medium, no milestone, implementation

- **Confirmed:** runtime `transcriptPrefixPath` resolves under ignored `.benchmark-runs/cases`, while committed manifest-probe fixture tests read under `cases/`; missing runtime bytes are explicitly refused. Focused case/attempt tests pass and confirm the current split.
- **Benefit/cost of delay:** a fresh clone cannot run a committed prefixed case without manual copying, directly harming reproducible session benchmarks.
- **Next action/resources:** choose one declared source of bytes, preferably committed case input when present, update capture/runtime/test together, and validate from a clean temporary clone/tree.

### ACT-120 — keep but narrow, downgrade Medium to Low, no milestone, external implementation

- **Confirmed fixed portion:** dotfiles iterate `main.ts` now has `advanceShapedCard`: a shaped card left in Shape is moved to Build. Both step and loop also detect unchanged status after a stage. This materially contradicts the card's original unbounded-repeat account.
- **Still open:** detection occurs after the stage runs. No guard inspects a finished stage record before dispatch, so AC2's “stops instead of re-running” remains unmet. Review-to-Build routing is also not inferred automatically; it is detected as unchanged.
- **Benefit/cost of delay:** at most one redundant paid stage per stale status is still possible, rather than repeated full-cost loops. Downgrade to Low and rewrite the card around pre-dispatch detection.
- **Next action/resources:** implement in the dotfiles iterate owner or explicitly retire AC2 if post-stage status enforcement is the chosen sufficient guard.

### ACT-121 — merge into ACT-117 and archive

- **Confirmed:** every remaining criterion duplicates ACT-117 AC1; both cite the same function, envelope field, incident and remedy. No dependencies distinguish it.
- **Scope accounting:** ACT-117 retains the typed `terminal_reason`, distinct messages and test. Mark its already-met budget-headroom criterion complete. No requirement is retired.

### ACT-127 — keep, Medium, no milestone, kaizen/shaping

- **Confirmed record:** seven attributed instances are named. Current triage instructions now explicitly require checking claims against owning sources, which is a procedural improvement, but no automated or observed guard meeting AC2 was found.
- **Unverified:** the six original transcripts/commits were not all replayed in this audit; treat their counts as accepted records, not fresh measurements.
- **Benefit/cost of delay:** false board facts repeatedly distort prioritization and duplicate work. Medium is justified.
- **Next action/resources:** run kaizen against the recorded instances; define an observable guard at claim consumption/commit time without pretending static text can validate arbitrary facts.

### ACT-128 — keep, downgrade Medium to Low, no milestone, implementation

- **Confirmed:** `session-corpus.ts` still says “A recursive copy dereferences”; `session-corpus.test.ts` retains similar wording. `session-attempt.ts` correctly says copy preserves symlinks. The guard behavior remains sound because a preserved link is a live escape path.
- **Benefit/cost of delay:** false rationale can mislead future changes but current runtime behavior is correct. Low fits.
- **Next action/resources:** correct the two comments, citing the already-recorded Darwin `cp -R` and Node `cpSync` probe; no behavioral change needed.

### ACT-129 — keep, Low, no milestone, depends ACT-128; ACT-132 historical reference

- **Confirmed:** fixture seeding throws `SessionInputError`; session corpus copying throws `SessionCorpusError`; checkpoint walking throws `SymlinkedEntryError`. `session-run-command.ts` translates separate types. Current messages differ, though session-corpus wording has evolved to “resolves outside.” Focused symlink tests pass.
- **Contradicted/stale:** ACT-132 is Done, so it is no longer unfinished, but the board rule keeps a Done dependency for handoff. The note's exact three message strings have drifted.
- **Benefit/cost of delay:** unified refusal reduces caller branching and inconsistent diagnostics; behavior is currently safe. Low rather than Medium.
- **Next action/resources:** after ACT-128, shape one shared error carrying a relative layout path and migrate callers/tests in one sitting; retain ACT-132 as a completed dependency.

### ACT-131 — keep, Medium, no milestone, investigation then implementation

- **Confirmed:** the focused pipeline-confirmation file passed, including the peer test. The test mutates a shared `finished` array across concurrent reps and asserts `[1,3]` only after the harness returns. Accepted records contain one full-suite failure and several passes.
- **Unverified:** this audit did not run 20 full suites; the current flake frequency and exact race are unproven. Passing alone neither closes nor disproves it.
- **Benefit/cost of delay:** intermittent full-suite failure trains reruns and weakens the project guard. Medium.
- **Next action/resources:** replace wall-clock/interleaving observation with explicit completion synchronization if the assertion is intended; otherwise run a bounded stress loop of the focused test before paying for 20 complete suites.

### ACT-138 — keep, Medium, no milestone, external shaping

- **Confirmed accepted record:** doc-56/doc-55 describe shared-tree mutations corrupting concurrent measurements. This audit wrote only under `/tmp`, and the Rehearsal tree remained clean, demonstrating temp-copy discipline is feasible. No current repository mechanism enforces it.
- **Unverified:** the original mutation collisions were not reproducible without intentionally coordinating writers, which this read-only audit did not do.
- **Benefit/cost of delay:** silent false findings can enter cards; recurrence was high in one parallel review. Medium.
- **Next action/resources:** shape in the review/delegation owner. Prefer isolated temporary copies for mutation probes plus a clean-tree/HEAD check before accepting measurements. Record an external dependency rather than presenting this as Rehearsal product code.

## Ordering for this subset

Feasible implementation order by current consequence and readiness:

1. ACT-95 (wrong stale answer on an ordinary settings edit).
2. ACT-50 after ACT-114 supplies a real record (m-7 observable UI outcome).
3. ACT-118, then ACT-116 (reproducible session-case inputs and capture ergonomics).
4. ACT-117 after absorbing ACT-121 (wrong preflight diagnosis).
5. ACT-131 (suite trust), then ACT-127 (process guard).
6. Low work: ACT-26.7, ACT-92, ACT-128, ACT-129, ACT-84, ACT-68, ACT-93, ACT-27, ACT-31, ACT-90.

Excluded from the selectable queue: ACT-69 (ACT-140 + ACT-146 compatibility + missing executable resource), ACT-83 (parked until beta), ACT-86 (ACT-115 plus observation), ACT-115/ACT-120/ACT-138 (owned in dotfiles/corpus process rather than this repository), and ACT-121 (merge/archive).

No unresolved product choice blocks the first feasible action. ACT-69's $25 authorization is settled; the blockers are implementation and environment readiness. ACT-84 needs a design choice about the enforcement boundary before build, but its priority is Low.


# UI and corpus-card factual audit

Audit date: 2026-09-09. Repository: `/Users/joaofnds/code/rehearsal`. HEAD: `1d02c8eef9ee330b31091f94ea24c4a4bf01d6c1`. Worktree was clean at the start of the audit. This is a recommendation only; no repository, board, or corpus files were changed and no provider call was made.

## Evidence gathered

- Read the complete supplied records for ACT-96 through ACT-114, ACT-123, ACT-133, ACT-134, ACT-141, ACT-142, and ACT-150 from `/tmp/rehearsal-triage/cards.json`; read the Done card files for ACT-104, ACT-111, and ACT-113, plus ACT-137's completed record.
- Read doc-56, doc-57, doc-58, doc-59, accepted decisions 8 and 9, and the m-5/m-6/m-7 records. Doc-57's unrelated redaction follow-up was not adopted here.
- Source search scope for absence claims: all of `src/` and `client/`, using `rg` for the named record fields, schemas, renderers, and callers. Relevant owners were then read: `contracts.ts`, `checkpoint.ts`, `corpus-file.ts`, `corpus-report.ts`, `staleness-report.ts`, `comparison-record.ts`, `confirmation-report.ts`, `comparison-attribution.ts`, `workflow.ts`, `session-attempt.ts`, `run.ts`, and `run-command.ts`.
- Focused validation: `mise exec -- bun test src/benchmark/corpus-file.test.ts src/server/corpus-report.test.ts src/server/comparison-attribution.test.ts src/benchmark/confirmation-report.test.ts src/benchmark/preflight.test.ts src/cli/run-command.test.ts src/benchmark/comparison-loader.test.ts` returned **119 pass, 0 fail**.
- Live corpus probe: `corpusReport(liveCorpusSource(), ".benchmark-runs")` returned **122 files, digest `723012`, zero refusals**. This contradicts cards that pin the mutable live digest to `c7000b`; the behavior is healthy, but the exact digest is not a durable acceptance value.
- Comparison resource inspection: `.benchmark-runs/comparisons/` exists and contains no files. No comparison manifest JSON exists in the checkout. Existing run/session evidence is insufficient by itself for the current pipeline comparison schema's three arms and multi-case estimator.

## Card-by-card verdicts

| Card | Claim mapping at HEAD | Benefit and cost of delay | Proposed disposition and next action |
|---|---|---|---|
| ACT-96 | **Confirmed:** `HashedFile` is path+sha256; no role field exists in `src/`. **Unverified:** classification against a real run, because no implementation exists. Dependency ACT-49 is Done. | Enables the step modal to explain why a file mattered. Delay leaves a less informative UI, without corrupting a result. | **Keep, Low, no committed milestone; shaping next.** Define whether roles are declared, observed, or both before build. Retain ACT-49 as completed provenance. Candidate for the later run-detail increment, not required for m-7. |
| ACT-97 | **Confirmed:** `evidenceSchema` has only diff/baseline-context/local-checks plus path and claim; stage evidence has a transcript source but still no locator/span payload. **Unverified:** an openable UI locator contract. | Lets a reader inspect the exact evidence behind a judge finding. Delay preserves paraphrases but makes auditing slower. | **Keep, Low, no milestone; shape.** Coordinate with transcript retention (ACT-123 for pipeline sessions and existing session transcripts). Define immutable source bytes and locator semantics before changing the schema. |
| ACT-98 | **Confirmed:** no contribution phrase field exists on stage scorecards, judge records, or UI response models in the searched scope. | Improves graph scanning. Delay has little present cost because grades/findings remain available. | **Defer, Low, no milestone.** Reconsider when the Contribution layout is scheduled; shape whether this is derived display copy or a new agent-produced record. |
| ACT-99 | **Confirmed absent:** no completed-run agent analysis path or stored culprit opinion exists anywhere in `src/`/`client/`. **Unverified:** user value and acceptable provider cost. | Could shorten diagnosis, but adds a paid, fallible opinion over evidence already available. Delay costs no current correctness. | **Defer, Low, no milestone.** Require evidence that operators need this and shape invocation/budget/disclosure before implementation. It should not sit in a build-ready block. |
| ACT-100 | **Confirmed:** checkpoint directories and records are keyed by stage name; no `ckpt-<run>-s<n>` field exists. The position is derivable only with the run manifest/pipeline. | Gives UI-visible stable labels. Delay costs presentation consistency only. | **Keep, Low, no milestone; shape.** Prefer a render-time derived ID unless a consumer proves persistence is required. ACT-49 remains completed provenance. |
| ACT-101 | **Confirmed:** staleness is boolean plus free-text causes; no corpus-version history or distance exists. **Unverified:** what constitutes a distinct version. | Helps readers judge how obsolete a record is. Delay leaves binary staleness, which remains correct. | **Keep, Low, no milestone; shape.** Define the version ledger and identity before build. Current “implementation” disposition is premature. |
| ACT-102 | **Confirmed:** reliability summaries persist `gradeDistribution` and no median/range. Median and extrema are derivable from that complete distribution. | Adds compact arm summaries. Delay costs UI convenience only. | **Keep, Low, m-7 optional; implementation.** Compute at the presentation/report boundary; do not add redundant persisted fields unless schema consumers require them. Coordinate labels with ACT-146's partial scores. |
| ACT-103 | **Confirmed:** `countWords` is used only by session word-band checks and produces no numeric attempt field; pipeline records have no word count. | Makes verbosity comparable with cost. Delay leaves that comparison unavailable without changing correctness. | **Keep, Low, no milestone; shape.** Define which reply(s) count for multi-turn stages and whether aggregate plus per-turn values are needed. |
| ACT-104 | **Confirmed Done:** current comparison response has `qualityReadings`; decision-8 makes ACT-50 the What moved UI home. | Already delivered the data contract. | **Remain Done.** Keep as dependency/provenance for ACT-50; no work. |
| ACT-105 | **Partly confirmed:** provider calls carry optional `durationMs`/`apiDurationMs`; stage/run aggregates are absent. **Contradicted:** summing provider durations is not wall-clock time, especially with concurrent work; doc-59 assigns total attempt elapsed time to ACT-149. | Provider-time aggregation can explain spend; elapsed time serves UX. Delay leaves existing raw metrics usable. | **Keep, Low, no milestone; reshape before build.** Rename the outcome to provider duration and specify overlap/missing-metric handling. Link ACT-149; do not claim a provider sum is wall-clock. |
| ACT-106 | **Confirmed:** preflight calls both readiness checks, then `runBenchmark` calls both again; `confirmRun` has another pair. Focused preflight/run-command tests pass but do not enforce the card's counts. | Removes cheap duplicate git I/O. Delay causes minor latency only and the extra checks can catch intervening change. | **Keep, Low, no milestone; implementation.** Preserve the checked baseline as a value passed forward. A focused call-count test is the required evidence. |
| ACT-107 | **Confirmed:** the run-history empty-state sentence still contains an em dash; the same prose also appears in the system gallery. A separate em dash placeholder is a symbol, not this sentence. **Unverified:** current SPEC text was not supplied in `cards.json`, but repository grep should govern the build. | Satisfies the corpus writing rule and keeps demo/product copy aligned. Delay is cosmetic. | **Keep, Low, no milestone; implementation.** Scope the acceptance to the duplicated sentence in run history, system gallery, and SPEC. Treat the no-value glyph separately unless the governing rule explicitly forbids it too. |
| ACT-108 | **Confirmed:** `system-page.tsx` renders `SectionLabel` immediately above `TableShell`, which supplies its own caption. | Removes duplicate visible labeling from an internal gallery. No meaningful cost of delay. | **Keep, Low, no milestone; implementation companion.** Small independent cosmetic fix; archive only if the gallery is retired. |
| ACT-109 | **Confirmed:** `sourceRepSchema` persists path/hash/repId/ordinal but no grade; `reliabilitySummarySchema` persists only distributions. Existing comparison reports therefore cannot render one grade per rep from the report alone. **Unverified:** statistical pairing for session comparisons, owned by ACT-146. | Directly enables the accepted per-attempt comparison table and m-7 reading. Delay blocks that UI slice. | **Keep, Medium, assign m-7; implementation after a short schema shape.** Add per-rep outcome evidence with schema-version migration and coordinate session partial-score shape with ACT-146. Do not imply ordinal display pairing is an estimator. |
| ACT-110 | **Confirmed:** `StaleRecord` is record-to-free-text-causes; no reverse per-file invalidation aggregate exists. **Unverified:** “last edit” semantics remain explicitly unsettled. | Lets the corpus screen show impact by file. Delay leaves impact discoverable only record by record. | **Keep, Low, no milestone; shape.** Decide structured cause schema and “last edit”; implementation cannot start with AC#3 unresolved. Candidate for a later corpus-screen increment. |
| ACT-111 | **Confirmed Done:** client imports the shared arm-pair helper and the duplicate decoder is gone; focused comparison tests pass. | Already prevents server/client key drift. | **Remain Done.** No action. |
| ACT-112 | **Confirmed:** `dedupedByPath` silently keeps the first hash; all five tests use internally consistent hashes. **Unverified/product decision:** refuse, warn, or choose another behavior. | Prevents a confident attribution statement over an unstable arm. Delay risks misleading attribution only when corpus changes mid-run. | **Keep, Low, no milestone; shaping next.** Recommend refusing attribution with a distinct “arm corpus changed between stages” reason. Then add the missing differing-hash test. Current build-ready note is incorrect. |
| ACT-113 | **Confirmed Done:** entry-level and untrusted-root symlink containment is implemented and focused corpus tests pass. Its root exemption deliberately remains for live layout roots. | Already closes the ordinary symlink escape. | **Remain Done.** Keep as historical dependency/reference for ACT-134/141/150. |
| ACT-114 | **Confirmed:** no real comparison report is present. **Contradicted:** ACT-39 did not record a comparison; its final work manually compared a single replay pair, and full `compare` was split to ACT-69 because the schema requires three arms and multiple cases. **Unverified:** browser behavior against real report because the resource does not exist. | A real smoke test is required before m-7 can be accepted. Delay keeps ACT-50 AC#14 unobservable. | **Keep, Medium, assign m-7; blocked/deferred on ACT-69 or equivalent evidence production.** Replace AC#2 with the settled explanation and add ACT-69 as dependency. Once evidence exists, run the browser acceptance; no separate investigation remains. |
| ACT-123 | **Confirmed:** `StageTranscript` stores parsed exchanges/sessionId only; raw JSONL capture exists for session attempts, not pipeline stages. `workflow.ts`, `run.ts`, and `checkpoint.ts` contain no raw transcript persistence path. **Unverified:** destination, retention, failure handling, and downstream pipeline-manifest acceptance; the card has zero ACs. | Enables observed pipeline context rather than declared context. Delay blocks that future diagnostic, but no open card currently owns the downstream behavior. | **Keep but reshape, Low, no milestone.** Add observable ACs for capture path, immutability, cleanup/failure, and a consumer or create the downstream manifest card. It is not a build-ready Medium item. Coordinate formats with session evidence from doc-59. |
| ACT-133 | **Confirmed mechanism:** a hardlink is indistinguishable by realpath and current readers hash its inode bytes. **Contradicted as a general acceptance rule:** the harness cannot know which hardlink is the “outside original”; rejecting link count >1 also rejects legitimate in-tree hardlinks. **Unverified:** any third-party/untrusted corpus need. | Closing it could protect future untrusted imports; today the author controls declared case data. Delay has negligible current cost. | **Defer, Low, no milestone.** Reconsider when third-party corpora enter scope or a digest dispute occurs. Shape a trust policy then; do not schedule an inode heuristic now. |
| ACT-134 | **Confirmed open for live capture/report:** `captureStageCorpus` passes `rootMayBeALink: true`; the live corpus report does likewise. **Confirmed already handled for directory report:** focused corpus tests refuse a directory source whose layout directory links outside. **Unverified:** behavior once declared extent exists. The dependency now correctly points to ACT-141, superseding decision-9's old ACT-137 edge after ACT-137 split/closed. | Prevents foreign layout bytes receiving a confident digest. Delay leaves a real integrity hole on live sources. | **Keep, High, outside milestones; blocked on ACT-141, then implementation.** Rewrite AC#1 to identify live roots/declared extent so it does not conflict with legitimate live symlink roots. Preserve separate card per decision-9. |
| ACT-141 | **Confirmed open:** `refuseUncontained` returns immediately for every live source; `CorpusRoot` has no declared extent. Live probe remains healthy at 122 files/zero refusals, but digest is now `723012`, not pinned `c7000b`. Doc-58/ACT-137 settle the trusted extent as external configuration, defaulting to the install root plus its declared backing tree. | Establishes the trust boundary used by ACT-134 and prevents foreign instruction bytes from receiving a digest. Delay blocks the highest-value containment fix. | **Keep, High, outside milestones; implementation first.** Preserve synchronous `liveCorpusSource()` callers, thread declared extent through all consumers counted in doc-58, and assert before/after live file set plus zero refusals rather than a mutable literal digest. This is the first ready action in this audited set. |
| ACT-142 | **Confirmed at source:** `staleCheckpoints` calls `readCorpusInstructions` outside a catch; `/api/runs` has no route catch, and the client renders “Could not load run history” on query error. **Unverified fresh HTTP reproduction:** prior ACT-137 review supplied it; no dedicated test exists. | Keeps run history usable and names the bad corpus entry. Delay causes a whole-screen outage for a malformed local corpus. | **Keep, Medium, outside milestones; shape then implement.** Decide a structured refusal on the run-history response and explicitly choose CLI `stale` behavior. Add one API and one client test. Do not merge with ACT-150; routes/outcomes differ. |
| ACT-150 | **Confirmed:** layout walking classifies outside/dangling links, while ELOOP/EACCES can still escape; the focused suite explicitly expects an unreadable layout directory to reject. Instruction-file classification is richer and duplicated. **Unverified fresh EACCES fixture on this platform:** permission behavior can vary under the current user; prior record contains direct reproduction. | Prevents the corpus screen failing wholesale and removes inconsistent refusal vocabulary. Delay causes an outage only for malformed/unreadable corpus entries. | **Keep, Medium, outside milestones; implementation after a short shared-classifier shape.** Share failure classification between instruction and layout entries, return named refusals/no digest, and replace the pinned live digest with before/after equivalence. |

## Consolidation and ordering

No merge is justified. Decision-9 remains valid: ACT-141 and ACT-134 share a policy but run through different containment call paths. ACT-142 and ACT-150 both yield 500s but affect different reports/screens and can be accepted independently. The backend field cards share a UI destination, not one acceptance outcome.

Recommended queue for this audited set:

1. **ACT-141 (High, implementation):** establish declared live extent; it unlocks ACT-134.
2. **ACT-134 (High, implementation):** apply that extent to layout-root walking and stage capture.
3. **ACT-142 (Medium, shape/build):** preserve run-history usability on a refused instruction file.
4. **ACT-150 (Medium, shape/build):** complete layout-entry refusal classification.
5. **ACT-109 (Medium, m-7):** persist per-rep outcomes needed by the comparison table.
6. **ACT-114 (Medium, m-7, blocked):** after ACT-69 or equivalent real evidence exists, perform the browser smoke test, then unblock ACT-50 AC#14.
7. Low implementation work: ACT-106, ACT-107, ACT-108, ACT-102.
8. Low shaping: ACT-96, ACT-97, ACT-100, ACT-101, ACT-103, ACT-105, ACT-110, ACT-112, ACT-123.

Deferred and excluded from the selectable queue: ACT-98 and ACT-99 until their UI/diagnostic outcome is scheduled; ACT-133 until untrusted corpus intake or disputed lineage exists; ACT-114 until real comparison evidence exists. ACT-104, ACT-111, and ACT-113 remain Done.

## Unresolved decisions and resources

1. ACT-112 needs one product decision. Recommendation: refuse attribution when either arm contains multiple hashes for one layout path and name the unstable arm/path.
2. ACT-105 needs terminology corrected. Recommendation: record provider duration separately from attempt elapsed time; ACT-149 owns elapsed comparison.
3. ACT-123 needs a downstream observable outcome and retention contract before implementation.
4. ACT-114 needs comparison evidence. The current checkout has no manifest/report; ACT-69 is the existing full-comparison work and carries the budget constraint. No paid run is authorized by this audit.
5. ACT-141's regression criterion should compare the live report's files/refusals before and after the change. The literal digest already changed while the healthy 122-file behavior remained, proving the old fingerprint is too brittle.

The audited-set queue's first action is ACT-141. Its bet is that an externally declared extent can refuse a hostile live `CLAUDE.md` while the current live corpus still reports the same file set with zero refusals. Observe both paths with focused corpus-report/API tests and the local live probe; provider budget is zero.


## Parent probes and commands

All probe writes occur in owned temporary trees, which the scripts remove. No live corpus bytes or product code were changed. Run each TypeScript script through `mise exec -- bun <saved-script.ts>` from the repository. Absolute imports identify the inspected checkout; adapt that prefix on another clone.

### session-probes.ts

```typescript
import { mkdtemp, mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshotSessionCorpus } from '/Users/joaofnds/code/rehearsal/src/benchmark/session-corpus.ts';
import { runSessionAttempt } from '/Users/joaofnds/code/rehearsal/src/benchmark/session-attempt.ts';
import { parseCaseDeclaration } from '/Users/joaofnds/code/rehearsal/src/benchmark/case.ts';
import { buildComparisonQuality } from '/Users/joaofnds/code/rehearsal/src/benchmark/comparison-quality.ts';
import { buildPairedEstimate } from '/Users/joaofnds/code/rehearsal/src/benchmark/comparison-estimator.ts';
import { confirmationRepRecordSchema } from '/Users/joaofnds/code/rehearsal/src/benchmark/confirmation-record.ts';
import { comparisonRep, PASS } from '/Users/joaofnds/code/rehearsal/src/benchmark/comparison-test-fixtures.ts';
import { parseTranscript } from '/Users/joaofnds/code/rehearsal/src/benchmark/transcript.ts';
const root = await mkdtemp(join(tmpdir(),'triage-session-probe-'));
const report=(name:string,value:unknown)=>console.log(name,JSON.stringify(value));
try {
 const corpus=join(root,'corpus');await mkdir(join(corpus,'skills','probe'),{recursive:true});
 const skill=join(corpus,'skills/probe/SKILL.md');await Bun.write(skill,'before');
 try{await snapshotSessionCorpus({kind:'directory',root:corpus},join(root,'snapshot'),['skills/probe/SKILL.md']);}catch(e){report('ACT-143 directory skill',String(e));}
 const live=await snapshotSessionCorpus({kind:'live',root:corpus},join(root,'live-snapshot'),['skills/probe/SKILL.md']);
 await Bun.write(skill,'after');report('ACT-143 live snapshot sees mutation',await Bun.file(join(live.root,'skills/probe/SKILL.md')).text());
 const declaration={id:'probe',kind:'session' as const,title:'probe',prompt:'OK',tools:[],corpusFiles:[],projectFiles:[],checks:[{kind:'word-band' as const,max:1}]};
 try{parseCaseDeclaration('probe',JSON.stringify({...declaration,setup:['echo setup']}));}catch(e){report('ACT-144 setup declaration',String(e));}
 let calls=0;const attempt=await runSessionAttempt({sessionCase:{kind:'session',declaration,prompt:'OK',tools:[],corpusFiles:[],projectFiles:[],checks:declaration.checks,fixturePath:undefined,transcriptPath:undefined,settings:undefined,agents:undefined},settings:{model:'fake',budgetUsd:1},projectsDirectory:join(root,'projects'),recordDirectory:join(root,'record'),runClaude:async(_args,cwd)=>{calls++;await Bun.write(join(cwd,'board-result.md'),'state to grade');return JSON.stringify({type:'result',subtype:'error_max_turns',session_id:'00000000-0000-0000-0000-000000000001',is_error:false});}});
 report('ACT-145 no reply state',{outcome:attempt.outcome,checks:attempt.checks,directoryExists:await stat(attempt.attemptDirectory).then(()=>true,()=>false),fakeCalls:calls});
 const base=comparisonRep('session-test',1,PASS);
 const rep=confirmationRepRecordSchema.parse({...base,mode:'session',stages:[{...base.stages[0],stage:'checks'}],finalOutcome:{status:'NOT_APPLICABLE'}});
 try{buildComparisonQuality({contract:{mode:'session',declaredStages:['checks'],reps:1},cases:['one','two'].map(caseId=>({caseId,arms:{baseline:[rep],candidate:[rep],control:[rep]}}))});}catch(e){report('ACT-146 two-case session quality',String(e));}
 try{buildPairedEstimate([{caseId:'one',minuend:[1,2,3],subtrahend:[0,1,2]}]);}catch(e){report('ACT-146 single-case estimator',String(e));}
 report('ACT-148 tool result parse',parseTranscript(JSON.stringify({type:'user',message:{content:[{type:'tool_result',tool_use_id:'abc',is_error:true,content:'failure'}]}})));
}finally{await rm(root,{recursive:true,force:true});}

```

### session-probes.log

```text
ACT-143 directory skill "SessionCorpusError: The case declares corpus file skills/probe/SKILL.md, and a project-level skill does not shadow the user-level one: ACT-28 owns the delivery mechanism, so a skill variant cannot be measured yet"
ACT-143 live snapshot sees mutation "after"
ACT-144 setup declaration "CaseDeclarationError: Case probe declaration has an invalid declaration: Unrecognized key: \"setup\""
ACT-145 no reply state {"outcome":"NO_REPLY","checks":[],"directoryExists":false,"fakeCalls":1}
ACT-146 two-case session quality "Error: Pipeline comparison rep has no final outcome"
ACT-146 single-case estimator "Error: A paired estimate requires at least two cases"
ACT-148 tool result parse [{"toolUses":[]}]

```

### corpus-probes.ts

```typescript
import {mkdtemp,mkdir,symlink,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createApiApp} from '/Users/joaofnds/code/rehearsal/src/server/api.ts';
import {corpusReport} from '/Users/joaofnds/code/rehearsal/src/server/corpus-report.ts';
import {liveCorpusSource} from '/Users/joaofnds/code/rehearsal/src/benchmark/corpus-file.ts';
import {captureStageCorpus} from '/Users/joaofnds/code/rehearsal/src/benchmark/checkpoint.ts';
import {RecordedRunsFixture} from '/Users/joaofnds/code/rehearsal/src/benchmark/run-records-test-support.ts';
const base=await mkdtemp(join(tmpdir(),'triage-corpus-'));const runs=join(base,'runs');await mkdir(runs);
async function root(name:string){const path=join(base,name);await mkdir(path);return path;}
try{
 const fixture=new RecordedRunsFixture(join(base,'fixture'));await fixture.write();
 const outside=await root('outside');await Bun.write(join(outside,'secret.md'),'foreign');
 const linked=await root('linked');await symlink(join(outside,'secret.md'),join(linked,'CLAUDE.md'));
 for(const kind of ['live','directory'] as const){const app=createApiApp({runsDirectory:fixture.runsDirectory,corpusSource:{kind,root:linked}});for(const route of ['/api/corpus','/api/runs']){const response=await app.request(route);console.log(JSON.stringify({case:'root link',kind,route,status:response.status,body:await response.json()}));}}
 const looped=await root('root-loop');await symlink('CLAUDE.md',join(looped,'CLAUDE.md'));const badApp=createApiApp({runsDirectory:fixture.runsDirectory,corpusSource:{kind:'live',root:looped}});for(const route of ['/api/corpus','/api/runs']){const res=await badApp.request(route);console.log(JSON.stringify({case:'live root loop',route,status:res.status,body:await res.json()}));}
 const layout=await root('layout');await Bun.write(join(layout,'CLAUDE.md'),'instructions');await Bun.write(join(layout,'skills/build/SKILL.md'),'skill');await symlink(outside,join(layout,'agents'));
 const report=await corpusReport({kind:'live',root:layout},runs);console.log(JSON.stringify({case:'layout live',files:report.files.map(x=>x.path),digest:report.digest,refusals:report.refusals}));
 console.log(JSON.stringify({case:'layout capture',files:await captureStageCorpus('build','instructions',[layout])}));
 for(const mode of ['loop','unreadable']){const path=await root(mode);await Bun.write(join(path,'CLAUDE.md'),'good');await mkdir(join(path,'agents'));const entry=join(path,'agents/bad.md');if(mode==='loop')await symlink('bad.md',entry);else{await Bun.write(entry,'bad');await chmod(entry,0);}try{const res=await createApiApp({runsDirectory:runs,corpusSource:{kind:'live',root:path}}).request('/api/corpus');console.log(JSON.stringify({case:mode,status:res.status,body:await res.json()}));}finally{if(mode==='unreadable')await chmod(entry,0o600);}}
 const current=await corpusReport(liveCorpusSource(),'/Users/joaofnds/code/rehearsal/.benchmark-runs');console.log(JSON.stringify({case:'current live',files:current.files.length,digest:current.digest,refusals:current.refusals}));
}finally{await rm(base,{recursive:true,force:true});}

```

### corpus-probes.log

```text
{"case":"root link","kind":"live","route":"/api/corpus","status":200,"body":{"root":"/var/folders/x2/qm129cv96810yzz2x358lhd40000gn/T/triage-corpus-CZsOqU/linked","digest":"5c4eb9","files":[{"path":"CLAUDE.md","sha256":"656771905e1ef731f65cd0a0d9fb061238380a1a012e6abdf846ecc7d2ea36fd","lastEditedAt":"2026-09-09T16:14:47.329Z","readBy":0}],"refusals":[]}}
{"case":"root link","kind":"live","route":"/api/runs","status":500,"body":{"error":"The discuss skill is not installed; searched <path>"}}
{"case":"root link","kind":"directory","route":"/api/corpus","status":200,"body":{"root":"/var/folders/x2/qm129cv96810yzz2x358lhd40000gn/T/triage-corpus-CZsOqU/linked","files":[],"refusals":["Corpus file CLAUDE.md resolves outside the corpus source, which would hash bytes the corpus does not hold"]}}
{"case":"root link","kind":"directory","route":"/api/runs","status":500,"body":{"error":"Corpus file CLAUDE.md resolves outside the corpus source, which would hash bytes the corpus does not hold"}}
{"case":"live root loop","route":"/api/corpus","status":200,"body":{"root":"/var/folders/x2/qm129cv96810yzz2x358lhd40000gn/T/triage-corpus-CZsOqU/root-loop","files":[],"refusals":["Corpus file CLAUDE.md is a link that never resolves to a file, so it names no bytes"]}}
{"case":"live root loop","route":"/api/runs","status":500,"body":{"error":"Corpus file CLAUDE.md does not exist at <path>"}}
{"case":"layout live","files":["CLAUDE.md","skills/build/SKILL.md","agents/secret.md"],"digest":"09ec82","refusals":[]}
{"case":"layout capture","files":[{"path":"CLAUDE.md","sha256":"238fa28a94976c7da14563bc873c2729bd5cd325389085bb4c6dd0de28923590"},{"path":"agents/secret.md","sha256":"656771905e1ef731f65cd0a0d9fb061238380a1a012e6abdf846ecc7d2ea36fd"},{"path":"skills/build/SKILL.md","sha256":"9c53c074d7ac6a2728b638ac1f376c5fa9eb8f71603017c3ea638c2fd40548df"}]}
{"case":"loop","status":500,"body":{"error":"ELOOP: too many symbolic links encountered, open '<path>'"}}
{"case":"unreadable","status":500,"body":{"error":"EACCES: permission denied, lstat '<path>'"}}
{"case":"current live","files":122,"digest":"723012","refusals":[]}

```

### redactor-probe.ts

```typescript
import { redactAbsolutePaths, redactorFor } from '/Users/joaofnds/code/rehearsal/src/server/redact-path.ts';
const input="ENOENT: no such file or directory, open '/srv/corpus/Bob's Projects/secret.md'";
console.log(JSON.stringify({input,general:redactAbsolutePaths(input),known:redactorFor(['/srv/corpus'])(input)}));

```

Parent focused-test summaries:

```text

 143 pass
 0 fail
 203 expect() calls
Ran 143 tests across 10 files. [306.00ms]

 153 pass
 0 fail
 1 snapshots, 288 expect() calls
Ran 153 tests across 10 files. [6.95s]
```
