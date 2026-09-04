---
id: ACT-55
title: choose the UI stack and stand up a walking skeleton of one screen
status: To Do
assignee: []
created_date: '2026-09-04 13:06'
updated_date: '2026-09-04 13:07'
labels: []
milestone: m-1
dependencies:
  - ACT-47
priority: high
ordinal: 57008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design says: recreate it in the codebase`s existing environment, and if no frontend exists, choose the most appropriate framework for a local single-user tool that reads from disk and streams live run state.

No frontend exists. The repository is TypeScript on Bun with no framework, no server, and no build step for a client. That is a real decision with consequences for every screen after it, and CLAUDE.md`s stack rules do not cover a UI.

Constraints that bear on the choice:
- Local single-user tool, opened in a browser, no network access wanted (SPEC.md says self-host the fonts for exactly this reason).
- Reads records from disk and needs a live stream off a running process.
- The house style skill`s frontend rules name Next with Tailwind as the primary stack and Tauri with Svelte as secondary, and call for an accessible component layer rather than hand-rolled primitives.
- The spec is dense, keyboard-driven, and accessibility-specific: focus rings, aria-current, aria-expanded on evidence disclosure, role=dialog with focus trap, aria-live on the status bar, prefers-reduced-motion on the pulse.
- The repository already refuses ESLint, Prettier, and Biome in favour of oxfmt and oxlint, and uses bun:test. A stack that drags in its own toolchain fights that.

Deliver the choice with its reason, then prove it end to end on one screen rather than scaffolding all nine. Run history is the right one: it is the landing screen, it reads records that already exist on disk, and it needs no live stream.

The walking skeleton is the point. One screen, real data from .benchmark-runs, the design`s tokens, keyboard focus, and its empty state, wired the way every later screen will be.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The stack choice is recorded with its reason and what it was chosen over, as a decision on the board
- [ ] #2 Run history renders from real records on disk, including a stopped run and a stale one
- [ ] #3 Its empty state renders on a checkout with no records
- [ ] #4 Keyboard focus is visible on every interactive element, and the nav item for the current screen carries aria-current
- [ ] #5 The repository's existing checks (typecheck, lint, fmt, test) all pass with the UI in the tree
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Archived at triage 2026-09-04 as a duplicate. ACT-47 through ACT-51 were filed earlier the same day, from the prototype itself rather than from the exported spec, and they cover this ground better: ACT-48 catches a collision this card missed (the design's 'task' against a backlog task), and ACT-49 inventories the data gap from the screens directly. Anything unique here was folded into that set before archiving.
<!-- SECTION:NOTES:END -->
