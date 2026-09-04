---
id: ACT-44
title: list runs cannot see a stopped run and prints a raw ENOENT for it
status: To Do
assignee: []
created_date: '2026-09-04 02:14'
updated_date: '2026-09-04 23:01'
labels: []
milestone: m-1
dependencies: []
priority: high
ordinal: 46008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A run that stops at a stage writes its record as <id>.<stage>.json, and the lister looks for <id>.json, so the completed run is unreadable and the error reaches the operator raw.

Observed 2026-09-04 immediately after ACT-38 run, on this checkout:

    ./rehearsal.ts list runs
    run:2026-09-04T02-09-23.870Z: ENOENT: no such file or directory, open ".benchmark-runs/2026-09-04T02-09-23.870Z.json"

The file on disk is .benchmark-runs/2026-09-04T02-09-23.870Z.shape.json. A stopped run is therefore invisible to list and findable only by reading the directory, which is the opposite of what list exists for. Stopping at a stage is a normal outcome, not an error path: it is what the pipeline does whenever a judge grades below the minimum.

Same class as ACT-40 (list attempts prints raw ENOENT for empty attempt directories) but on the run path, and worse, because here the record exists and is simply looked for under the wrong name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 list runs reports a run that stopped at a stage, naming the stage it stopped at
- [ ] #2 show on that run id prints the record that exists on disk
- [ ] #3 No raw filesystem error reaches the operator from either command for a run whose record exists
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-05: acceptance #1 re-verified live. `./rehearsal.ts list runs` on this checkout prints raw ENOENT for both stopped runs now on disk (2026-09-04T02-09-23.870Z and 2026-09-04T17-34-35.900Z), unchanged from the card's 2026-09-04 observation. Independent of ACT-63/64, which were filed after this card and touch a different failure class on the same milestone path.
<!-- SECTION:NOTES:END -->
