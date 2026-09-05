---
id: ACT-75
title: replay accepts a corpus source and passes --setting-sources project
status: Done
assignee: []
created_date: '2026-09-05 01:07'
updated_date: '2026-09-05 01:50'
labels: []
dependencies: []
type: feature
ordinal: 71008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `rehearsal replay --corpus <directory>` runs the stage instead of refusing it
- [x] #2 A stage session under a corpus source reports a marker planted in that corpus's skill and absent from the live install, observed once directly against a real claude invocation
- [x] #3 The run's record names which corpus source produced it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Partial, 2026-09-05. The CLI now accepts --corpus on a replay; the corpus is not yet delivered to the session.

Done and committed: src/cli/replay-command.ts no longer calls refuseStageCorpus, and the test that pinned the refusal is replaced by one asserting config.corpus reaches execute. Full suite 1011 pass, typecheck, lint, fmt clean.

Left to do, and larger than the card implied. src/cli/replay-command.ts:214 sets instructions from liveCorpusInstructions() unconditionally, so --corpus is parsed and never read. The remaining work is four connected changes:

1. Resolve config.corpus through resolveCorpusSource, the way src/cli/session-run-command.ts:73 already does, and refuse a bad source as a precondition.
2. Read instructions from the resolved source instead of the live install.
3. Install the snapshot into the worktree with installStageCorpusSnapshot (src/benchmark/checkpoint.ts:270). This is the load-bearing step: src/benchmark/replay.ts hashes the chain corpus from corpusLayoutRoots(worktreeDir) at line 379 and points the session at the same roots at line 424, so installing there makes both the lineage and the session read the frozen bytes.
4. Carry settingSources: 'project' to the stage session, as src/benchmark/replay-confirmation.ts:468 already does.

One structural obstacle found while testing. ACT-28's review recorded that StageContext, the live run and replay path, has no settingSources field, and that only StageSessionEnvironment has one, populated solely by the two confirmation call sites. It called that a compiler-enforced guarantee that a plain run or replay cannot set settingSources, and load-bearing. So step 4 deliberately breaks a separation a previous review chose to keep. That is a design decision for João, not a mechanical edit.

A test I wrote against runWorkflowStage was removed: replay does not call it directly, so that is the wrong seam. The right seam is executeStageSession or the harness's stageSession fake.

Done 2026-09-05, verified by a real replay.

Observed directly: a replay of the shape stage against /tmp/rehearsal-corpus-act39 recorded CLAUDE.md as f16dd9dc5c1a3699, which is that directory's file. The live install hashes a29fbbc0044f8992. Two different bytes, and the record names the edited one, so the corpus was delivered rather than hashed and ignored. Record at .benchmark-runs/replays/80e3c699.../2026-09-05T01-48-05.794Z.json. Cost 1.61 USD across stage, product owner, and judge.

Correction to this card's earlier note: the design obstacle it recorded was wrong. It claimed finishing the card meant breaking a type-level separation ACT-28's review called load-bearing. StageSessionEnvironment, which the replay path uses, already carries settingSources (src/benchmark/run.ts:509). Nothing was reversed. The separation the review protected is on StageContext, the run path, which this change does not touch.

What changed: replay reads instructions from the resolved corpus source instead of liveCorpusInstructions, installs the snapshot into the worktree, and passes settingSources 'project'. The worktree was already where the chain corpus is hashed and where the session's roots point, so lineage and session read the same bytes without further plumbing.

Three tests pin it, one confirmed red by disabling the install. Full suite 1014 pass, typecheck, lint, fmt clean.

Left open, filed as ACT-76: the replay ran but the comparison against the baseline refused, because the corpus differed. Reading whether the edit helped still needs two records read by hand.
<!-- SECTION:NOTES:END -->
