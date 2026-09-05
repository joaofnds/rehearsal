---
id: ACT-44
title: list runs cannot see a stopped run and prints a raw ENOENT for it
status: To Do
assignee: []
created_date: '2026-09-04 02:14'
updated_date: '2026-09-05 16:46'
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

Shape 2026-09-05 (iterate, session 91811225): the card's premise is off. A stopped run never writes <id>.json at all; the stop throws past the writer. What exists is <id>.<stage>.json with status STAGE_JUDGE_FAILED, a different shape from a run record (no caseId, no top-level grade). So list and show must treat the stopped-stage file as a second legitimate run outcome, not repoint a lookup. Probed after the session, on this checkout: 8 runs on disk are in that state, 1 (02-56-43) has a passed shape file and nothing after it, and 4 (12-48, 14-49, 14-51, 15-42) have only a checkpoints directory and no json at all. All 13 print raw ENOENT from list runs. Acceptance #3 as written excludes the last five (no record exists), yet they produce the same raw error, so the fix should give them a plain 'no record' line too. The session's claim that a stop puts a stack trace in front of the operator at run time is refuted: the top-level handler prints only the message and exits 1. Whether a judged stop should exit 0 is a separate question, not this card. Open question to João: keep this card to list/show only (recommended), or widen it to the run-time exit code.
<!-- SECTION:NOTES:END -->
