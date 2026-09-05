---
id: ACT-73
title: stale reports a corpus file as changed when it is byte-identical
status: To Do
assignee: []
created_date: '2026-09-05 00:41'
updated_date: '2026-09-05 00:41'
labels: []
dependencies: []
type: bug
ordinal: 69008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found 2026-09-05 while preparing ACT-39's replay.

'rehearsal stale --corpus <copy>' reports 'case:brief-reply-92b2e8b0 output-styles/brief.md changed' against a corpus copy whose brief.md is byte-identical to the live file. Confirmed by control: a copy with no edits at all produces the same line, and 'rehearsal stale' with no --corpus produces it too, so the live install reports itself stale.

The copy's brief.md was taken from ~/.claude/output-styles/brief.md and its sha256 is 96b0863fbe2ea5934b5aeba9834c4222804484b4256dbb17c36e2bdd08fc3317, which matches the hash recorded in the run at .benchmark-runs/2026-09-05T00-21-40.070Z. So the recorded hash and the file agree, and staleness is still reported.

The likely cause is the case's recorded hash being compared against a file resolved from a different root than the one the run read, but that is inference, not established.

Cost: a false positive here is not cosmetic. The tool's purpose is telling an operator which checkpoints an edit invalidated. A line that appears whether or not anything changed carries no information, and an operator who learns to ignore it will ignore a true one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Running stale against a corpus copy that is byte-identical to the recorded one reports nothing
- [ ] #2 A case's recorded corpus hash is compared against the same file the run would read
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Filed by the iterate session running ACT-39's replay. The audit-log line in the same output was correct, so the defect is specific to this case's brief.md, not to stale generally.
<!-- SECTION:NOTES:END -->
