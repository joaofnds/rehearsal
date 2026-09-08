---
id: ACT-61
title: record the project half of the context manifest
status: Shape
assignee:
  - '@claude'
created_date: '2026-09-04 15:11'
updated_date: '2026-09-08 17:22'
labels: []
dependencies:
  - ACT-41
  - ACT-59
documentation:
  - backlog/docs/doc-9 - context-manifest-design.md
priority: medium
ordinal: 58008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The corpus half of what an agent loads is the engineer's global instruction set, varied by --corpus. The project half is the target repository's own instructions and documents: its CLAUDE.md or AGENTS.md, its GLOSSARY.md, and the documents a stage reads off a card. Nothing records them today.

These are a property of the target, not of the corpus. They vary per case, not per corpus arm. Conflating them would let a corpus A/B silently change the target's documents too, which would make every such comparison uninterpretable.

Depends on ACT-41. That card establishes exactly this corpus/project separation for CLAUDE.md, and it deletes the code that installs the control repository's project file into the target. Building project-context tracking on top of the current conflation would bake the conflation in.

Depends on ACT-59 for the observation mechanism: the manifest is where a project-half entry lands, and the reconciliation machinery is the same.

Open question this card must answer rather than assume: whether a case declares its project context explicitly, the way it declares corpus files, or whether the harness discovers it from the target tree. Explicit declaration is checkable but goes stale against a target that changes; discovery is always current but cannot tell a document the stage read from one that happened to be present.

Design: backlog/docs/doc-9 - context-manifest-design.md
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A session attempt whose transcript carries a Read tool_use on a declared project file (a fixture-relative path, resolved under the attempt directory rather than under .claude/) reports that file as a project-half manifest entry, named by its fixture-relative path
- [ ] #2 A declared project-file entry the session never reads is reported as an unloaded-file divergence, and a project-half Read the case never declared is reported as an undeclared-file divergence, both distinguishable from a corpus-half divergence by the half tag on the entry (mirrors ACT-59 AC#5/#6 for the corpus half, applied to the project half this card adds)
- [ ] #3 Building the extended manifest and its divergence report makes no provider call, exercised by a test over a committed fixture the way ACT-59's manifest-probe fixture does for the corpus half
- [ ] #4 A session case declares its project context explicitly as a new field shaped like corpusFiles (fixture-relative paths). This covers project instructions and GLOSSARY.md, and a session-case fixture document reachable the same way; a pipeline stage's own 'documents a stage reads off a card' (the card description's third project-half example) is out of this card's scope, filed as ACT-123, because a pipeline stage session's raw transcript is not captured anywhere today so it cannot be observed (Implementation Notes below; direction, 2026-09-07, quoted below, on declared-not-discovered)
- [ ] #5 An attempt's recorded context manifest tags every entry with its half, corpus or project, as one field on each manifest entry (not two parallel path lists a reader must cross-reference), so a reader can tell which vary with --corpus by reading one entry (card description: 'The manifest distinguishes corpus-half entries from project-half entries')
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Direction, 2026-09-07: a case declares its project context explicitly, rather than the harness discovering it, for attributability. This answers doc-28's open question, restated unanswered in doc-33 and doc-36. The card is unblocked.

Bet, 2026-09-08: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet.

Shaped 2026-09-08.

Goal: a session case declares its target's own project instructions and other
project documents explicitly, and its attempt's context manifest reports what
actually loaded from that declared set, tagged corpus-half or project-half, so
a corpus A/B is checkable against project-document drift the same way ACT-59
made corpus divergence checkable.

Scope decision, made this session: pipeline-stage attempts are out of this
card. Verified directly (reviewer sub-agent, cross-checked against
workflow.ts/run.ts/checkpoint.ts myself): a pipeline stage session's raw
transcript is never captured anywhere. workflow.ts's runWorkflowStage keeps
only the parsed StageTranscript.exchanges (contracts.ts:243-249); the .jsonl
file Claude Code writes is never copied out, unlike session-attempt.ts:315-318
which does exactly that for a session case. "Observed from transcript" is
therefore structurally unreachable for a stage today. This gap predates this
card, is not in ACT-59/ACT-41/ACT-60's dependency chain (all three built and
scoped to session-case attempts only, confirmed by grep: contextManifest
exists only on SessionAttempt, filesRead/skillsInvoked are wired only through
session-attempt.ts), and the card's own description frames "an attempt record"
generically but every dependency it names is session-case machinery. Building
pipeline-stage transcript capture into this card would silently multiply its
size against a foundation nothing has laid. Filed as a follow-up rather than
absorbed: pipeline-stage context-manifest tracking needs its own transcript-
capture mechanism first (recommend a card titled around "capture a stage
session's raw transcript the way a session-case attempt does").

Approach: only one survives. Extend the existing session-case declaration and
ContextManifest/reconcileManifest code ACT-59 built, rather than building a
second manifest mechanism:
- case.ts's session declaration schema gains projectFiles: string[] (default
  []), fixture-relative paths, mirroring corpusFiles's shape exactly (case.ts:82).
  Rejected: reusing corpusFiles for both halves and inferring the half from
  whether a path is corpus-layout-shaped — this is the card's own open question
  from the description, and the direction already answered it (declared, not
  inferred/discovered): a project file has no reason to look like a corpus
  layout path (a target's CLAUDE.md is corpus-shaped by coincidence, but
  GLOSSARY.md and a card document are not), so shape-sniffing would silently
  misclassify.
- context-manifest.ts's ContextManifest.paths (currently readonly string[])
  becomes readonly { path: string; half: "corpus" | "project" }[], or an
  equivalent tagged shape. session-record.ts's contextManifestSchema and
  manifestDivergenceSchema need the same tag. This is a breaking shape change
  to an optional, additive-only field (schemaVersion stays 1, following
  corpusOrigin's precedent per ACT-59's notes), not a new parallel field,
  because AC#2 asks for one manifest a reader can filter, not two manifests to
  reconcile against each other.
- observedManifest gains a second parameter (declared project-relative paths,
  or the attempt directory) so a Read path can be classified: project-half
  when it resolves under the attempt directory and is not a .claude/ suffix,
  corpus-half via the existing isCorpusLayoutPath/.claude/-suffix logic
  (context-manifest.ts:20-42, unchanged). session-attempt.ts's recordAttempt
  is the one call site to update (mirrors how it already threads
  sessionCase.declaration.transcript?.cut through today).
- reconcileManifest reconciles against the union of corpusFiles and
  projectFiles, carrying the half through to each ManifestDivergence so AC#4's
  distinguishability holds without a second reconciliation pass.

First test to write: a context-manifest.test.ts case asserting observedManifest
tags a fixture-relative Read path (e.g. "NOTES.md", already present and read
in the manifest-probe fixture's prompt) as { path: "NOTES.md", half: "project" },
against declared projectFiles: ["NOTES.md"]. It fails today: NOTES.md is read
by the manifest-probe fixture case right now but produces no manifest entry at
all (corpusLayoutSuffix/isCorpusLayoutPath both reject it silently), so this
also closes a live gap in the existing fixture, not just a new case.

Nothing else to plan: the data-model change (tagged manifest entries) is the
one place this card revisits a shape ACT-59 fixed, named above with its
reason. Everything else is mechanical extension of ACT-59's own pattern.

Glossary: no new term needed. Context manifest and Project instructions are
already both entered (GLOSSARY.md) and already state the two-halves concept
this card implements; this card is the two-halves concept becoming code, not
a new concept.

Review, 2026-09-08 (adversarial-review, one unprimed reviewer, one round).

Three findings, all folded:

- Should-fix, confirmed directly (grep session-run-command.ts:179): the Notes'
  approach section said "session-attempt.ts's recordAttempt is the one call
  site to update," true only for observedManifest. reconcileManifest's actual
  and only production call site is session-run-command.ts:179
  (reconcileManifest(attempt.contextManifest, sessionCase.corpusFiles)), in
  buildAttemptRecord. A build session following the old wording could satisfy
  observation (AC#1) while leaving divergence reporting (AC#2, AC#4) wired to
  corpusFiles alone, silently dropping the project half there. Corrected below.

- Should-fix, confirmed by re-reading the card's own description against doc-9:
  both use "the documents a stage reads off a card" in a context that is
  unambiguously pipeline-stage terminology, and my exclusion of pipeline-stage
  attempts (correct on its own evidence: transcript capture is structurally
  absent, see below) was recorded only in Notes prose, not reflected in AC#1
  itself, and the "follow-up" it gestured at was a recommended title, not a
  filed card. AC#1 rewritten to say explicitly what it covers (a session-case
  fixture document) and what it doesn't (pipeline-stage card documents),
  naming ACT-123, filed this round, as where the excluded piece goes.

- Note, folded: AC#2 as first written ("tags every entry with its half") was
  satisfiable by two parallel arrays (corpusPaths/projectPaths) without a
  per-entry tag, which the approach section explicitly rejects but the AC text
  didn't rule out. Rewritten to say "one field on each manifest entry (not two
  parallel path lists)."

Two notes disposed with no change: the reviewer confirmed every current-state
claim in the approach section (ContextManifest.paths shape, corpus-layout
suffix logic, corpusFiles schema, contextManifestSchema/manifestDivergenceSchema
shapes, the pipeline-stage transcript-capture absence, the NOTES.md gap) reads
correctly against the code as of this session; no correction needed there.

Correction to the approach section above: reconcileManifest's declared-paths
argument is built and passed at session-run-command.ts:179
(sessionCase.corpusFiles today), not inside session-attempt.ts. The build
session must update that line to pass the union of corpusFiles and the new
projectFiles field (or an equivalent structure carrying both with their
halves), not just observedManifest's call inside recordAttempt.

Filed: ACT-123, capture a pipeline stage session's raw transcript, so a
context manifest can observe what a stage actually loaded. No dependency
edge between it and ACT-61: neither blocks the other, they are independent
cards on the same design (doc-9) that happen to share a card-description
sentence.

Probed during the iteration, 2026-09-08: context-manifest.test.ts:69-73 asserts
observedManifest([readUse("/tmp/attempt/NOTES.md")], []).paths equals [], which
pins today's silent-drop as intended behavior. The first test named above is not
a pure addition: that existing case must be rewritten (a Read outside the corpus
layout and outside the declared project set still names no path), or the build
session will read a red test as its own regression.
<!-- SECTION:NOTES:END -->
