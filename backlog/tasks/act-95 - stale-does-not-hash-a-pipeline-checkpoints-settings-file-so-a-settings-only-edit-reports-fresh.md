---
id: ACT-95
title: >-
  stale does not hash a pipeline checkpoint's settings file, so a settings-only
  edit reports fresh
status: To Do
assignee: []
created_date: '2026-09-07 16:24'
updated_date: '2026-09-09 16:21'
labels: []
milestone: m-3
dependencies: []
priority: medium
type: bug
ordinal: 91008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Have rehearsal stale include each run's current declared stage settings hash when deriving checkpoint staleness.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A pipeline checkpoint whose stage settings file changed since it was recorded is reported stale by rehearsal stale, the same way a corpus edit is reported stale today
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Filed from ACT-37's own reflection (doc-29, 2026-09-07): its handoff names this gap outside its four acceptance criteria. No milestone; independent of ACT-37 (Done) and ACT-59/60 (m-3, different corpus kind).

Triage 2026-09-08 (d): the framing undersells what already exists. Verified 2026-09-08: deriveStaleness (src/benchmark/checkpoint.ts:479-482) already compares record.settingsFile?.sha256 against request.settingsFile?.sha256 and adds a cause on mismatch, and replay.ts:398 and replay-confirmation.ts:130 already wire settingsFile through correctly. The actual gap is narrower and lives in one call site: staleCheckpoints (src/benchmark/staleness-report.ts, the function rehearsal stale calls) never populates settingsFile on its request, so it reads as undefined there regardless of the checkpoint's real settings hash. Fix targets that one call site, not deriveStaleness.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: implementation. Priority: medium. A settings-only edit currently yields a wrong fresh answer on a trust-critical command.

Evidence: deriveStaleness supports settingsFile, but staleCheckpoints supplies none and tests contain no settings-only case.

Unresolved claims/resources: None for the next action.

Next action: Hash the current declared settings in staleCheckpoints and add a settings-only regression.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
