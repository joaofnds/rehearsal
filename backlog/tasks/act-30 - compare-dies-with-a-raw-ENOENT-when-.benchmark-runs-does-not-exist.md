---
id: ACT-30
title: compare dies with a raw ENOENT when .benchmark-runs does not exist
status: Done
assignee: []
created_date: '2026-09-03 02:34'
updated_date: '2026-09-05 23:37'
labels: []
milestone: m-2
dependencies: []
references:
  - ACT-34
priority: medium
ordinal: 32008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`rehearsal compare <manifest>` exits 1 with `ENOENT: no such file or directory, scandir '<control>/.benchmark-runs'` on any checkout that has never recorded a run, because comparison evidence loading enumerates the runs directory without tolerating its absence. `.benchmark-runs` is git-ignored, so this is every fresh clone.

Observed on a fresh clone of this repository at 721601b: `bun test src/benchmark/comparison-loader.test.ts` fails `writes one read-only comparison report without external execution` with that message, and keeps failing after `rm -rf .benchmark-runs`. Reproduced at 3798639 too, so it predates ACT-26.2.

Every other listing treats an absent directory as nothing recorded and exits 0 (`run-layout.ts`'s `entries` catches and returns []). `compare` should do the same, or refuse it as a precondition (exit 3) naming what is missing, rather than surfacing a raw filesystem error as an execution failure.

Found while fixing ACT-26.2's review findings; out of that card's scope because it is compare's code (ACT-26.1's) and reproduces before this card's first commit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 rehearsal compare <manifest> on a checkout with no .benchmark-runs directory does not exit 1 with a raw ENOENT/scandir error
- [x] #2 bun test src/benchmark/comparison-loader.test.ts passes 'writes one read-only comparison report without external execution' on a fresh clone before .benchmark-runs exists

Rejudging the same discuss stage
{
  "hardBlockers": [
    {
      "id": "invalid-stage-delivery",
      "status": "PASS",
      "evidence": [
        {
          "source": "task",
          "path": "backlog-seed.md",
          "claim": "evidence"
        }
      ]
    },
    {
      "id": "contradiction",
      "status": "PASS",
      "evidence": [
        {
          "source": "artifact",
          "path": "backlog/docs/spec.md",
          "claim": "evidence"
        }
      ]
    }
  ],
  "requirements": [
    {
      "id": "scope",
      "status": "FAIL",
      "evidence": [
        {
          "source": "artifact",
          "path": "backlog/docs/spec.md",
          "claim": "evidence"
        }
      ]
    }
  ],
  "dimensions": [
    {
      "id": "clarity",
      "grade": "B",
      "evidence": [
        {
          "source": "artifact",
          "path": "backlog/docs/spec.md",
          "claim": "evidence"
        }
      ]
    }
  ],
  "summary": "stage grade",
  "grade": "C",
  "verdict": "STOP"
}
Target restored to 3f5236c54fbee9e43c33e15cdbc387b38684089a.

Custom checks

Treatment checks

Treatment checks

Treatment checks
Which scope?
Product Owner: Use the small scope
Shaped
Shaped
Shaped
Which scope?
Product Owner: Use the small scope
Which scope?
Product Owner: Use the small scope
Which scope?
Product Owner: Use the small scope
Which scope?
Product Owner: Use the small scope, in a checkout with no .benchmark-runs directory, records no failure caused by that directory's absence, proven by running the whole suite once on a fresh clone

- [x] #3 bun test src/cli/rehearsal-cli.test.ts passes its three compare-path tests ('prints only the report path for a valid manifest', 'prints exactly the report JSON on stdout with --json', 'delivers a record larger than the pipe buffer whole on stdout') on a fresh clone before .benchmark-runs exists
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Review 2026-09-06. Verdict: proceed, no blocking or should-fix findings.

Suite: bun test under pinned Bun 1.4.0 (ambient PATH bun was 1.4.1, rejected by
rehearsal.ts's own version gate; unrelated to this diff). 1053/1053 pass,
typecheck/lint/fmt:check clean. Independently reverted judge-agreement.ts to
confirm the original ENOENT crash reproduces, then restored the fix and
confirmed all three named acceptance tests pass with .benchmark-runs absent.

Axes run: Spec, Style/Architecture, Security, Refactoring (all four apply to a
3-line diff). Testing axis skipped: no test file in the diff.

Spec: conformant. The diff takes the "treat absence as nothing recorded, exit
0" branch the card offered as one of two valid options, matching run-layout.ts's
documented rationale for the identical entries() helper. All three acceptance
criteria verified directly against a fresh-clone-equivalent state.

Security: no defect. runsDirectory is not attacker-influenced in the shipped
CLI path (traced from rehearsal.ts's fixed CONTROL_DIR through every call
site); entry.name from readdir cannot carry a traversal segment.

Findings, all notes, none change the verdict:
- The .catch(() => []) swallows every readdir error, not just ENOENT (a
  permissions error or a runsDirectory that's actually a file would silently
  read as "nothing recorded"). Pre-existing: the precedent this fix matches
  (run-layout.ts's entries()) has the same blanket catch, and the same idiom
  already exists unconsolidated in two more files (corpus-source.ts,
  backlog.ts) plus calibrate-command.ts. Revert test: this behavior predates
  the change.
- No dedicated unit test exercises loadJudgeAgreementReport against a missing
  runsDirectory; coverage is indirect via the end-to-end CLI/loader tests
  named in the acceptance criteria. Considered as a should-fix and downgraded:
  the named acceptance tests already pin this exact regression at the
  behavior boundary that matters (the CLI path), and the same indirect-only
  coverage shape predates this change in the sibling helper.
- The catch duplicates run-layout.ts's entries() one-liner instead of sharing
  it. Considered as a should-fix and downgraded by the revert test: entries()
  is module-private (unexported), so reuse would mean exporting it from a file
  outside this fix's scope, and the idiom is already duplicated in three other
  files this change didn't touch. Pre-existing debt, one more instance.
- loadJudgeAgreementReport is already a ~60-line multi-branch function; this
  change adds 2 lines to it without restructuring. Note only, friction on the
  surrounding code, not created by this change.

No card required for the duplication or the missing-directory test gap: both
are pre-existing, spread across multiple files, and not concentrated enough to
name a single fix target.

Oversight 2026-09-06: the review session returned verdict proceed with all criteria checked and no blocking findings, but left the card in Review. Moved to Done by the overseeing session; the guard permits it (every criterion checked, no definition-of-done items, no open dependencies).
<!-- SECTION:NOTES:END -->
