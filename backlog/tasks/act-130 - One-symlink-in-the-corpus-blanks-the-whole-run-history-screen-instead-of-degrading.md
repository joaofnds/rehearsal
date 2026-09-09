---
id: ACT-130
title: >-
  One symlink in the corpus blanks the whole run-history screen instead of
  degrading
status: Review
assignee:
  - '@claude'
created_date: '2026-09-08 22:41'
updated_date: '2026-09-09 01:03'
labels: []
milestone: m-5
dependencies: []
priority: high
ordinal: 126008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 with a symlink planted in a corpus layout directory, GET /api/runs renders its rows and reports the corpus problem alongside them, rather than returning 500 with no rows (reproduced 2026-09-09: corpusReport on a directory corpus with agents/escape -> outside threw SymlinkedEntryError, and staleCheckpoints reaches the same walk)
- [x] #2 the same corpus problem leaves rehearsal stale reporting what it could read rather than exiting on the first unreadable tree (src/cli/stale-command.ts:81 calls staleCheckpoints on the same path)
- [x] #3 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
- [x] #4 with a symlink planted at agents/escape.md in a corpus layout directory, runHistoryReport resolves rather than rejecting, and its rows include every run it could read (reproduced 2026-09-09: runHistoryReport rejected with SymlinkedEntryError on that corpus)
- [x] #5 on that same corpus every checkpoint row whose stage could not be hashed carries stale true and a cause naming the offending entry relative to its layout directory, never stale false (deriveStaleness checkpoint.ts:567 leaves a stage absent from current unjudged, and run-history.ts:188-196 states a silently wrong stale badge is worse than the cost of hashing)
- [x] #6 a symlink planted under skills/build leaves a stage whose skill is discuss hashed and judged normally, marking only the stages that read the broken tree (probed 2026-09-09 via captureStageCorpus: build threw, discuss hashed; a link under agents/ threw for both)
- [x] #7 mise exec -- ./rehearsal.ts stale --corpus <corpus with the planted symlink> exits 0 and prints the stale records it could derive on stdout, where it printed zero lines and exited 3 before (reproduced 2026-09-09: same corpus without the link printed 6 records)
- [x] #8 no cause or reason reaching the browser or stdout contains an absolute filesystem path or the linked target's bytes (ACT-113 closed this leak deliberately; staleCauses is not passed through redactAbsolutePaths at run-history.ts:171)
- [x] #9 the existing refusal for a corpus whose CLAUDE.md is itself a symlink still throws RefusedPreconditionError and prints nothing on stdout (src/cli/stale-command.test.ts:309, which must stay green)
- [x] #10 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by the security and architecture reviewers on ACT-113 (commit 438145a), independently, both with a reproduction.

src/server/run-history.ts:202 awaits staleCheckpoints OUTSIDE the try block that starts
at :213. That function's own docstring at :188-196 states the intent this violates: 'a
corpus file staleCheckpoints cannot resolve, is collected rather than thrown ... so a
single bad run cannot blank the whole response the way an uncaught throw would.'

The path is staleCheckpoints -> currentStageCorpus -> captureStageCorpus -> hashDirectory.
Before ACT-113 that walk followed a planted symlink and rendered (leaking); now it throws,
and api.ts's onError turns the throw into a 500 for the whole screen. So ACT-113 traded a
leak for an outage on this surface. The leak was the worse of the two and closing it was
right, but the degraded mode this file already promises was never wired to this call.

ACT-113's shaping accepted the 500 for /api/corpus explicitly and considered no other
surface. This one and  were not considered.

Not folded into ACT-113: deciding what the screen shows when the corpus cannot be hashed
is a product question the card did not shape, and it changes what the endpoint delivers.

The gap is pre-existing in structure (the call has always sat outside the try). What
changed is that a reachable input now throws through it.

Correction to the line above: the sentence should read "This one and the stale command were not considered." A backtick swallowed the phrase when the note was written.

Triage 2026-09-09, premise check on AC#2. The criterion cites src/cli/stale-command.ts:81 as calling staleCheckpoints unguarded. Read this run: line 80 already wraps that call in refusingCorpusFailures. The wrapper (stale-command.ts:35-50) catches only CorpusSourceError and CorpusFileError and rethrows everything else, and SymlinkedEntryError (checkpoint.ts:84) extends Error directly, so it is not caught. The criterion's behavior stands; its stated cause does not. The writer's evidence stays as written above.

The reproducing command, per decision-1: plant a symlink in a corpus layout directory, then run mise exec -- ./rehearsal.ts stale --corpus <that root>.

Bet, 2026-09-08: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet.

## Shaped 2026-09-09

Goal: a corpus tree that cannot be hashed marks the checkpoints that read it as
stale with the refusal as their cause, so /api/runs still renders every row and
`stale` still prints what it could derive.

### The pick

Catch SymlinkedEntryError inside `currentStageCorpus` (src/benchmark/staleness-report.ts),
per stage, around the `captureStageCorpus` call. The stage records the refusal
message instead of a file list, `deriveStaleness` emits it as a cause, and
downstream stages inherit it through the existing `staleUpstream` chain.
`staleCheckpoints` keeps returning `readonly StaleRecord[]`. `RunHistoryRow` does
not change, so no client work follows. The only caller edit is that
stale-command.ts's `refusingCorpusFailures` no longer needs to wrap that call; it
still wraps `resolveCorpusSource` and the CLAUDE.md read.

Why this and not the alternatives, so a later session starts from the argument:

1. Leave it. Ruled out by the card's own AC #1 and #2, which are directions.
2. Catch at each of the two callers. Ruled out: two encodings of one rule, and
   `rowFor`'s existing catch pushes no row, so the endpoint would still lose the
   affected rows.
3. Catch per run inside `staleCheckpoints` and return the `StalenessReport` shape
   `staleCases` returns, with `checkpoint:` ids in `unreadable`. This was the
   shaping session's own first answer. Ruled out on two checked facts: checkpoint.ts:567
   leaves a stage absent from `current` unjudged, so the row would render
   `stale: false`, and client/src/run-history/run-history-page.tsx reads only
   `body.rows`, never `unreadable`, so the operator would see a clear badge on a
   corpus that cannot be hashed. That is precisely the silently-wrong badge
   run-history.ts:188-196 calls worse than the hashing cost.
4. Skip the linked entry in the walk. Ruled out by ACT-113, which made the
   refusal deliberate to close a leak.

The pick follows the precedent `caseStaleness` (staleness-report.ts:254-283)
already sets in this same module for session cases: an unhashable corpus file is
a cause, "rather than a failure that hides every other case's answer."

### Unknowns and how each resolved

1. Where does the degrading belong, and in what shape?
   Settled by the decide skill. The shaping session answered "inside
   staleCheckpoints, as a collected unreadable entry"; the blind advisor answered
   "inside currentStageCorpus, as a per-stage cause." They agree on the layer and
   part on the shape. The advisor's answer won on two facts this session probed
   directly rather than inherited, both recorded under option 3 above.

2. Is the refusal per tree or per stage? Per stage.
   Probed 2026-09-09 with a throwaway bun:test calling captureStageCorpus: a link
   at skills/build/escape.md threw for skill "build" and hashed clean for skill
   "discuss"; a link at agents/escape.md threw for both. So a per-run catch would
   over-mark the first case. This is what defeated the shaping session's objection
   that one bad tree would falsely mark every checkpoint.

3. Does the cause message leak an absolute path, given staleCauses is not
   redacted at run-history.ts:171?
   No. `captureStageCorpus` passes `rootMayBeALink: true`, so `refuseIfLink`'s
   absolute-root branch is unreachable and `symlinkedEntry` names the entry as
   `join(prefix, entry)`. Observed in the probe above: "agents/escape.md resolves
   outside the tree it is named under, so its bytes are not the ones that tree
   holds". AC #5 pins this rather than trusting it.

4. Does the pick break the existing CLI refusal for a symlinked CLAUDE.md?
   No. That test (stale-command.test.ts:309) plants the link at CLAUDE.md, which
   fails in `readCorpusInstructions` at staleness-report.ts:156, outside the tree
   walk this change touches. AC #6 pins it green.

5. Was AC #2's stated cause correct? No, and the earlier triage note was also
   wrong about the consequence. stale-command.ts:80 does wrap the call, and the
   wrapper does catch SymlinkedEntryError (it is in the instanceof list at :45).
   But it converts it to RefusedPreconditionError, which by this CLI's contract
   prints nothing on stdout. So the command still reports nothing.
   Reproduced 2026-09-09: exit 3, zero stdout lines, against the same corpus that
   printed 6 stale records without the link.

### Reproduction, per decision-1

    c=$(mktemp -d); cp -RL ~/.claude/CLAUDE.md ~/.claude/skills ~/.claude/agents \
      ~/.claude/output-styles "$c/"; mkdir -p "$c/rulebook"; cp -RL ~/.agents/rulebook/. "$c/rulebook/"
    o=$(mktemp -d); printf 'secret\n' > "$o/secret.md"; ln -s "$o/secret.md" "$c/agents/escape.md"
    mise exec -- ./rehearsal.ts stale --corpus "$c"

Run 2026-09-09: exits 3, prints nothing on stdout, stderr carries
"agents/escape.md resolves outside the tree it is named under". Without the
`ln -s` line the same corpus exits 0 and prints 6 stale records. Note `cp -RL`
rather than `cp -R`: the live ~/.claude/CLAUDE.md and the layout directories are
themselves symlinks, and copying them as links makes the corpus fail at
CLAUDE.md, which is a different path from the one under test.

### Glossary

No new domain terms. The change uses stale checkpoint and cause as GLOSSARY.md
already defines them. It does widen "cause" from "an input that changed" to
include "an input that could not be read", which is the reading GLOSSARY.md's
Stale case entry and `caseStaleness` already took for session cases, so this
makes the two kinds agree rather than introducing a concept.

### First test to write

In src/benchmark/staleness-report.test.ts, against a corpus whose agents/
directory holds a planted symlink: `staleCheckpoints` resolves, and the record
for the affected checkpoint carries a cause containing "agents/escape.md
resolves outside the tree it is named under". It fails today by rejecting with
SymlinkedEntryError.

### Parked, needs someone else's call

A corpus with a missing or symlinked CLAUDE.md, and one with a missing skill
directory, still return 500 from /api/runs (readCorpusInstructions at
staleness-report.ts:156; resolveSkillDirectory throws a plain Error, and
api.test.ts:308 asserts only redaction on it). The CLI is pinned the other way
for both by ACT-132 AC #16 and stale-command.test.ts:234-257. Nothing on the
board records whether the API should degrade there too. This shaping scopes the
change to the tree walk and leaves that question open. Exact question: should
/api/runs degrade for a corpus whose CLAUDE.md or skill directory is missing or
symlinked, the way it will now degrade for a symlink inside a layout directory,
or is a 500 correct there because the corpus source itself is unusable?

### Decided autonomously

Scope the degradation to the tree walk inside readable layout directories, leaving /api/runs returning 500 when CLAUDE.md or a required skill directory is missing or symlinked. Reason: when CLAUDE.md or the skill directory cannot be resolved, the corpus source itself is unusable as a precondition. The degradation shaped here addresses stages that cannot be hashed during the walk, keeping /api/runs and stale functional for readable stages alongside the refusal causes.

## Built 2026-09-09

Commits:
- 2fa7bee fix: stale the stage whose corpus cannot be hashed instead of throwing
- 4075044 test: cover the run-history screen against an unhashable corpus
- 215c006 test: cover stale against a corpus layout directory it cannot hash
- ab2988f fix: keep the corpus root out of a session case's stale cause

Observed directly:
- Planted symlink in corpus layout directory: rehearsal stale exited 0, reporting stale checkpoints and relative causes.
- Test suite: 1321 tests pass, typecheck, lint, and formatting check clean.
- Moved to Review.
<!-- SECTION:NOTES:END -->
