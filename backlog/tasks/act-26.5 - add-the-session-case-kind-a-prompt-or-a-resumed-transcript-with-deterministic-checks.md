---
id: ACT-26.5
title: >-
  add the session case kind: a prompt or a resumed transcript with deterministic
  checks
status: To Do
assignee: []
created_date: '2026-09-02 15:14'
labels: []
dependencies:
  - ACT-26.4
references:
  - backlog/docs/doc-1 - agent-cli-exploration.md
  - /Users/joaofnds/code/clean-room/brief-split/STUDY.md
parent_task_id: ACT-26
type: feature
ordinal: 26008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three of the four bespoke harnesses measured one Claude session, not a pipeline stage: a reply turn resumed from a real transcript cut just before the fired reply (dotfiles doc-4, brief-split), a single prompt in a repository under a style variant (doc-3), and an agent reviewing a fixture tree against an answer key (instructions-reviewer cases). Add the session case kind. A session case declares: a working directory or fixture tree, the prompt, an optional transcript prefix to resume (with rehearsal case capture <session> --cut <index> doing what fork.py did: copy the session file truncated at the cut and rewrite the session id), tool and settings overlays, the agent or style under test, and the corpus files it reads so lineage and staleness cover styles, agents, and rules. Its judge is a deterministic check list over the reply and transcript (word band, forbidden characters such as em dash and backtick, every question in the reply present in the draft, an agent dispatched in the foreground with named message parts, sent reply equal to the return minus whole sentences, files read, tool calls made), optionally a known-answer key or rubric graded by the sealed Judge. A session case runs once as a debug attempt and under --confirm as reps, with the same records, reports, and cost ceiling as a stage replay. ACT-25 becomes the first session case.

Cost observed for one resumed turn: about 2 USD cold, 0.15 USD with a warm cache. Gap 2 in doc-1.
<!-- SECTION:DESCRIPTION:END -->
