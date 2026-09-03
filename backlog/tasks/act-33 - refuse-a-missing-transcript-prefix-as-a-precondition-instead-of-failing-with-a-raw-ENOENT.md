---
id: ACT-33
title: >-
  refuse a missing transcript prefix as a precondition instead of failing with a
  raw ENOENT
status: To Do
assignee: []
created_date: '2026-09-03 04:46'
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
- [ ] #1 rehearsal run on a session case whose declared transcript prefix is absent exits 3, not 1, and prints a message naming the case and the missing file rather than a raw ENOENT
- [ ] #2 The refusal happens before any provider call: the attempt record is not written and no cost is recorded
- [ ] #3 A test pins the refusal, and fails against the current behavior by reporting the ENOENT
<!-- AC:END -->
