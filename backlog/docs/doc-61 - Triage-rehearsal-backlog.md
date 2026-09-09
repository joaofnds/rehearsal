---
id: doc-61
title: Triage rehearsal backlog
type: other
created_date: '2026-09-09 16:11'
updated_date: '2026-09-09 16:26'
---
# Triage, 2026-09-09

Goal: let developers improve their instruction corpus by running repeatable tasks, inspecting loaded instructions and results, changing instructions, and comparing outcomes. Source: João’s words in doc-6, the milestone order in doc-7, and the approved session benchmark scope in doc-59.

Next card: **ACT-140, shape session confirmation execution**. Its bet is that one frozen-input representation and isolated, failure-accounted repetitions make existing session cases capable of producing confirmation evidence. Observe this first with injected runners: one rep fails, its peers complete, and every rep refers to the same captured inputs. Proposed bound: one shaping session, then one implementation session if the design fits; no new provider budget. The recorded USD 25 belongs to ACT-69’s later comparison run.

Status: card sweep applied; independent review pending. No paid provider calls have been made. The normal smoke command cannot currently find `claude` on PATH, so real-provider evidence remains unavailable; source checks and injected-runner work are feasible now.

## Changes since doc-56

ACT-122, ACT-136, ACT-137 and ACT-139 are Done. ACT-137 completed during the initial inventory; its owner’s completion and later reflection, doc-60, are included. Its original live-containment outcome survives on ACT-141, and ACT-134 already points there. The new session cards ACT-140 and ACT-143 through ACT-149 carry the approved scope from doc-59. ACT-142 and ACT-150 carry the remaining report failures.

This sweep merges ACT-121 into ACT-117 and adds ACT-151 and ACT-152. ACT-151 is the independently useful multi-case session comparison prerequisite for the already authorized ACT-69 run. ACT-152 corrects the existing operator runbook, whose “not yet true” list still describes resolved ACT-41/44/45 defects. Baseline inventory: 54 open cards after the owner closed ACT-137. Expected final inventory: 55 open, a net increase of one. The earlier first listing also saw ACT-137 held in Build; triage did not claim or close it.

The board is deliberately tracked. João’s commit `6a8a02668d1a6def9e4643dca5508e9e5e1a1a07` states that a tracked board pins the plan per benchmark run. `git ls-files backlog/config.yml` confirms it; `git check-ignore -q backlog/config.yml` exits 1. The board rule’s private-board guard therefore does not apply. An independent decide pass found that source; the parent read the commit before continuing. No ignore configuration was changed.

## Current evidence

Product revision: `1d02c8eef9ee330b31091f94ea24c4a4bf01d6c1`. The tree began at `788dad2`; the owner then closed ACT-137. During the sweep `6b0c17d` added doc-60 and `3438d1f` annotated ACT-141’s stale digest. These later commits changed board records, not product code. The mutation journal uses fresh card reads and preserves that intervening note.

The parent ran 143 session/comparison tests across ten files, then 153 targeted corpus/staleness/confirmation tests across ten files, all passing. These sets overlap and are not a full-suite total. The flaky ACT-131 criterion requiring twenty complete suite runs remains unverified; one focused pass cannot close it. The delegated audits report their own scoped test commands in the evidence document, separately from the parent’s checks.

Retained temporary-fixture probes establish:

- Explicit session skill declarations are refused. A source mutation after a live “snapshot” changes the bytes it reads. ACT-143 remains necessary.
- A session declaration with generated setup is rejected. A fake replyless session returns `NO_REPLY`, no checks, and a removed attempt directory even after writing state. ACT-144 and ACT-145 remain necessary.
- Valid session repetition records throw `Pipeline comparison rep has no final outcome` in comparison quality even with two cases. The one-case estimator separately throws `A paired estimate requires at least two cases`. ACT-151 handles the first gap; ACT-146 retains the later one-case/statistical and full-experiment work.
- A live root instruction link outside the root yields a confident digest. A live layout link and `captureStageCorpus` include `agents/secret.md` from outside their root. ACT-141 and ACT-134 remain open.
- With recorded runs, a self-looping live `CLAUDE.md` gives `/api/corpus` a 200 named refusal and `/api/runs` a 500. With no recorded runs, run history can return 200; the fixture must exercise a real recorded run. ACT-142 remains open.
- Unreadable and self-looping files inside a live layout directory give `/api/corpus` 500 with EACCES/ELOOP. ACT-150 remains open. The current healthy live corpus reports 122 files, digest `723012`, zero refusals; these are a dated measurement, not acceptance constants.
- Both `redactAbsolutePaths` and `redactorFor(['/srv/corpus'])` leave the same `s Projects/secret.md` fragment after a quote in a path. Doc-57’s proposed caller-root wiring does not fix that symptom. Keep the producer-marking boundary documented by the module; no new wiring card is justified by this probe.

Original source scope and remaining unverified claims are enumerated per card in the evidence document. In particular, historical provider-cost distributions, original external transcript incidents, beta timing, and ACT-131’s rate were not re-measured. No low-priority card was assumed complete from a matching symbol.

## Milestones and commitments

The accepted sequence remains m-1 → m-5 → m-6 → m-7 → m-2 → m-3. Integrity defects can precede milestone work when they make recorded evidence or shipped reports untrustworthy.

- **m-1, prove the loop once:** the observable gate was ACT-41 → ACT-39 and is met. ACT-68 and ACT-93 are Low follow-ups, now outside the committed milestone. Their unresolved maintenance/coverage work is preserved; an open counter is not evidence that the demonstrated loop never happened.
- **m-5, read one real screen:** delivered. The corpus integrity/report failures ACT-141, ACT-134, ACT-142 and ACT-150 are kept as corrective work outside the milestone, rather than rewriting its historical result.
- **m-6, watch a run:** ACT-51 delivered the monitor. ACT-26.7 remains its Low CLI-output follow-up, with real stdout pollution still present. Its output seam links ACT-27 and ACT-31; those maintenance cards are deferred until needed.
- **m-7, read a comparison:** required path is ACT-140 → ACT-151 → ACT-69 → ACT-114 → ACT-50. Completion is a recorded multi-case, three-arm comparison read through the real browser screen, with the What moved readings visible. ACT-109 adds the planned per-repetition detail; ACT-102 is optional summary presentation. ACT-131 addresses the suite flake while that work proceeds. Provider availability and a browser engine must be checked before the real demonstration.
- **m-2, another developer can run it:** ACT-118 addresses prefixed-case portability; ACT-84 is the optional pin-enforcement follow-up, and ACT-152 repairs the operator guide. Demonstrate the supported setup/read commands from a clean checkout; do not launch paid examples merely to edit prose.
- **m-3, trustworthy repeated experiments:** ACT-143, ACT-144, ACT-145, ACT-147 and ACT-146 supply frozen skills, generated inputs, preserved state grading, regrading and the single-case experiment. ACT-146’s final integration uses the small generated board case. Deliver ACT-147 before an expensive new experiment. ACT-148/149 are diagnostic/time follow-ups; ACT-95/116/117 retain their staleness, capture and preflight benefits here. Exact fixture/scorer formats and the single-case estimator are shaping work, not unsettled product scope.

No separate classifier milestone or prerequisite card is created. ACT-150 can share the existing instruction/layout failure classification while delivering its own report behavior. ACT-142 remains a separate run-history outcome. Shared files alone do not justify merging these cards.

## Selectable queue

Only actions feasible now appear here. The current High tie sorts ACT-140 before ACT-141. The other High cards, ACT-134 and ACT-151, are blocked and excluded below.

1. **ACT-140, m-7, shaping:** resolve the session frozen-input record and repetition evidence. It leads because it blocks the approved comparison and is the lowest-ID ready High. It unlocks ACT-151 and the eventual ACT-69 run.
2. **ACT-141, corrective, shaping:** carry the recorded external-extent decision through synchronous callers. Its synthetic containment checks need no provider. It unlocks ACT-134; both share corpus resolution and must be worked in sequence.
3. **ACT-95, m-3, implementation:** settings-only edits currently evade stale detection. This protects the truth of recorded evidence before convenience work.
4. **ACT-142, corrective, shaping:** keep recorded run history usable when instruction bytes are refused. It precedes the other report improvement because it blanks the primary history view.
5. **ACT-150, corrective, shaping:** handle unreadable/looping layout files with named refusals and reuse the existing classification boundary. It restores corpus-screen degradation without a new independent abstraction project.
6. **ACT-109, m-7, shaping:** settle per-repetition display evidence for existing reports. Coordinate with session checks but do not wait for one-case statistics to design ordinary rows.
7. **ACT-131, m-7, investigation:** reproduce the peer-ordering race with explicit scheduling. Proposed bound: one focused investigation session; stop on a controlled failing trace or document what remains unverified. Twenty passing full suites alone are not a causal explanation.
8. **ACT-118, m-2, shaping/implementation**, then **ACT-116, m-3, shaping/implementation:** settle the single source of prefix bytes before extending capture discovery across stores. They share case loading/capture fixtures.
9. **ACT-117, m-3, implementation:** distinguish exhausted probe budget from genuine model rejection. USD 0.1 headroom is already present; no new provider call is needed for the envelope regression.
10. **ACT-143**, **ACT-144**, **ACT-145**, then **ACT-148**, m-3, shaping: frozen skill delivery, realized fixture state, state grading, and saved-transcript diagnostics. The first three enable the accepted experiment; diagnostics can follow without delaying usable execution.
11. **ACT-152, m-2, documentation implementation:** correct the guide before someone follows obsolete workarounds.
12. **ACT-26.7, m-6, shaping**, then **ACT-102, m-7 optional, implementation**, and **ACT-84, m-2 optional, shaping**: useful Low work with affordable delay.

Dependencies schedule the later chain, rather than placing blocked cards in this selectable list: ACT-134 waits on ACT-141; ACT-151 waits on ACT-140; ACT-69 waits on ACT-140/151 and executable availability; ACT-114 waits on ACT-69 and browser availability; ACT-50 waits on ACT-114; ACT-146 waits on ACT-140/143/144/145/151; ACT-147 waits on ACT-145; ACT-149 waits on ACT-146.

Deferred/external work is excluded individually in the coverage table. ACT-115, ACT-120, ACT-127 and ACT-138 belong to dotfiles/corpus work; ACT-86 waits on its approved mitigation and a later observed handoff. ACT-90 has the external DOT-71 pointer; this board is audited, not reorganized. ACT-83 remains parked until beta; ACT-98/99 wait on an actual consumer; ACT-133 waits on an untrusted-corpus requirement. Other Low improvements are reconsidered after m-7 or when they block a chosen card. Done dependencies are retained, including ACT-132 on ACT-129.

Capacity change: the completed High fixes leave room for ACT-140 and the new comparison prerequisite. Low ACT-68/93 no longer displace the UI outcome solely because they were filed in m-1. The expensive full experiment is not pulled ahead of the existing comparison; ACT-151 makes that distinction executable. Working ACT-140/143/144/145 concurrently in one tree would collide in session attempt/input/record code. ACT-141/134/150 share corpus walking. ACT-50/109/151 share comparison contracts. Sitting companions are coordination opportunities, not extra cards selected by one iteration.

## Scope accounting and recovery

ACT-121’s first criterion is absorbed into ACT-117 AC1, and its test criterion becomes ACT-117 AC3. ACT-117’s measured-budget AC2 is retained and checked. No requirement is retired; no incoming dependency on ACT-121 exists. ACT-121 is archived with ACT-117 as survivor.

ACT-146 retains all original AC1-6. ACT-151 contributes the existing multi-case compatibility needed by AC1/5 and ACT-69. Its independent acceptance does not claim one-case uncertainty, partial-score reporting or generated-board integration. Those remain on ACT-146. ACT-105 retains real pipeline elapsed-time requirements; the invalid provider-sum wording is corrected rather than silently replacing elapsed time with a different metric.

ACT-137’s title now names the refusal-report work it actually delivered, while its old filename and full historical notes remain. ACT-141 and ACT-150 replace literal live fingerprints with controlled healthy-fixture behavior and a same-run live comparison. Current descriptions replace stale premises, and missing descriptions/ACT-123 acceptance are supplied from existing recorded needs. No card is moved to Done by triage.

Full before/after fields, all replaced notes and criteria, creation records, prior verdicts and readback states are in the recovery documents. The CLI rejected combining acceptance replacement with checked-item flags before changing ACT-86; replacement and check restoration were then run separately with intervening reads. It also trims leading blank lines, which the journal’s verified after-value records. Those are CLI constraints, not lost edits.

## Reflections and process observations

Doc-57’s ACT-136 warning is superseded by the current picker implementation and its Done card. Doc-60’s title/digest corrections are applied. Its shared-classifier suggestion is assigned within ACT-150 rather than creating an abstraction prerequisite. Its suggested confirmation of the extent decision is not repeated: the recorded decision already provides the policy, and the new card still needs a design for expressing it.

Recurring defects to take into the existing ACT-127/138 work: missing descriptions and acceptance; mutable fingerprints used as invariants; schema acceptance mistaken for a complete execution/reporting path; stale milestone counters treated as product truth; references to line numbers instead of stable symbols; and a Done title left naming a split-out defect. The corpus itself is not changed during triage.

## Decisions remaining

None requires an operator answer to start ACT-140. The budget for ACT-69 remains USD 25 in session mode. The declared-extent policy is retained from ACT-137. Later implementation design belongs to each shaping action, and unavailable executables/browser evidence are resource checks rather than fresh spending approvals.


## Coverage audit

Every one of the 54 baseline open cards plus ACT-151/152 is accounted for. ACT-121 is the one archived survivor mapping; ACT-137’s owner-completed record is also covered. No held cards remain. The final readback found 55 open cards: 41 To Do and 14 Shape after final reference/action corrections, with 4 High, 23 Medium and 28 Low. These counts are from `backlog task list --json`, schemaVersion 1, filtered by `status != Done`; the structural checker reads each full card, verifies references and detects dependency cycles.

| Card | Disposition / next step | Milestone | Priority reason | Readiness or blocker |
|---|---|---|---|---|
| ACT-26.7 | keep / shaping | m-6 | low: Direct harness progress still contaminates stdout, but the recorded count and workflow.ts claim are stale. | None for the next action. |
| ACT-27 | defer / implementation | outside committed set | low: The mixed policy/wiring modules are real maintenance debt without current operator harm. | ACT-26.7 |
| ACT-31 | defer / implementation | outside committed set | low: runBenchmark production wiring remains untested, but no active behavior failure is recorded. | ACT-26.7 |
| ACT-50 | keep / implementation | m-7 | medium: Only the What moved rendering and real-record browser check remain; they directly deliver m-7. | ACT-114 |
| ACT-68 | defer / shaping | outside committed set | low: The instruction-byte asymmetry remains but ACT-65 fixed the observed delivery defect and m-1's observable loop is already proved. | None for the next action. |
| ACT-69 | keep / implementation | m-7 | medium: The $25 session-mode comparison is authorized, but neither session confirmation production nor compatible comparison loading is ready. | ACT-140 and ACT-151 must finish; claude must be available on PATH. USD 25 session-mode authorization is already recorded. |
| ACT-83 | defer / shaping | outside committed set | low: João explicitly deferred compatibility promises until beta. | beta trigger |
| ACT-84 | keep / shaping | m-2 | low: The historical mismatch failure is plausible but absent today, and the enforcement boundary is unsettled. | None for the next action. |
| ACT-86 | defer / investigation | outside committed set | medium: Repeated note loss is material, but the approved prose mitigation is not installed and must later be observed. | ACT-115; later real shape/build card write Work belongs to the linked dotfiles/corpus repository; this directive audits only Rehearsal. |
| ACT-90 | defer / investigation | outside committed set | low: Archived ID reuse is confirmed, while its current CLI-version-specific operational effect is unsettled. | scratch-board comparison on 1.50.1 and 1.51.0; owning DOT-71 coordination |
| ACT-92 | defer / implementation | outside committed set | low: Production replay wiring is correct but only its helper is pinned by tests. | None for the next action. |
| ACT-93 | defer / implementation | outside committed set | low: A twice-decided live-root branch lacks a direct injected test, but current behavior works and the milestone outcome is met. | None for the next action. |
| ACT-95 | keep / implementation | m-3 | medium: A settings-only edit currently yields a wrong fresh answer on a trust-critical command. | None for the next action. |
| ACT-96 | defer / shaping | outside committed set | low: File roles would make the step modal auditable, but the record must distinguish declared role from observed use before implementation. | Role provenance semantics are unset. |
| ACT-97 | defer / shaping | outside committed set | low: Openable evidence would reduce audit time, but the immutable transcript bytes and locator contract must be defined first. | Transcript retention and locator semantics are unset. |
| ACT-98 | defer / shaping | outside committed set | low: Contribution phrases are a presentation aid with no scheduled consumer and no current correctness cost. | Contribution layout is not scheduled.; It is unsettled whether the phrase is derived or agent-produced. |
| ACT-99 | defer / shaping | outside committed set | low: A paid culprit opinion is speculative until operators show that existing findings do not support diagnosis efficiently. | User benefit and provider budget are unverified. |
| ACT-100 | defer / shaping | outside committed set | low: Stable checkpoint labels help cross-screen navigation, but the value can likely be derived without schema growth. | Persistence versus render-time derivation is unset. |
| ACT-101 | defer / shaping | outside committed set | low: Version distance is useful context, but the repository records no ordered corpus-version history from which to compute it. | The identity and ordering of a corpus version are undefined. |
| ACT-102 | keep / implementation | m-7 | low: Median and range make comparison-arm summaries scannable and are already derivable from the complete grade distribution. | None for the next action. |
| ACT-103 | defer / shaping | outside committed set | low: Numeric word counts enable verbosity comparisons, but multi-turn pipeline aggregation is unspecified. | Which replies count for a multi-turn stage is unset. |
| ACT-105 | defer / shaping | outside committed set | low: Provider duration is useful, but summing provider calls is not wall-clock time and conflicts with ACT-149's accepted elapsed-time scope. | Metric name and concurrency/partial-chain policy are incorrect or unset. |
| ACT-106 | defer / implementation | outside committed set | low: Passing the preflight baseline forward removes redundant git I/O with a small, observable change. | None for the next action. |
| ACT-107 | defer / implementation | outside committed set | low: The stale sentence is a small rule violation duplicated in product and gallery copy. | None for the next action. |
| ACT-108 | defer / implementation | outside committed set | low: The internal gallery visibly duplicates the table label; the fix is independent and tiny. | None for the next action. |
| ACT-109 | keep / shaping | m-7 | medium: Per-rep outcomes directly enable the accepted comparison table and cannot be recovered from the persisted aggregate distribution. | No prerequisite for shaping; coordinate session presentation with ACT-146 without making it a prerequisite for existing reports. |
| ACT-110 | defer / shaping | outside committed set | low: Per-file impact is valuable for the corpus screen, but the current free-text record and undefined last-edit concept cannot support a correct build. | Structured cause schema and last-edit semantics are unset. |
| ACT-112 | defer / shaping | outside committed set | low: Silent first-hash-wins can make attribution confident over unstable evidence, but the desired product behavior is not settled. | Refuse-versus-warning behavior is unset. |
| ACT-114 | keep / implementation | m-7 | medium: A real-record browser smoke test is required for m-7, but the evidence it needs does not exist on this checkout. | ACT-69 or equivalent real three-arm, multi-case comparison evidence. |
| ACT-115 | defer / implementation | outside committed set | medium: The approved lines are absent from dotfiles main and rendered skills, blocking ACT-86. | external dotfiles ownership; review-instructions workflow Work belongs to the linked dotfiles/corpus repository; this directive audits only Rehearsal. |
| ACT-116 | keep / implementation | m-3 | medium: Capture cannot reuse harness-owned evidence, which adds manual work to session-case construction. | None for the next action. |
| ACT-117 | keep / implementation | m-3 | medium: Budget headroom is fixed, but budget exhaustion is still mislabeled as model rejection. | None for the next action. |
| ACT-118 | keep / implementation | m-2 | medium: Committed prefixed cases are not runnable from a fresh clone without an ignored duplicate. | None for the next action. |
| ACT-120 | defer / implementation | outside committed set | low: iterate now prevents unbounded repeats after a stage, but still spends one redundant stage before detecting stale status/records. | external dotfiles ownership Work belongs to the linked dotfiles/corpus repository; this directive audits only Rehearsal. |
| ACT-121 | merge / implementation | outside committed set | medium: It is an exact duplicate of ACT-117's only remaining outcome. | merge into ACT-117 |
| ACT-123 | defer / shaping | outside committed set | low: Raw pipeline transcripts enable observed context, but the card has no acceptance criteria, retention contract, or downstream pipeline-manifest owner. | Destination, immutability, retention, failure handling, and consuming outcome are unset. |
| ACT-127 | defer / shaping | outside committed set | medium: Repeated false card facts distort planning; prose now asks for checks but no observed guard meets AC2. | None for the next action. Work belongs to the linked dotfiles/corpus repository; this directive audits only Rehearsal. |
| ACT-128 | defer / implementation | outside committed set | low: The comments are false but runtime refusal remains correct. | None for the next action. |
| ACT-129 | defer / shaping | outside committed set | low: Three error encodings remain, but current behavior safely refuses links and only diagnostics/caller complexity suffer. | ACT-128; ACT-132 (Done prerequisite retained for handoff) |
| ACT-131 | keep / investigation | m-7 | medium: Accepted history shows an intermittent guard failure, but current frequency and exact race remain unproven. | None for the next action. |
| ACT-133 | defer / investigation | outside committed set | low: Realpath cannot identify an outside-original hardlink, and link-count refusal would reject legitimate corpora for a threat model that is absent today. | No accepted untrusted-corpus threat model or non-destructive policy exists. |
| ACT-134 | keep / implementation | outside committed set | high: Live layout-root symlinks can still place foreign bytes behind a confident digest; the declared extent from ACT-141 supplies the missing trust predicate. | ACT-141 |
| ACT-138 | defer / shaping | outside committed set | medium: Shared-tree mutation can silently invalidate another session's evidence; no enforcement exists in this repo. | external review/delegation corpus ownership Work belongs to the linked dotfiles/corpus repository; this directive audits only Rehearsal. |
| ACT-140 | keep / shaping | m-7 | high: Confirmation execution blocks the authorized two-case comparison; without it no session group exists to compare. | No prerequisite for shaping; provider-level behavior remains unverified until the Claude executable is available. |
| ACT-141 | keep / shaping | outside committed set | high: This establishes the live trust boundary and is the feasible prerequisite for the remaining layout-root containment hole. | None for the next action. |
| ACT-142 | keep / shaping | outside committed set | medium: A refused instruction file currently blanks run history, but the response contract and CLI stale behavior must be chosen together. | Structured run-history refusal placement and CLI behavior are unset. |
| ACT-143 | keep / shaping | m-3 | medium: The approved skill experiment needs actual variant delivery with fixed surrounding inputs. Delay postpones the new experiment while comparison prerequisites are resolved. | No prerequisite for shaping; provider-level behavior remains unverified until the Claude executable is available. |
| ACT-144 | keep / shaping | m-3 | medium: The approved triage fixture needs CLI-built board and git history; static file copying cannot run its setup. | No prerequisite for shaping; provider-level behavior remains unverified until the Claude executable is available. |
| ACT-145 | keep / shaping | m-3 | medium: The experiment grades board and git state; without preserved state a grader correction requires another paid session. | No prerequisite for shaping; provider-level behavior remains unverified until the Claude executable is available. |
| ACT-146 | keep / shaping | m-3 | medium: A repeated single-case experiment needs session-aware quality and valid uncertainty. Existing two-case support can deliver independently before the estimator decision. | Full experiment waits on ACT-140, ACT-143, ACT-144, ACT-145 and the split multi-case compatibility slice. Single-case estimator remains design work. |
| ACT-147 | keep / shaping | m-3 | medium: Correcting graders on saved evidence avoids repeated provider cost in the approved experiment. | Implementation waits on ACT-145 preserved state; shaping can inspect current schema now. |
| ACT-148 | keep / shaping | m-3 | medium: Observed errors and repeated commands explain the experiment cost using already saved session transcripts. | No prerequisite for shaping; provider-level behavior remains unverified until the Claude executable is available. |
| ACT-149 | keep / shaping | m-3 | medium: Elapsed time distinguishes equally priced variants in the approved experiment; delay is affordable until session comparisons exist. | Implementation waits on ACT-146 session comparison contract. |
| ACT-150 | keep / shaping | outside committed set | medium: Unreadable and looping layout entries can still fail the whole corpus screen; one shared classifier should prevent a third divergent error vocabulary. | Shared entry-failure classifier boundary needs a short design pass. |
| ACT-151 | keep / shaping | m-7 | high: Smallest session comparison capability unlocks the existing budgeted m-7 run. | ACT-140 must establish session group evidence before this implementation. |
| ACT-152 | keep / implementation | m-2 | medium: The operator guide directs readers around already fixed defects and to one operator’s target path. | Read-only verification available; paid examples are documentation only. |

ACT-137: completed by its owner during the sweep; only its misleading title and a title-change note were edited. The source tree and current corpus route support the new title.

## Attached records

- [Factual evidence](<doc-69 - Triage-rehearsal-factual-evidence.md>): independent audits, retained parent probe code and output, and scoped verification.
- [doc-62 recovery](<doc-62 - Triage-rehearsal-evidence-and-recovery-A.md>).
- [doc-63 recovery](<doc-63 - Triage-rehearsal-evidence-and-recovery-B.md>).
- [doc-64 recovery](<doc-64 - Triage-rehearsal-evidence-and-recovery-C.md>).
- [doc-65 recovery](<doc-65 - Triage-rehearsal-recovery-4.md>).
- [doc-66 recovery](<doc-66 - Triage-rehearsal-recovery-5.md>).
- [doc-67 recovery](<doc-67 - Triage-rehearsal-recovery-6.md>).
- [doc-68 recovery](<doc-68 - Triage-rehearsal-recovery-7.md>).

Decision-10 records the rejection of caller-root wiring as a fix for quoted-path fragments; the identical-output probe above is the reason. Reconsider when a producer exposes structured path spans, or a test demonstrates a root-aware mechanism that removes the fragment while preserving non-path text. No work is removed from an existing card for that rejection.

- [Final corrections and independent review](<doc-70 - Triage-rehearsal-final-corrections-and-review.md>).

The actual `pick()` function in the installed iterate implementation returned **ACT-140** from the live ready list. The script and the proposed first action agree. Later Medium ties can still select an external/deferred card (for example ACT-115) before the document’s manual sequence; retain truthful priorities and re-triage before that boundary.
