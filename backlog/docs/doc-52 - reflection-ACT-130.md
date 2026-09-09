---
id: doc-52
title: 'reflection: ACT-130'
type: other
created_date: '2026-09-09 01:15'
---

# Reflection, ACT-130

The card is Done with all 10 criteria checked, a review record, and four build
commits plus card updates recorded. Nothing is missing from the record.

## 1. What is the target condition?

ACT-130 belongs to milestone m-5 (the run-history screen). Its goal comes from
the board's standing order in doc-6/doc-7, restated in doc-50: prove the loop
once (m-1), then the UI three (m-5, m-6, m-7), then m-2, then m-3.

The bet is doc-50's queue line 2: "ACT-130 (High, m-5): the outage on the
run-history screen. Second per doc-49's order." What it expected to make
observable is that a planted symlink in a corpus layout directory degrades
gracefully rather than blanking the whole run-history table with an HTTP 500:
the screen renders all readable rows, marks affected stages as stale with
relative causes, and rehearsal stale exits 0 with derived records.

## 2. What is the actual condition now?

Observed by me at HEAD (commit 2f1de66), running the reproduction probe
directly against a fixture planted this session with agents/escape.md linked
to an outside file:

- `mise exec -- ./rehearsal.ts stale --corpus "$c"` exited 0, printing 6 stale
  records and their causes on stdout, where before this change it printed 0 lines
  and exited 3 with RefusedPreconditionError.
- Causes name the layout-relative path (e.g. `agents/escape.md added` or
  `Corpus file rulebook/engineering-judgment.md does not exist at rulebook/engineering-judgment.md`),
  with no absolute filesystem paths leaked to stdout or the browser.
- `runHistoryReport` resolves rather than rejecting, returning all readable
  checkpoint rows with stale badges and degradation causes.
- The existing refusal for a corpus whose CLAUDE.md is itself a symlink out of
  the root still throws RefusedPreconditionError and prints nothing on stdout
  (verified in stale-command.test.ts).
- Full check at HEAD, run by me: 1,321 tests pass across 85 files, 100 client DOM
  tests pass, tsc clean, oxlint clean, oxfmt clean.

Where the bet and the observation differ:
The bet held completely. The degradation was scoped per stage inside
`currentStageCorpus`, ensuring that an unhashable tree stales only the stage
reading it, while stages reading separate trees are judged cleanly.

## 3. What obstacles stand between here and the goal, and which one is next?

What the run met:
- Pre-existing gap exposed during code review: `ACT-134`. When an entire corpus
  layout directory (e.g. `<corpus>/agents`) is itself a symlink to an outside
  directory, `captureStageCorpus` passes `rootMayBeALink: true`, skipping
  refusal and hashing the outside directory's entries. Filed as ACT-134.
- Untracked temporary probe files from shaping initially failed lint and typecheck
  during the review stage; cleaned up before review completed.

What became possible:
- `currentStageCorpus` and `deriveStaleness` now support per-stage `refusedCorpus`
  reporting alongside `hashedCorpus`, giving downstream consumers structured
  staleness causes without blanking screens or crashing reports.

The next obstacle:
- The queue from doc-50 has ACT-71 (m-3, Medium), ACT-50 AC#13 / ACT-126 (m-7,
  Medium), or addressing the new corpus findings (ACT-129, ACT-134).

## 4. What is the next step, and what do you expect from it?

For triage:
Queue ACT-134 (Medium) or proceed with doc-50 queue line 3: ACT-71 (m-3, Medium:
"Close m-3 by proving the calibration loop on a real run").
If continuing corpus security consistency: ACT-129 ("Consolidate three symlink
error types and two catch blocks") or ACT-134.

Expected:
- If ACT-71 is picked: closes milestone m-3 (5/5).
- If ACT-134 is picked: closes the layout-directory symlink bypass uncovered
  during ACT-130's review.

## 5. When can the increment be seen?

From outside the session, at HEAD today:
- Run the reproduction script:
  ```bash
  c=$(mktemp -d); cp -RL ~/.claude/CLAUDE.md ~/.claude/skills ~/.claude/agents \
    ~/.claude/output-styles "$c/"; mkdir -p "$c/rulebook"; cp -RL ~/.agents/rulebook/. "$c/rulebook/"
  o=$(mktemp -d); printf 'secret\n' > "$o/secret.md"; ln -s "$o/secret.md" "$c/agents/escape.md"
  mise exec -- ./rehearsal.ts stale --corpus "$c"
  ```
  Exits 0 and prints stale checkpoint records instead of exiting 3 with empty stdout.
- `GET /api/runs` with the same corpus renders rows with degraded stale badges
  instead of returning HTTP 500.

## Verdict

On track.

The bet held. The run-history screen and rehearsal stale degrade cleanly when a
corpus layout directory contains an unhashable symlink, satisfying all 10
acceptance criteria without leaking absolute paths or targets.

## Proposals

For triage:
- Keep ACT-130 in Done (completed).
- Consider placing ACT-134 into the ready queue, or prioritize it alongside
  ACT-129 in the symlink defect bundle.
- Re-check ACT-129's premise before it runs, as noted in doc-51.

## Process defect, for kaizen

Shaping left two untracked throwaway probe files in the repository root. A stage
creating scratch probe files must clean them up in the same turn before finishing,
so subsequent review and CI runs do not stumble on untracked lint or typecheck
failures.

## Structural opportunity

`StageCorpus` in `src/benchmark/checkpoint.ts` cleanly models either a hashed
corpus or a refused corpus per stage. This abstraction can be reused if other
stage-level precondition degradations are introduced in the future.
