---
id: ACT-28
title: 'stage confirmation reps read the live skill, not the frozen corpus snapshot'
status: To Do
assignee: []
created_date: '2026-09-03 00:09'
updated_date: '2026-09-03 00:33'
labels:
  - defect
dependencies: []
ordinal: 30008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
installStageCorpusSnapshot (src/benchmark/checkpoint.ts) copies the frozen skill bytes into <worktree>/.claude/skills/<name>, and pipeline-confirmation.ts calls it before every stage session, on the assumption that a project-level skill shadows a same-named user-level one. Observed at ACT-26.6 Shape, 2026-09-03, on claude 2.1.258: it does not. A probe wrote a project-level .claude/skills/style/SKILL.md carrying a marker sentence the live ~/.agents/skills/style/SKILL.md does not have, then asked the session to invoke the style skill through the Skill tool and report the marker: the reply was NO-MARKER, twice, at haiku/low. The same directory read directly with the Read tool returned /private/tmp/<probe>/.claude/skills/style/SKILL.md and the marker, so the file is present and discoverable; the Skill tool resolves the user-level definition instead. Consequence: every confirmation rep and every replay that installs a corpus snapshot runs the stage against whatever skill is installed live at that moment, while the lineage records the frozen bytes. Scores attributed to a frozen corpus were produced by the live one, and a mid-run chezmoi apply silently changes a rep. Output styles and agent definitions do shadow correctly (same probe run, markers returned), so the fix is likely a per-session flag for skills rather than an on-disk overlay. Cost of the probes that found this: USD 0.0400 across three calls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A stage session run with a corpus snapshot whose skill bytes carry a marker not present in the live install reports that marker, observed once directly
- [ ] #2 The mechanism that delivers frozen skill bytes to a stage session is recorded on the card with the observation that shows it works
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## The stage corpus path, once skills can be delivered (from ACT-26.6)

ACT-26.6 gave the session path a resolved corpus source: `resolveCorpusSource`
parses `--corpus` once into a root, `snapshotSessionCorpus` copies the four
kinds into one snapshot directory, and `hashCorpusFiles` reads only that
directory. The stage path did not move: `captureStageCorpus` and
`snapshotStageCorpus` still take skill search roots, because a stage's corpus
is its skills and those cannot be delivered until this card lands. `run` and
`replay` refuse `--corpus` naming this card (`refuseStageCorpus` in
`src/cli/interactive-stdin.ts`).

When this card settles the delivery mechanism, the two paths should read a
corpus the same way: `captureStageCorpus` and `snapshotStageCorpus` take a
resolved corpus source instead of search roots, and the refusal in
`refuseStageCorpus` becomes a snapshot and an install. Unifying them before
then would be building for a caller that cannot exist.
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
<!-- COMMENTS:END -->
