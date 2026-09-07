---
id: ACT-37
title: 'freeze a harness-owned settings file for stage sessions, no hooks'
status: To Do
assignee: []
created_date: '2026-09-03 23:33'
updated_date: '2026-09-07 10:46'
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
- [ ] #1 A pipeline or replay case can declare a settings file carrying the permissions deny list, effort, output style selection, and feature switches
- [ ] #2 A stage session run with --setting-sources project reads the declared settings file's values, observed once directly against a real claude invocation
- [ ] #3 The declared settings file contains no hooks key and the harness does not read or install any hooks configuration for a stage session
- [ ] #4 The declared settings file's content is part of the stage's recorded lineage, so changing it stales the checkpoint the same way a corpus edit does
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
<!-- SECTION:NOTES:END -->
