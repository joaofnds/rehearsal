---
id: ACT-37
title: 'freeze a harness-owned settings file for stage sessions, no hooks'
status: Done
assignee: []
created_date: '2026-09-03 23:33'
updated_date: '2026-09-07 11:46'
labels:
  - defect
dependencies: []
priority: high
ordinal: 39008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ACT-28's review found that --setting-sources project (added to restrict a
stage session to the frozen corpus) also drops the user's hooks and
settings.json, with no replacement: a confirmation/replay stage session now
runs with a different behavior-shaping surface than a live session, for
reasons the corpus snapshot doesn't record. Escalated on DOT-36; João's
answer, recorded there and on ACT-28: harness-owned, not a copy of the
user's live settings.json.

Scope: a settings file the harness itself owns and installs at project
level in the worktree, declared as data in the case (so it is corpus-like:
frozen, versioned, part of what a rep's lineage records), carrying only the
behavior-shaping keys that matter for a stage session: the permissions deny
list, effort level, output style selection, and feature switches the
harness cares about. No hooks: hooks are session tooling, not corpus under
test, and the review's recommendation (which João accepted) was that
freezing them would add real complexity for a class of drift the corpus
lineage was never meant to capture.

This file is separate from the corpus snapshot's CLAUDE.md/skills/agents/
output-styles: it's the harness's own settings surface, not a copy of
anything live, so a case declares it directly rather than the harness
discovering it from ~/.claude.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A pipeline or replay case can declare a settings file carrying the permissions deny list and feature switches (João, 2026-09-07, answer 1)
- [x] #2 A stage session run with --setting-sources project reads the declared settings file's values, observed once directly against a real claude invocation (card AC2)
- [x] #3 The declared settings file contains no hooks key and the harness does not read or install any hooks configuration for a stage session (card AC3)
- [x] #4 The declared settings file's content is part of the stage's recorded lineage in a field of its own beside model and effort, not in corpusFiles, so list stale does not report a settings change as a corpus edit (João, 2026-09-07, answer 3)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Triage 2026-09-04, re-prioritized against the project's goal (m-1, m-2, m-3): high → medium, and not assigned to a milestone.

The reflection on ACT-28 named this the next card. Against the goal João stated on 2026-09-04, it is not. The tool has never run its own pipeline: `rehearsal list runs`, `list checkpoints`, `list groups`, and `list comparisons` all return empty at 540ba9a. This card makes a stage session's settings surface match a live session's, which only pays off once stage sessions are producing comparisons somebody reads, and none exist.

It also sits behind an open direction question. João's comment #5 on ACT-28 asks whether freezing corpus bytes into the local live install is the right mechanism at all, given a second provider is a stated future requirement. This card continues that mechanism one setting-source further. Building it before that question is answered risks building the wrong thing, and the reflection said so.

So: real, correctly scoped, and waiting. Reconsider when m-1 has produced a comparison somebody has read, which is when it becomes possible to say whether the settings divergence actually changed a score.

Triage 2026-09-07: the open-question block above is stale. ACT-28's own notes (2026-09-06) state plainly that the question three prior triage runs carried forward as blocking this card 'is not open': João answered it on DOT-36, and decision-4 (2026-09-05, accepted) is that exact answer, declared and live corpus both first-class, this card's harness-owned settings file being the mechanism decision-4 names for it. Nothing further is needed from João. Restoring priority to High (doc-6's demotion to medium was explicitly because of this same open question) and moving it into the ready queue.

Bet, 2026-09-07: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet.
Shape 2026-09-07, probed by the overseeing session before the questions went up:

- Confirmed: a stage session already gets effort as its own `--effort` flag
  (`claude.ts:39`), and `lineageKey` hashes effort as a field of its own beside
  model, separate from `corpusFiles` (`checkpoint.ts:59-67`). A settings-file
  `effort` key would be a second path to an already-frozen, already-hashed knob.
- Confirmed: stage sessions have no output-style surface at all. `--settings` is
  used only on the session-case path (`session-attempt.ts:131`), never in
  `claudeArgs`, so the stage invocation has no settings overlay of any kind
  today. Adding one is new behavior, not a gap-fill.
- Confirmed: `--settings` takes an arbitrary JSON string and the session-case
  path already passes one, so the flag needs no new mechanism to accept a path.
- Refuted: the shape stage read AC1's "a pipeline or replay case can declare"
  as leaving per-case versus shared open. The description settles it. A case
  "declares it directly rather than the harness discovering it", and the file is
  the harness's own surface, not a copy of anything live. Per-case declaration
  of a harness-owned file, with a shared default, is what the card already says.
  Not a question for João.
Answered by Joao, 2026-09-07, all three as recommended:

1. The settings file carries the permissions deny list and feature switches
   only. Drop `effort` and `outputStyle` from its keys. Effort stays on the
   existing `--effort` flag and keeps its own lineage field; a stage session
   gets no output style.
2. Reach the session through the existing `--settings` flag with the file's
   path, not a new on-disk overlay in the worktree.
3. Hash the file's bytes into a new lineage field of its own, beside model and
   effort, not into `corpusFiles`, so `list stale` does not report a settings
   change as a corpus edit.

AC1 is superseded on its key list by answer 1 and should be rewritten to name
the deny list and feature switches only.

Shape 2026-09-07 (second pass): AC1 rewritten to drop effort and output style per João's answer 1. AC2-4 kept, each given its source. Answer 2 (reach the session through the existing --settings flag with the file's path, not a new worktree overlay) is the mechanism for AC2, not a separate observable, so it stays a note rather than a criterion. Card is fully answered; moving to Build.

Build 2026-09-07. Nine commits, c7d51fb..cdf113d.

AC1: a pipeline case declares an optional case-relative settingsFile; BenchmarkCase.settingsFilePath always resolves (declared file, or the harness-owned stage-settings.json at the control root). Schema (stage-settings.ts) is .strict() with permissions.deny and a fixed set of boolean feature switches only — no effort, no outputStyle, no hooks key possible. Pinned by case.test.ts and stage-settings.test.ts.

AC2: observed directly, twice, against a real claude invocation built from the harness's own claudeArgs (the same function every stage-session call site uses): with a permissions.deny:["Bash"] settings overlay passed through --settings, the model reported 'Bash was not available in this session'; with no overlay, through the identical code path, Bash ran successfully. Re-verified a third time with --dangerously-skip-permissions present (the flag every real stage session carries) after the security reviewer raised it as an open question — deny still holds under that flag.

AC3: stageSettingsSchema has no hooks key and is .strict(), so a hooks block fails to parse; grepped every changed production file, nothing reads or forwards a hooks key anywhere in the harness.

AC4: settingsFile: HashedFile is its own field on LineageInputs/CheckpointInputs/CheckpointRecord, hashed into lineageKey beside model and effort, never folded into corpusFiles. deriveStaleness compares it separately and names 'stage settings file <path> changed' as its own cause. rehearsal stale's staleCheckpoints does not yet pass a settings-file digest into deriveStaleness at all (no per-run case resolution exists there today) — a settings change currently reports as fresh under stale, a gap outside these four ACs, noted below as a handoff item rather than fixed.

Independent review, six axes (spec/style/architecture/security/testing/refactoring), one round, before Done. Suite before fixes: 1086 pass. Findings, worst first:

1. [should-fix, fixed] Testing: two tests (checkpoint.test.ts, deriveStaleness and lineageKey settings-file isolation) passed unchanged under a mutant deleting the behavior they claimed to guard, proved by actually running the mutant. Deleted; the invariants are already covered by sibling tests' negative space.
2. [should-fix, fixed] Architecture: loadStageSettings hashed the file's raw bytes while its docstring promised a canonical hash insensitive to whitespace — a reformat with no semantic change would have spuriously invalidated every checkpoint downstream. Now hashes the re-serialized JSON string, verified with a new whitespace-equivalence test.
3. [should-fix, fixed] Style: settingsFile named two different shapes (HashedFile at the checkpoint layer, {json,hashed} at the request layer) across the plumbing chain. Renamed the request-layer field to loadedSettings everywhere.
4. [should-fix, fixed] Style: loadStageSettings had no existence check, unlike its sibling readCaseDeclaration; a missing file surfaced as a raw Node ENOENT. Added an explicit check and test.
5. [should-fix, escalated to João] Spec: the harness-owned default stage-settings.json's deny-list content (git branch/checkout/worktree denials, disableBundledSkills) is my own call, traced to a real prior defect (ACT-3's worktree/branch escape) but not something this card or João's three settled answers explicitly authorized — the settled decisions fix the file's *keys*, not what a default should *contain*. Recommend: accept as-is (it only narrows authority, never widens it, confirmed by the security reviewer) unless a stricter or different default is wanted.

Security: no findings. Path confinement for a declared settingsFile reuses the existing caseRelative/confinedTo guard every other case-relative field uses. The settings JSON reaches --settings as one argv element via Bun.spawn with no shell, so no injection path regardless of content. replaySettingsFile's case-id handling reuses the same isCaseId gate declaredSessionKnobs already relies on.

Architecture: the two parallel call chains (run vs. replay, each independently unpacking .hashed/.json) match a pre-existing duplication shape from ACT-28 (settingSources: "project" hardcoded identically at the same two sites three days earlier, confirmed by git log -S) — this diff extends existing duplication, introduces none of its own. session-lineage.ts's shared lineageKey now always hashes a fifth, permanently-absent field for a session case; reviewed as the same shape effort already had, not a Divergent Change site yet.

Refactoring (advisory): three notes, same duplication observation as Architecture, a plausible-but-not-yet-real Divergent Change risk on lineageKey, and 1-2 line growth on already-hundreds-of-lines functions. No action recommended.

Full check after every fix: 1086 pass, 0 fail, typecheck/lint/format clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built and observed. All four acceptance criteria present: a pipeline case declares a settings file (or gets the harness default), reaches a real stage session through --settings (observed against a live claude process, deny list holds even under --dangerously-skip-permissions), carries no hooks key anywhere, and hashes into the checkpoint's own lineage field separate from corpusFiles.

Six-axis independent review ran before Done; four should-fix findings fixed (two mutation-proof tests deleted, a hash-provenance bug fixed so whitespace-only edits stop spuriously invalidating checkpoints, a missing-file check added, an ambiguous field name split in two). One should-fix escalated: the default stage-settings.json's specific deny-list content is my own call, traceable to a real prior defect but not explicitly authorized by this card — recommend accepting it as-is since it only narrows a stage session's authority, never widens it, or say what the default should contain instead.

Known gap outside these four ACs, for the backlog: rehearsal stale does not yet compare a settings-file digest for pipeline checkpoints (staleCheckpoints has no per-run case resolution today), so a settings-only edit currently reports as fresh under stale even though it correctly invalidates lineage on the next run or replay.
<!-- SECTION:FINAL_SUMMARY:END -->
