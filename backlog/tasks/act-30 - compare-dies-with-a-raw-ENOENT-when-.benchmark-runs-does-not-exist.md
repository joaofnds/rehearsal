---
id: ACT-30
title: compare dies with a raw ENOENT when .benchmark-runs does not exist
status: Review
assignee: []
created_date: '2026-09-03 02:34'
updated_date: '2026-09-05 23:32'
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
Fixed 2026-09-06, commit d70a596. loadJudgeAgreementReport (judge-agreement.ts:369) now wraps readdir(runsDirectory) with .catch(() => []), matching run-layout.ts's entries() tolerance pattern: an absent .benchmark-runs is nothing recorded, not a failure.

Observed directly: rm -rf .benchmark-runs, then ran 'writes one read-only comparison report without external execution' in comparison-loader.test.ts, which spawns the real 'bun run rehearsal.ts compare' subprocess. Directory was confirmed absent beforehand, the subprocess exited 0, and .benchmark-runs/comparisons was created by that run — this is the actual CLI path, not just the test harness.

Verified fresh-clone-equivalent (rm -rf .benchmark-runs before each): comparison-loader.test.ts full file green (18/18), the three named rehearsal-cli.test.ts compare tests green (3/3). Full suite green (1053/1053), typecheck clean, lint clean, fmt:check clean.

Scope: one line in one file, matching the card's named single approach. No refactor triggered — the fix itself already conforms to the established pattern in the codebase, nothing else to extract.

Not verified: criterion #2 of the card's original shape (whole-suite fresh-clone run) was already dropped by the shape session as unmeasurable by this fix (its remaining failure is ACT-34's target-resolution defect); not reopened here.

Card status set to Review per a code change.

Oversight probe 2026-09-06: reproduction confirmed independently on a fresh clone at d70a596 with .benchmark-runs absent. The two named test files pass 65/65. Reverting only the fix commit in that clone brings back exactly the four failures the card names (comparison-loader's read-only report test and the three compare-path CLI tests); restoring it clears them. Note for anyone repeating this: rehearsal.ts gates on Bun 1.4.0, so a clone without the repo's .mise.toml trusted runs 1.4.1 and every CLI test fails on the version message rather than on anything under test.
<!-- SECTION:NOTES:END -->
