---
id: ACT-25
title: >-
  replay a brief-reply turn as a benchmark case and judge it against the
  accepted band
status: To Do
assignee: []
created_date: '2026-09-02 14:55'
updated_date: '2026-09-02 15:14'
labels: []
dependencies:
  - ACT-26.5
type: feature
ordinal: 20008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Case from dotfiles DOT-17 (2026-09-02). The brief output style hands every post-tool reply to a `brief` subagent; edits to the style, the agent, or the shared task partial need a regression check that today lives as prose in dotfiles doc-4 and throwaway scripts.

Frozen inputs: four real trunk transcripts truncated just before a reply João fired /brief on (session prefix, cut index, accepted brief length): e3dea673 873 (145 words), 02f0f204 1270 (136), 40878d26 491 (108), 92b2e8b0 1268 (76). Run: resume the truncated copy headless with `--tools "Agent,Read"` (the Agent tool refuses to spawn a subagent whose tools list resolves to nothing), the prompt "Tools other than Agent and Read are unavailable now. Write your reply to João for this turn.", the corpus snapshot under test applied to `~/.claude/output-styles/brief.md` and `~/.agents/agents/brief.md`.

Judge, deterministic from the transcript: the brief agent was dispatched in the foreground with a message carrying Request and Draft parts; the sent reply equals the agent's return or the return minus whole sentences; no em dash; no backtick symbol; every question in the reply is in the draft (the Request's own questions do not count); word count against the accepted band. Single reps swing 30 to 100 words on the same turn, so confirmation needs the outer loop.

Cost observed: about 2.3 USD per turn cold. Study record: `~/code/clean-room/brief-split/`.
<!-- SECTION:DESCRIPTION:END -->
