---
id: ACT-9
title: record the pipeline definition in the run artifact
status: Done
assignee: []
created_date: '2026-08-30 17:02'
updated_date: '2026-08-30 17:59'
labels: []
dependencies: []
type: feature
ordinal: 1008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The run artifact (RunArtifact in src/benchmark/contracts.ts, written in src/benchmark/run.ts) records every input that varies per run: model, efforts, session budget, the rubric and its IDs, the instructions, and every SHA. It does not record the pipeline definition.

Before ACT-1 the stage sequence was the WORKFLOW_STAGES constant, so the harness's own code identified which stages a run executed and the artifact did not need to say. The sequence is now read from a file selected by --pipeline, so two artifacts can differ in which stages ran, in what order, against which rubrics, with nothing in either artifact saying so.

This blocks reading old artifacts correctly and it blocks the comparison work: ACT-6 reports paired comparisons between corpus versions, and a comparison whose two arms ran different pipelines is not a comparison. ACT-2's checkpoint lineage has the same need.

## Goal

A run artifact states, on its own, which pipeline the run executed: the parsed PipelineDefinition and the path it was loaded from.

## Shaping notes

### What was read

- `RunArtifact` is assembled once, at src/benchmark/run.ts:449, after the final Judge returns. The only other writes are `{...artifact, status: "COMPLETE", calibration}` after calibration and `{...pendingArtifact, status: "FAILED"}` on abort, both spreading the same object. A run that fails before the final Judge writes no run artifact at all; the abort path has nothing to spread.
- `loadPipeline(config.pipelinePath)` is the first statement of `runBenchmark` (src/benchmark/run.ts:273), before the target is claimed. Both the definition and the path are in scope where the artifact is built. No plumbing is needed.
- Per-stage scorecards are written as each stage completes (`context.stageFile`), independently of the run artifact. `StageScorecard` carries `stage` (the name) and `rubricPath`, not `kind`. The kind is already recoverable from a scorecard because `StageJudgeInput.kind` is set from the definition and the whole input is embedded in the scorecard.

### Unknowns and how each was resolved

1. Does the stage scorecard need its own `kind` field? No. `scorecard.input.kind` already carries the declared kind and is written to every scorecard file. Adding a second copy at the top level duplicates a fact the file already states, and two copies can disagree. The card raised this as "consider"; the consideration resolves to no. If a later reader wants the kind at the top level, the pipeline definition on the run artifact gives every stage's kind by name.
2. Store the definition parsed, or the raw file text? Parsed. `PipelineDefinition` is the shape every downstream reader (ACT-2 lineage, ACT-6 pairing) compares against, defaults are already applied, and the rest of the artifact stores parsed values (`rubricIds`) rather than source text. Raw text would force each reader to re-parse against a schema that may have moved on.
3. What is `pipelinePath` relative to? The control repository root, as `--pipeline` accepts it and as `loadPipeline` resolves it against `CONTROL_DIR`. Store the configured relative path, not the absolute one, so artifacts compare across machines. This matches `sourceRoot`/`sourceOrigin` being the only absolute paths in the artifact and those being machine facts by intent.
4. Should a run that fails before the final Judge record its pipeline? Out of scope here, but named so it is not lost: no run artifact exists on that path at all, for any field, and fixing that is a change to when the artifact is first written. That belongs with ACT-2's checkpoint work, which needs a record at every stage transition anyway. Not part of this task.

### Design

Add two fields to `RunArtifact` in src/benchmark/contracts.ts, next to `rubric`/`rubricIds` since they are the same kind of fact (the frozen contract this run ran under):

    readonly pipelinePath: string;
    readonly pipeline: PipelineDefinition;

Populate them at src/benchmark/run.ts:449 from the `pipeline` already loaded at line 273 and from `config.pipelinePath`. `contracts.ts` already imports from `./pipeline` (`StageKind`), so no new module edge.

### Glossary

No new terms. "Pipeline definition" and "Run artifact" are both already defined in GLOSSARY.md and the task uses them as defined.

### First test to write

In run-benchmark.test.ts, against the run artifact assembly: a run configured with a non-default `--pipeline` produces an artifact whose `pipelinePath` is that path and whose `pipeline.stages` are that file's stages, not the default four. The existing `runGradedStages` tests already build pipelines inline (run-benchmark.test.ts:1450), so a non-default definition is cheap to state. Write the non-default case first: it fails for the right reason today and it subsumes the default case.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A completed run's artifact contains the pipeline definition it executed and the path it was loaded from
- [x] #2 A run with a non-default --pipeline records that definition, not the default one
- [x] #3 The recorded pipeline path is the path as configured, relative to the control repository, so two artifacts from different machines compare equal
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What changed

The run artifact now carries two fields next to `rubric`/`rubricIds`: `pipelinePath` (the path relative to the control repository) and `pipeline` (the parsed `PipelineDefinition`, defaults applied). Both come from values `runBenchmark` already had in scope.

Assembling the artifact was a thirty-field object literal inside `runBenchmark`, which cannot run under test because everything past `claimTarget` calls live Claude sessions. It is now `buildRunArtifact`, a pure function. That extraction was not in the shaping notes; it is what made a test-first step possible. The notes proposed testing through `runGradedStages`, but that function never sees the run artifact.

`parseArgs` now reduces `--pipeline` to its path relative to the control repository. Criterion 3 was not met without this: an absolute `--pipeline` was stored verbatim, so the same pipeline recorded a machine-specific string, and a path through ".." recorded a third string for the same file. Paths that escape the repository still reduce to one starting with "..", which `loadPipeline`'s containment check rejects as before.

## What became possible but is not wired up

Nothing consumes the new fields. ACT-6's paired comparison and ACT-2's checkpoint lineage are the intended readers; both can now tell whether two artifacts ran the same pipeline. No existing reader changed, because nothing outside run.ts reads `RunArtifact`; there is no `readArtifact` and no schema on read.

Artifacts written before this change lack the fields. No reader breaks today, but a future reader must treat both as possibly absent on an old file.

## What was observed, and how

- Wrote each test first and watched it fail for the predicted reason: `Export named 'buildRunArtifact' not found`, then the three path forms disagreeing.
- Direct observation: ran a script calling `buildRunArtifact` and serializing the result as `writeArtifact` does, then read the file back. It contains the relative path and the four default stages with `requiresAcceptanceCriteria` defaults applied.
- Ran `--pipeline` as an absolute path, a traversal, and `/etc/passwd` through `parseArgs` into `loadPipeline`: the in-repo absolute reduces to `pipelines/default.json` and loads; both escapes are refused as outside the control repository.
- `bun test`: 115 pass, 0 fail, fresh run. `bun run typecheck`: clean. `bun run check:apply`: formatting fixed and committed.

## What was not verified

No end-to-end benchmark run; that costs real money and calls live Claude sessions. That `runBenchmark` reaches `buildRunArtifact` with the loaded pipeline rests on reading the call site, not on watching a run. Recorded on ACT-10, which owns making that function testable.

## Independent review

Run, by the reviewer agent, on the first commit. It found two defects, both now fixed in their own commits: the pipeline path was not normalised, so criterion 3 failed for absolute and non-canonical arguments; and the test asserting that failed to catch it, because it asserted a relative string it had written itself was relative. The replacement goes through `parseArgs` and fails without the fix. The reviewer also verified field-by-field that the `buildRunArtifact` extraction preserves all 33 original fields in order, and that both the FAILED and COMPLETE spread paths carry the new fields.

The README's artifact field list did not mention the pipeline; fixed.

## Stopped on

`runBenchmark` is 253 lines and mixes orchestration with process-lifecycle handling: signal registration, abort recording, five mutable variables, no test coverage of the abort path. Filed as ACT-10.
<!-- SECTION:NOTES:END -->
