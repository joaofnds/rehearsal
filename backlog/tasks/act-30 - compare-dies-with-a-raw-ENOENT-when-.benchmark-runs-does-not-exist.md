---
id: ACT-30
title: compare dies with a raw ENOENT when .benchmark-runs does not exist
status: To Do
assignee: []
created_date: '2026-09-03 02:34'
updated_date: '2026-09-04 00:54'
labels: []
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
- [ ] #1 `rehearsal compare <manifest>` on a checkout with no .benchmark-runs directory does not exit 1 with a raw ENOENT
- [ ] #2 A clone's first whole-suite run, in a checkout with no .benchmark-runs directory, records no failure caused by that directory's absence, observed by running the suite once on a fresh clone placed where no sibling nest/ resolves

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
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-03: both halves re-measured on a fresh clone of this repository at 516e842 (git clone, bun install --frozen-lockfile, /tmp/act30probe).

Criterion #1 reproduces exactly as written. `bun test src/benchmark/comparison-loader.test.ts` alone fails 'writes one read-only comparison report without external execution' with "ENOENT: no such file or directory, scandir '/private/tmp/act30probe/.benchmark-runs'", exit 1. 17 pass, 1 fail.

Criterion #2 does not measure what the card says it measures. A whole `bun test` on that same fresh clone reports 1015 pass, 1 fail, and the comparison-loader test is NOT the failure: an earlier test creates .benchmark-runs, so the ENOENT is hidden when the suite runs together. The single fresh-clone failure is 'loadCase > resolves the declared target to a directory that exists' in case.test.ts, because cases/audit-log/case.json declares target.path '../../../nest/token' relative to the checkout, resolving to a sibling repository that a clone elsewhere does not have. That is a different defect from compare's, and it is the one ACT-26's final summary attributed to 'ACT-26.4's target test'.

ACT-26's final summary says trunk has 'five pre-existing failures' on a fresh clone. That is now one. The local checkout runs 1016 pass, 0 fail.

Consequence for this card: criterion #2 as written can be satisfied without fixing anything in compare, and cannot be satisfied at all by compare's fix, since its failure has an unrelated cause. Recommend splitting the outside-repo target off; see the triage doc.

Triage 2026-09-04: the defect is wider than the card and than the 2026-09-03 note state. Measured on a fresh clone at 45c522c placed so no `nest/` sibling resolves (/tmp/deep2/a/b/c/rehearsal; the 2026-09-03 probe at /tmp/act30probe still resolved ../../../nest/template to the real one on this machine, which is why it saw fewer failures).

A clone's FIRST `bun test`, before .benchmark-runs exists, fails 5. Every run after fails 1. Four of the five are this card's ENOENT, not one:
- loadComparisonEvidence > writes one read-only comparison report without external execution
- rehearsal > prints only the report path for a valid manifest, and nothing on stdout otherwise
- rehearsal > prints exactly the report JSON on stdout with --json
- rehearsal > delivers a record larger than the pipe buffer whole on stdout

The fifth is ACT-34's. Reproduce with: clone to a path with no `nest/` sibling above it, `bun install --frozen-lockfile`, then `bun test` once and read the failure list; run it a second time and four of the five are gone because an earlier test created .benchmark-runs.

So the cost of leaving this card is a first-run experience that fails 5 tests for a new contributor, three of them in the CLI suite the card never mentions, and all of them self-healing on the second run, which is the shape of defect that wastes the most of someone's time.
<!-- SECTION:NOTES:END -->
