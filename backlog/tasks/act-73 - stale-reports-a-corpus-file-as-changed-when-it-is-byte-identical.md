---
id: ACT-73
title: stale reports a corpus file as changed when it is byte-identical
status: Done
assignee: []
created_date: '2026-09-05 00:41'
updated_date: '2026-09-06 13:24'
labels: []
milestone: m-1
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
- [x] #1 Running stale against a corpus copy that is byte-identical to the recorded one reports nothing
- [x] #2 A case's recorded corpus hash is compared against the same file the run would read
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Filed by the iterate session running ACT-39's replay. The audit-log line in the same output was correct, so the defect is specific to this case's brief.md, not to stale generally.

2026-09-06, baseline regenerated at João's direction ('agree, regen'). The card is still not reproducible, for a different reason than before.

What was missing: .benchmark-runs is git-ignored and was empty on this machine, so the run the card names (2026-09-05T00-21-40.070Z) and the transcript prefix were both absent. 'rehearsal stale' printed nothing because there was nothing recorded to compare.

What was rebuilt: the transcript prefix was recaptured from session 92b2e8b0-1cac-4855-87be-ba84d5cee5b9 at cut 1268, sha256 matching the pin in case.json exactly, so it is the original bytes and case.json is unchanged. Then 'rehearsal run --case brief-reply-92b2e8b0 --model sonnet' recorded a fresh attempt (935649b6, cost 1.02 USD).

Why it still does not reproduce: the fresh record hashes output-styles/brief.md as 1d1bc829, and the live file hashes 1d1bc829 too, so stale correctly reports nothing. The card's recorded hash was 96b0863f. brief.md has changed between 2026-09-05 and today, so the exact byte-identical-yet-reported condition the card describes cannot be recreated from what is on disk.

This does not show the defect was fixed. It shows the evidence is gone. Deciding between the two needs either a run recorded against the 96b0863f version of brief.md, or a test that drives the comparison directly with a controlled hash instead of a real run. The second is cheaper and does not depend on recovering an old file.

Related: the regen surfaced ACT-89, where session checks count a seeded transcript prefix as behavior under test. That is a live defect with direct evidence, unlike this one.

2026-09-06, probed against the rebuilt baseline. Both criteria hold in the current code; no fix was needed or written.

Criterion #1: made a byte-identical copy of the live corpus (/tmp/act73-corpus, brief.md sha256 1d1bc829, matching ~/.claude/output-styles/brief.md exactly) and ran 'rehearsal stale --corpus /tmp/act73-corpus'. It reported nothing. The bare 'rehearsal stale' also reports nothing, so the live install no longer reports itself stale.

Discrimination probe, to rule out stale simply having nothing to examine: appended one comment line to the copy's brief.md (sha256 becomes 44bd5793) and re-ran the same command. It printed 'case:brief-reply-92b2e8b0\toutput-styles/brief.md changed'. So the command is reading the recorded attempts and comparing real digests, and it distinguishes an identical file from an edited one.

Criterion #2: caseStaleness in staleness-report.ts:251 hashes the case's declared corpusFiles from the corpus root under test via hashCorpusFiles, then compares against the recorded digests. One root, the same files the run reads.

Likely cause of the original report, inference not established: 91495ba (2026-09-05 18:24, after this card was filed at 00:41) renamed the corpus rules root from rules/ to rulebook/ in checkpoint.ts. That is the 'resolved from a different root' mechanism the card suspected. It cannot be confirmed, because the run the card cites was in the git-ignored .benchmark-runs tree and is gone from this machine.

Closing on observed behavior rather than on a located fix. If the false positive returns, the run record is the evidence to keep.
<!-- SECTION:NOTES:END -->
