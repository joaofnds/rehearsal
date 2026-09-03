---
id: ACT-28
title: 'stage confirmation reps read the live skill, not the frozen corpus snapshot'
status: To Do
assignee: []
created_date: '2026-09-03 00:09'
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
