---
id: ACT-28
title: 'stage confirmation reps read the live skill, not the frozen corpus snapshot'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-03 00:09'
updated_date: '2026-09-06 12:12'
labels:
  - defect
milestone: m-0
dependencies: []
priority: high
ordinal: 30008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
installStageCorpusSnapshot (src/benchmark/checkpoint.ts) copies the frozen skill bytes into <worktree>/.claude/skills/<name>, and pipeline-confirmation.ts calls it before every stage session, on the assumption that a project-level skill shadows a same-named user-level one. Observed at ACT-26.6 Shape, 2026-09-03, on claude 2.1.258: it does not. A probe wrote a project-level .claude/skills/style/SKILL.md carrying a marker sentence the live ~/.agents/skills/style/SKILL.md does not have, then asked the session to invoke the style skill through the Skill tool and report the marker: the reply was NO-MARKER, twice, at haiku/low. The same directory read directly with the Read tool returned /private/tmp/<probe>/.claude/skills/style/SKILL.md and the marker, so the file is present and discoverable; the Skill tool resolves the user-level definition instead. Consequence: every confirmation rep and every replay that installs a corpus snapshot runs the stage against whatever skill is installed live at that moment, while the lineage records the frozen bytes. Scores attributed to a frozen corpus were produced by the live one, and a mid-run chezmoi apply silently changes a rep. Output styles and agent definitions do shadow correctly (same probe run, markers returned), so the fix is likely a per-session flag for skills rather than an on-disk overlay. Cost of the probes that found this: USD 0.0400 across three calls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A stage session run with a corpus snapshot whose skill bytes carry a marker not present in the live install reports that marker, observed once directly
- [x] #2 The mechanism that delivers frozen skill bytes to a stage session is recorded on the card with the observation that shows it works
- [x] #3 A stage session run with --setting-sources project (skill installed only at project level, no user-level copy) invokes the Skill tool and returns the frozen marker text, not the live user-level skill's content
- [x] #4 A stage session run under the snapshot reports a marker planted in the frozen global instruction file and a marker planted in a frozen agent definition, neither present in the live install, observed once directly
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Independent review, 2026-09-04

Trigger: change to the harness's provider-invocation surface and lineage
lookup, both outward-facing since every recorded score depends on them, per
the card's own recommendation.

Suite before review: 1025 pass, 0 fail, typecheck/lint/format clean.
Diff reviewed: d886588~1..ad63fb0 (feat(claude): support --setting-sources
project; fix(checkpoint): freeze the whole corpus for a stage session,
project level first). One reviewer, all axes (style, architecture, security,
spec, testing, refactoring).

Findings, worst first:

1. [should-fix, fixed] Cross-stage staleness: installStageCorpusSnapshot
   copied each layout kind (skills, agents, output-styles) into the worktree's
   .claude with a plain cp, which only overwrites same-named files and never
   removes a file present at the destination but absent from the source. A
   pipeline rep reuses one worktree across every stage
   (pipeline-confirmation.ts:384-392), installing a fresh snapshot each
   iteration. Verified directly: a stage whose snapshot carries no agents/ or
   output-styles/ directory left the prior stage's frozen copy of that kind
   sitting in the worktree, readable and invokable by a session whose own
   recorded lineage says it never had that corpus. This is the same defect
   class the card exists to close, now on the two directory kinds this diff
   adds. skills/ had the same merge gap before this diff (pre-existing), but
   agents/output-styles is new surface this diff created, so it's this
   change's to fix. Fixed: installStageCorpusSnapshot now clears each kind's
   target directory before installing, or removes it outright when the
   current snapshot doesn't carry that kind. Reproduced first with a failing
   test (checkpoint.test.ts, "removes a prior stage's agents and output
   styles the next stage's snapshot does not carry"), confirmed it failed
   against the pre-fix code, then fixed. Full suite 1026 pass (was 1025;
   +1 new test), typecheck/lint/format clean, committed at 4c746b8.

2. [tracked as a task, ACT-37] `--setting-sources project` silently drops
   hooks, MCP config, and settings.json for every confirmation/replay stage
   session, and this is a live consequence, not a hypothetical: this
   machine's ~/.claude carries a populated hooks/ directory and a
   settings.json with dozens of behavior flags (effort level, skill shell
   execution, auto-compact, etc.), none of which are frozen, overlaid, or
   otherwise compensated for by this diff. The runner's own probe, recorded
   on this card one day before the build (2026-09-03 22:35), already found
   exactly this and called it "a decision for João": the project-only source
   drops the user-level CLAUDE.md, agents, and skills unless the snapshot
   supplies them at project level too (which this diff now does), but says
   nothing about hooks or settings.json, which the snapshot mechanism has no
   concept of freezing. The implementation notes for this build (2026-09-04)
   cover CLAUDE.md/skills/agents/output-styles but never mention hooks or
   settings.json, so the decision the runner flagged was never made. A stage
   session under confirmation/replay now behaves differently from a live run
   in ways outside the frozen corpus under test (no hooks fire; settings.json
   flags like effort level or disabled features differ), which can change
   what a stage rep measures for reasons unrelated to what the corpus
   snapshot records. Escalated to João on DOT-36; his answer, recorded there:
   a harness-owned settings file, declared as data in the case and installed
   at project level, carrying only the permissions deny list, effort, output
   style, and feature switches, no hooks. Filed as ACT-37 with that scope.
   Not fixed in this pass: ACT-28's own diff neither introduces nor worsens
   this gap beyond what the runner already flagged and disclosed before the
   build, so it does not block this diff's own correctness.

3. [note] Duplicated domain knowledge: checkpoint.ts's LAYOUT_DIRECTORY_KINDS
   (["agents", "output-styles"]) and session-corpus.ts's OVERLAID_KINDS
   (["output-styles/", "agents/"]) encode the same fact in two modules, with
   different ordering and string format (trailing slash in one, not the
   other). Nothing keeps them in sync. Not unified: the two serve genuinely
   different corpus mechanisms (stage corpus vs. session corpus), which the
   card's own "What did not change" section already treats as deliberately
   distinct paths, so a shared abstraction isn't a clear win. Left as a note.

4. [note, fixed] Stale comment in staleness-report.test.ts (outside the
   diff's changed-file list) still named the pre-rename identifier
   `corpusSkillRoots`, which this diff renamed to `stageCorpusRoots`
   everywhere else. Fixed in the same commit as finding 1.

5. [note] resolveLayoutDirectory treats a present-but-empty project-level
   agents/ or output-styles/ directory as the final answer and does not fall
   through to a populated user-level one. Matches the documented "whole
   directory, never merged across roots" semantics, but the empty-directory
   corner isn't tested or called out. No reported occurrence; left as a note.

Spec conformance: AC1, AC3, AC4 ask for a marker observed directly against a
live claude invocation. The automated suite added in this diff tests wiring
only (claudeArgs, captureStageCorpus, runWorkflowStage) via fakes, never a
real claude subprocess; the direct observation is the card's own "Built and
observed, 2026-09-04" note, which the reviewer did not re-run. That note's
claim stands as the author's direct observation, not independently
re-verified this review.

Security: no findings, no untrusted external input newly parsed or handled.

Architecture: StageContext (the live run/replay path) has no settingSources
field; only StageSessionEnvironment does, populated solely by the two
confirmation call sites. Verified by reading run.ts: this is a structural,
compiler-enforced guarantee that a plain run or replay cannot set
settingSources, not merely convention. Load-bearing; preserve this
separation in any future refactor that touches StageContext.

Verdict: proceed. Every finding disposed: one should-fix found and fixed in
this pass (cross-stage staleness on agents/output-styles), one tracked as
ACT-37 per João's decision (a harness-owned settings file, no hooks), one
note fixed alongside the should-fix (stale identifier in a comment), two
notes left as observations with no reported occurrence. Nothing blocks this
diff's own correctness: ACT-37's gap predates and is disclosed independently
of this diff, which neither introduces nor worsens it.

Re-probed 2026-09-05 on claude 2.1.260, one version past the 2.1.258 this card's evidence was taken on. The shadowing verdict has flipped.

Probe: a temporary directory holding only .claude/skills/style/SKILL.md carrying SHADOW-MARKER-9931, a marker the live style skill does not have, asked at haiku to invoke the style skill through the Skill tool and report the marker.

With --setting-sources project: SHADOW-MARKER-9931. The frozen skill is delivered.
Without the flag: NO-MARKER. The live skill wins.

So the mechanism this card built works, and the card is correctly Done. What is stale is the refusal message in src/benchmark/session-corpus.ts:30-46, which still says 'ACT-28 owns the delivery mechanism, so a skill variant cannot be measured yet'. ACT-28 landed. Its own comment #1 predicted this: 'the fix is likely a per-session flag for skills rather than an on-disk overlay', and --setting-sources project is that flag.

The remaining gap is not delivery, it is that the plain run and replay paths never pass the flag. src/benchmark/pipeline-confirmation.ts:412 and replay-confirmation.ts:468 set settingSources: 'project'; run.ts and the plain replay do not, and src/cli/replay-command.ts:95 refuses --corpus outright before resolving anything.

Re-check trigger: this is a fact about the CLI and rots with every release. Re-run the two probes above on a version bump before trusting the result.

Re-probed 2026-09-06 on claude 2.1.261, one version past the 2.1.260 the previous re-probe used. The verdict holds, unchanged.

Probe: a temporary directory holding only .claude/skills/deslop/SKILL.md carrying SHADOW-MARKER-7742, a marker the live deslop skill does not have, asked at haiku to invoke the deslop skill through the Skill tool and report the marker. (The previous probes used a 'style' skill, which no longer exists in the live corpus; deslop was substituted as a skill that does.)

With --setting-sources project: SHADOW-MARKER-7742. The frozen skill is delivered.
Without the flag: NO-MARKER. The live skill wins.

So the delivery mechanism still works on the current CLI, and the gap named in the 2026-09-05 note is unchanged: run.ts and the plain replay path never pass the flag, and src/cli/replay-command.ts refuses --corpus before resolving anything.

Also settled on re-reading this card: the 'open question on ACT-28' that three triage runs carried forward as blocking ACT-37 and ACT-68 is not open. Joao answered it on DOT-36 and the answer is recorded in review finding 2 above (a harness-owned settings file, declared as data in the case, installed at project level, carrying the permissions deny list, effort, output style, and feature switches, no hooks). That is already ACT-37's scope. ACT-37 needs nothing further from Joao.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-09-03 00:14
---
Confirmed independently by the orchestrator on 2026-09-03, with a probe run separately from the one that found it. A temporary directory held .claude/skills/style/SKILL.md declaring the marker ORCH-MARKER-4417; the session was asked to invoke the style skill and report the marker it states. The reply was the live style skill's content, Beck's four rules of simplicity, and the planted marker never appeared. So a project-level skill does not shadow a same-named user-level skill on claude 2.1.258.

What this means for evidence already recorded: every confirmation rep and every replay that installed a corpus snapshot ran its stage against whatever skills were live at that moment, while lineage recorded the frozen bytes. Any score attributed to a frozen corpus was produced by the live one, and a chezmoi apply mid-run would silently change a rep without invalidating its checkpoint. Comparisons between corpus versions are the feature this breaks, because both arms may have read the same live skill.

claude --help on 2.1.258 declares no --skills flag. The candidates named in the help text are --plugin-dir, which loads a directory as a plugin carrying skills, and --setting-sources, which controls which setting sources contribute CLAUDE.md, skills, plugins, hooks, and MCP. Choosing between them is this card's work. Output styles and agent definitions do shadow correctly, so the fix is likely a per-session flag for skills rather than an on-disk overlay.
---

author: @claude
created: 2026-09-03 22:35
---
Runner, 2026-09-04, before build: a probe in an empty directory (claude --setting-sources project -p /context, against the default) shows the project-only source drops the user-level CLAUDE.md, the custom agents, and the user skills. So a stage session under this mechanism runs without the global instruction file, the reviewer agent, and the output style unless the stage snapshot installs those at project level too, as the session path already does for its four kinds. That changes what a stage rep measures and is a decision for João. Question on DOT-36.
---

author: @claude
created: 2026-09-03 22:44
---
Runner, 2026-09-04, after build's first session: stopped on its question (redefine root as a corpus directory vs parallel functions; fix the project-then-home asymmetry for the global file, agents, and output styles or leave it). Relayed to João on DOT-36 with the recommendation to redefine the root and fix the asymmetry in the same change, since the new root definition is that fix.
---

author: @claude
created: 2026-09-03 23:11
---
Runner, 2026-09-04, after review: one escalated question relayed to João on DOT-36 (accept that reps run without user-level hooks and settings, or freeze them too). The review's verdict waits on it.
---

author: @joaofnds
created: 2026-09-03 23:33
---
João, 2026-09-04, on the harness's direction: 'I wanted things to run locally so we wouldn't have to deal with each person's machine setup, dotfile links, and other individual configuration differences. You convinced me to go your route, and now we keep running into that same complexity around understanding everyone's setup. And it doesn't stop here, because we're only dealing with Claude Code right now. Later we'll need to support other LLM providers like Gemini and others, and that will make it much worse.' Input for the reflect step and the next triage.
---
<!-- COMMENTS:END -->
