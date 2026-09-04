---
id: ACT-65
title: a confirmed replay records frozen instructions the session never read
status: Done
assignee:
  - '@claude'
created_date: '2026-09-04 17:47'
updated_date: '2026-09-04 22:49'
labels: []
dependencies: []
type: bug
ordinal: 62008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by independent review of ACT-41, 2026-09-04, and confirmed against the code.

In a confirmed replay, replay-confirmation.ts:458 passes frozen.instructions into the stage session, which hashes those bytes into the rep's corpus record. The session itself runs with corpusRoots [worktree/.claude] (replay-confirmation.ts:466), and installStageCorpusSnapshot (checkpoint.ts:270) copies only skills, agents, and output-styles into that directory. It never copies CLAUDE.md, although snapshotStageCorpus writes one into the snapshot at checkpoint.ts:234. So the frozen instruction bytes are written to the snapshot and never read back.

Effect: edit the live corpus CLAUDE.md after a checkpoint, then run a confirmed replay. The record says the rep ran against the frozen bytes. The session read whatever is live. The measurement names a corpus the session did not use.

installStageCorpusSnapshot never copied CLAUDE.md, verified identical at 946919a. Before ACT-41, installInstructions wrote the frozen bytes into the worktree root on every replay, which masked the gap. ACT-41 removed that write, correctly, because it also overwrote the target's own project instructions. Removing it exposed the missing delivery rather than causing it.

Debug replay is not affected: replay.ts reads live (replay-command.ts:216) and searches corpusLayoutRoots(worktreeDir) (replay.ts:424), so what it hashes and what the session reads agree.

Before building, settle one fact this card does not assume: where a stage session actually reads project instructions from, given settingSources 'project' and cwd at the worktree. The fix depends on whether a project-level .claude/CLAUDE.md is loaded at all, which nobody has verified on the current claude version. The review's advisory note is that captureStageCorpus and snapshotStageCorpus take instructions as a string while every other corpus kind is resolved from roots, and that asymmetry is what allowed a write nothing reads.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A confirmed replay rep's recorded corpus CLAUDE.md hash is the bytes the replayed session actually read
- [x] #2 Editing the live corpus CLAUDE.md between a checkpoint and a confirmed replay does not change what the replayed session reads
- [x] #3 An original run's stage session reads the same corpus CLAUDE.md bytes the run record hashes for that stage
- [x] #4 The stage session's project instructions are delivered without writing to the target repository's own root CLAUDE.md
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Goal: a confirmed replay's recorded corpus CLAUDE.md hash matches the bytes the
replayed stage session actually reads, and editing the live corpus CLAUDE.md
between checkpoint and replay cannot change that.

Settled fact (verified this session, claude 2.1.260, empirical probe with a
control marker, 2026-09-05): with --setting-sources project and cwd at a
worktree root, Claude Code loads project instructions from BOTH
<cwd>/CLAUDE.md and <cwd>/.claude/CLAUDE.md. Re-check on any claude version
bump with the same probe (a temp dir, a marker string in each candidate file,
`claude --setting-sources project -p "..."`, plus a no-marker control run).

Fix site: installStageCorpusSnapshot (checkpoint.ts:270) writes skills/agents/
output-styles into <targetDirectory>/.claude/ but never writes CLAUDE.md, even
though snapshotStageCorpus (checkpoint.ts:234) already wrote CLAUDE.md into the
snapshot directory next to skills/. installStageCorpusSnapshot must also copy
that CLAUDE.md to <targetDirectory>/.claude/CLAUDE.md. It must NOT write to
<targetDirectory>/CLAUDE.md (the worktree root): that path is the target
repository's own project instructions, and ACT-41 correctly stopped
overwriting it.

Scope finding: installStageCorpusSnapshot is one function shared by the
original run (pipeline-confirmation.ts:388) and by replay-confirmation.ts:417.
Both call sites pass matching corpusRoots ([worktree]/.claude) and
settingSources: "project", and both hand the session an instructions string
that today never reaches the session's actual context the same way. The bug
and the fix are identical for a first run's own stage sessions, not
replay-specific. One function change closes both. Open question for João:
does ACT-65 cover the original run path too (recommended, same fix, same
commit), or does this card stay replay-only with a separate card filed for
run?

Advisory note carried from the review (unresolved by this shaping, worth a
follow-up card, not blocking this fix): captureStageCorpus and
snapshotStageCorpus take instructions as a bare string while every other
corpus kind (skills, agents, output-styles) is resolved from roots. That
asymmetry is what let a write exist with nothing reading it, and it is not
removed by this fix.

First test to write: a checkpoint.test.ts case around
installStageCorpusSnapshot asserting that after the call,
<targetDirectory>/.claude/CLAUDE.md exists and its bytes equal the instructions
string snapshotStageCorpus was given, using the existing test's worktree/
snapshot fixture pattern (see the two-worktree case around checkpoint.test.ts:176).
Then an integration-level check (replay-confirmation path) that edits the live
corpus CLAUDE.md between checkpoint and replay and asserts the replayed
session's recorded hash still matches the frozen bytes, not the live edit.

Scope settled by João, 2026-09-05: this card covers BOTH the confirmed replay path and the original run path. They share one function (installStageCorpusSnapshot), so one fix and one commit closes both. No separate card for run. Two acceptance criteria were added for the run path; the title still says replay but the scope is both.

Independently probed by the overseeing session before this decision, confirming the shape session's two claims: (1) a project .claude/CLAUDE.md does load under --setting-sources project, and a worktree-root CLAUDE.md loads alongside it, both present in the same session; (2) installStageCorpusSnapshot is called from pipeline-confirmation.ts:388 (original run) and replay-confirmation.ts:417 (confirmed replay), and LAYOUT_DIRECTORY_KINDS (checkpoint.ts:177) is only [agents, output-styles], so CLAUDE.md is delivered by neither path.

Fixed and committed at 6098f6b. installStageCorpusSnapshot now copies the frozen CLAUDE.md from the snapshot into <targetDirectory>/.claude/CLAUDE.md, alongside skills/agents/output-styles, never touching the worktree root.

Observed directly: a checkpoint.test.ts unit test asserts the installed file's bytes equal the frozen instructions string. An extended replay-confirmation.test.ts integration test runs the real snapshot-then-install path for 3 concurrent confirmed-replay reps and reads each rep's own worktree .claude/CLAUDE.md back, confirming it equals the frozen instructions the record hashes, with no cross-rep leakage. Full suite (1004 tests), typecheck, lint, and format all pass.

Not verified this session: an actual claude CLI session reading .claude/CLAUDE.md at replay time end-to-end (the fake stage-session dependency stands in for it in all tests, as it does everywhere else in this suite). That delivery mechanism itself was independently confirmed on the card before build started, by an empirical probe on claude 2.1.260 with --setting-sources project.

One function serves both call sites (pipeline-confirmation.ts:388 original run, replay-confirmation.ts:417 confirmed replay), so both paths are closed by the same commit; acceptance criteria 1-4 (duplicated in the card) and 5 share the same evidence.

Advisory note from the review is filed as ACT-68 (instructions taken as a bare string instead of resolved from roots, unlike every other corpus kind): not blocking, follow-up only.

Review: not triggered. This is an internal harness bug fix, not outward-facing, and the change is a 4-line addition confined to one already-tested function.
<!-- SECTION:NOTES:END -->
