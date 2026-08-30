---
id: ACT-9
title: record the pipeline definition in the run artifact
status: To Do
assignee: []
created_date: '2026-08-30 17:02'
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

Add the parsed PipelineDefinition and the pipeline path to RunArtifact and write them alongside the rubric. Consider whether the stage scorecards should carry their stage's declared kind for the same reason.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A completed run's artifact contains the pipeline definition it executed and the path it was loaded from
- [ ] #2 A run with a non-default --pipeline records that definition, not the default one
<!-- AC:END -->
