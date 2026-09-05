---
id: ACT-30
title: compare dies with a raw ENOENT when .benchmark-runs does not exist
status: Build
assignee: []
created_date: '2026-09-03 02:34'
updated_date: '2026-09-05 23:29'
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
- [ ] #1 rehearsal compare <manifest> on a checkout with no .benchmark-runs directory does not exit 1 with a raw ENOENT/scandir error
- [ ] #2 bun test src/benchmark/comparison-loader.test.ts passes 'writes one read-only comparison report without external execution' on a fresh clone before .benchmark-runs exists

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

- [ ] #3 bun test src/cli/rehearsal-cli.test.ts passes its three compare-path tests ('prints only the report path for a valid manifest', 'prints exactly the report JSON on stdout with --json', 'delivers a record larger than the pipe buffer whole on stdout') on a fresh clone before .benchmark-runs exists
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shaped 2026-09-06.

Cause found: loadJudgeAgreementReport in src/benchmark/judge-agreement.ts:369
calls readdir(runsDirectory, { withFileTypes: true }) with no .catch, unlike
run-layout.ts's entries() helper (the established pattern: absent directory
is nothing recorded, not a failure). writeComparisonReport calls it before
the mkdir that creates .benchmark-runs, so any first compare on a fresh
clone throws the raw ENOENT.

Confirmed by reproduction on a fresh clone (git clone, bun install
--frozen-lockfile, bun test src/benchmark/comparison-loader.test.ts): fails
'writes one read-only comparison report without external execution' with
ENOENT: no such file or directory, scandir '<dir>/.benchmark-runs', exit 1,
17 pass / 1 fail. Stack trace traced to judge-agreement.ts:369.

The three rehearsal-cli.test.ts failures the 2026-09-04 triage listed go
through the same call path (runCompare -> writeComparisonReport ->
loadJudgeAgreementReport) and share this one cause; no separate work needed
for them.

Card's original criterion #2 (whole-suite fresh-clone run) is dropped: the
2026-09-03/04 triage already found its remaining failure is ACT-34's target-
resolution defect, unrelated to this card and unfixable by it. Acceptance
rewritten to the four tests this card's fix actually controls.

Only one sane way to build it: match the existing entries() tolerance
pattern in run-layout.ts, or wrap this one readdir in the same
.catch(() => []). No approach survey needed.

First test to write: the already-failing
'writes one read-only comparison report without external execution' in
comparison-loader.test.ts is the reproduction; it should go green with no
other test regressing.

Oversight 2026-09-06: the shape session's --ac flags appended rather than replaced, leaving the old criteria #1 and #2 beside the new ones. #2 is unmeasurable by this fix (its failure is ACT-34's) and would have blocked the Done guard. Criteria now replaced with the three the shape session settled on. Cause probed and confirmed independently: judge-agreement.ts:369 readdir with no .catch, unlike run-layout.ts entries().
<!-- SECTION:NOTES:END -->
