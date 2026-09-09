---
id: ACT-148
title: explain session tool errors and repeated commands from saved transcripts
status: Shape
assignee: []
created_date: '2026-09-09 15:49'
updated_date: '2026-09-09 16:22'
labels: []
milestone: m-3
dependencies: []
references:
  - src/benchmark/transcript.ts
  - src/benchmark/session-record.ts
documentation:
  - backlog/docs/doc-59 - Session-skill-benchmark-scope.md
priority: medium
type: feature
ordinal: 144008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The report located wasted turns by manually parsing transcripts: repeated CLI repair commands and work after a review invocation. Session attempts retain the raw transcript, but transcript.ts projects only tool uses and output styles; attempt metrics do not provide an error or repetition summary.

Derive tool-call counts, observed tool-result errors, and repeated commands with source locations from retained session transcripts. Keep observed repetition separate from a claim that a repeat was wasteful. Distinguish an observed zero from unavailable evidence, and respect resumed-session boundaries. Start with calls and locations; phase/token attribution requires a separate definition and is not a promised result of this card. ACT-123 owns capture for pipeline stages and does not block diagnostics over session evidence already saved. First verification target: a saved transcript with repeated Bash calls, one error, and a prefix outside the measured attempt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A saved session transcript yields tool-call counts, observed tool errors and repeated commands with locations the reader can inspect (João’s approved session benchmark scope, doc-59)
- [ ] #2 Calls in a resumed transcript prefix are excluded from the measured attempt’s diagnostics (João’s approved session benchmark scope, doc-59)
- [ ] #3 The diagnostic output distinguishes missing or insufficient transcript evidence from an observed absence of errors or repeats (João’s approved session benchmark scope, doc-59)
- [ ] #4 Repeated commands are reported as observations without automatically classifying them as wasted work (João’s approved session benchmark scope, doc-59)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: shaping. Priority: medium. Observed errors and repeated commands explain the experiment cost using already saved session transcripts.

Evidence: HEAD 3438d1f (product code unchanged from 1d02c8e). session-probes.ts: tool_result is_error input parses to an empty toolUses record; TranscriptLine exposes only toolUses/outputStyle and no diagnostic result.

Unresolved claims/resources: No prerequisite for shaping; provider-level behavior remains unverified until the Claude executable is available.

Next action: Shape a read-only transcript diagnostic with source locations, prefix exclusion and unavailable-vs-zero semantics.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
