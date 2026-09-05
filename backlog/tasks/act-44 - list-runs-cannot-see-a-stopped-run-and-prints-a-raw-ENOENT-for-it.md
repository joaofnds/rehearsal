---
id: ACT-44
title: list runs cannot see a stopped run and prints a raw ENOENT for it
status: Done
assignee:
  - '@claude'
created_date: '2026-09-04 02:14'
updated_date: '2026-09-05 17:01'
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
- [x] #1 list runs reports a run that stopped at a stage, naming the stage it stopped at
- [x] #2 show on that run id prints the record that exists on disk
- [x] #3 No raw filesystem error reaches the operator from list runs or show for any run present on disk. A run with no record of any kind (checkpoints directory only) gets a plain line saying no record exists.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-05: acceptance #1 re-verified live. `./rehearsal.ts list runs` on this checkout prints raw ENOENT for both stopped runs now on disk (2026-09-04T02-09-23.870Z and 2026-09-04T17-34-35.900Z), unchanged from the card's 2026-09-04 observation. Independent of ACT-63/64, which were filed after this card and touch a different failure class on the same milestone path.

Shape 2026-09-05 (iterate, session 91811225): the card's premise is off. A stopped run never writes <id>.json at all; the stop throws past the writer. What exists is <id>.<stage>.json with status STAGE_JUDGE_FAILED, a different shape from a run record (no caseId, no top-level grade). So list and show must treat the stopped-stage file as a second legitimate run outcome, not repoint a lookup. Probed after the session, on this checkout: 8 runs on disk are in that state, 1 (02-56-43) has a passed shape file and nothing after it, and 4 (12-48, 14-49, 14-51, 15-42) have only a checkpoints directory and no json at all. All 13 print raw ENOENT from list runs. Acceptance #3 as written excludes the last five (no record exists), yet they produce the same raw error, so the fix should give them a plain 'no record' line too. The session's claim that a stop puts a stack trace in front of the operator at run time is refuted: the top-level handler prints only the message and exits 1. Whether a judged stop should exit 0 is a separate question, not this card. Open question to João: keep this card to list/show only (recommended), or widen it to the run-time exit code.

João, 2026-09-05, on the open question: "agree". The card stays on list and show reading what is on disk. The run-time exit code for a judged stop is out of scope here and gets its own card only if João asks. Acceptance #3 rewritten to cover runs with no record at all, per the recommendation he agreed to.

Shape 2026-09-05, second pass (iterate, session 39210a8f): judged the card shaped and named the build path: try the run record, then the stopped-stage file, then a plain no-record line for a checkpoints-only run. Existing path helpers already cover the stage file and the checkpoints entry. Moved to Build by the overseer since the session left the column unchanged.

Build 2026-09-05: fixed. list runs and show both looked only for the run artifact <id>.json; a run that stops at a stage never writes one, it overwrites the stopping stage's own <id>.<stage>.json with a status: STAGE_JUDGE_FAILED record instead. Added run-outcome.ts (stoppedStage) and run-layout.ts's runStageFiles to find that record among a run's stage files. list runs now prints STOPPED:<stage> with the caseId read from the manifest; show prints the stop record's own bytes, falling back to raw text in the non-json summary path too since the run-summary schema does not fit a stop record. A run with a checkpoints directory and manifest but no artifact and no stop record (died before any stage finished) gets a plain 'no record' line in list runs and a clean RefusedPreconditionError in show, both replacing the raw ENOENT.

Verified directly against the 13 real broken runs on this checkout: all print clean lines under list runs (8 STOPPED, 5 no record, matching the shape-stage triage counts), show run:<stopped-run> and --json both print the stage's stop record, show run:<no-record-run> refuses by name with exit code 3. Full suite green (1031 tests), typecheck and lint clean.

No follow-up filed. The run-time exit code for a judged stop stays out of scope per João's 2026-09-05 'agree' on the card.

Reflection 2026-09-05: doc-14. Verdict on track; goal (m-1) unaffected either way since this card was never on the ACT-39 critical path. Next: ACT-42, ACT-43, then ACT-39.

Reflect 2026-09-05 (iterate, session 86a441b7): verdict on track, doc-14. Its next step named ACT-43 and ACT-39 as open; both were Done on the board before it ran (ACT-39 closed on the first real replay at 03:50, ACT-43 at 18:39). doc-14 corrected by the overseer; only ACT-42 of doc-12's three independent cards remains open.
<!-- SECTION:NOTES:END -->
