---
id: ACT-33
title: >-
  refuse a missing transcript prefix as a precondition instead of failing with a
  raw ENOENT
status: Done
assignee: []
created_date: '2026-09-03 04:46'
updated_date: '2026-09-03 11:58'
labels: []
dependencies: []
ordinal: 35008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A session case whose declared transcript prefix is not on disk fails with a raw ENOENT at exit 1 rather than a refused precondition at exit 3. The prefixes are gitignored under .benchmark-runs/cases/<case>/, so a fresh clone has four committed brief-reply cases whose transcript files do not exist and whose only signal is a stack trace naming an absolute path.

Reproduced 2026-09-03 during ACT-25's review fixes, by moving .benchmark-runs/cases/brief-reply-40878d26/40878d26-3572-4a08-a668-4e4c275e462e-cut-491.jsonl aside and running:

    rehearsal run --case brief-reply-40878d26 --model haiku --effort low --session-budget-usd 0.01

which printed 'single-rep evidence, not a score' and then "ENOENT: no such file or directory, open '.../40878d26-...-cut-491.jsonl'", exiting 1.

It costs no money: prepareSession runs before the provider call, and since ACT-25's digest verification the file is read even earlier, by the hash, so the ENOENT now comes from there. The likely fix is a stat-and-refuse in the same place the digest is checked, throwing SessionInputError naming the case and the missing file, which session-run-command already maps to exit 3. A fresh clone also wants to be told how to recapture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 rehearsal run on a session case whose declared transcript prefix is absent exits 3, not 1, and prints a message naming the case and the missing file rather than a raw ENOENT
- [x] #2 The refusal happens before any provider call: the attempt record is not written and no cost is recorded
- [x] #3 A test pins the refusal, and fails against the current behavior by reporting the ENOENT
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed at triage 2026-09-03, in commit 5973452, because the fix was one guard at the site the card named and the card's own reproduction is the acceptance observation.

The guard is in verifiedPrefix (src/benchmark/session-attempt.ts), where the digest stream was throwing the ENOENT: an absent prefix now throws SessionInputError, which session-run-command already maps to exit 3.

Also removed, in the same commit: src/cli/session-run-command.ts created the record directory before the refusal could run, so every refusal left an empty attempt directory under .benchmark-runs/sessions. runSessionAttempt already creates that directory when it has something to write, so the earlier call was redundant.

Observed directly, the card's own command with the prefix moved aside:

    rehearsal run --case brief-reply-40878d26 --model haiku --effort low --session-budget-usd 0.01

exits 3 and prints 'Case brief-reply-40878d26 declares transcript 40878d26-...-cut-491.jsonl, but no file is at <path>. The prefix bytes are git-ignored run state; recapture them with `rehearsal case capture`.' No attempt record was written, no cost recorded, and a diff of .benchmark-runs/sessions/brief-reply-40878d26/ before and after shows no new directory. The prefix was restored afterwards.

Criterion #3: the test 'refuses a declared transcript prefix that is not on disk, naming the case and the file, before any provider call' was written first and observed failing against the old code with exactly the ENOENT the card reports. Full suite 1017 pass, 0 fail; typecheck, lint, and format clean.
<!-- SECTION:NOTES:END -->
