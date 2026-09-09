---
id: ACT-138
title: >-
  review probes write into the shared working tree, and other sessions read the
  mutation as the code
status: To Do
assignee: []
created_date: '2026-09-09 11:38'
updated_date: '2026-09-09 16:22'
labels: []
dependencies: []
priority: medium
type: bug
ordinal: 134008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep mutation probes out of the shared checkout or detect and name dirty/foreign state before accepting a measurement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 a session running mutation probes leaves the repository working tree as it found it, or the damage is detected and named, rather than another session silently measuring the mutant as if it were HEAD (observed 2026-09-09 during ACT-135's review: two of this session's own probe measurements were void because they read src/benchmark/checkpoint.ts while a reviewer held a mutation in it)
- [ ] #2 bun run test, bun run lint, bun run typecheck, bun run fmt:check all pass (the project's own check, CLAUDE.md)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found during ACT-135's review round, 2026-09-09, and it is the same class of
defect ACT-135 itself was filed about, one directory over.

WHAT HAPPENED. Five reviewers ran mutation probes against a single shared
working tree at /Users/joaofnds/code/rehearsal while other sessions were
reading it. Observed this session:

- src/benchmark/checkpoint.ts carried a live mutation (the throw block deleted
  from hashDirectory) while I probed hashDirectory. I recorded 'hashDirectory
  NO THROW' and began building a finding on it. The finding was void: I was
  measuring the mutant, not HEAD. Re-run against clean HEAD, hashDirectory
  throws as designed.
- client/src/corpus/corpus-page.tsx carried a .slice(0, 1) mutation while the
  adversarial reviewer ran the suite. It got 0, 8, 9, 1 and 0 failures across
  five consecutive runs and traced the flakiness to the shared tree rather than
  to the build under review.
- Untracked probe files appeared in the repository: src/benchmark/scratch-ck.ts,
  src/benchmark/probe1.test.ts, costprobe.ts. Each was cleaned up by its author.
- One reviewer's git stash pop dropped another's mutation; it recovered the
  file from an unreachable stash commit.

WHY IT MATTERS BEYOND THE NUISANCE. A mutation in the tree is indistinguishable
from the committed code to any session that reads a file rather than
git show HEAD:<path>. Two measurements this session were wrong in exactly that
way, and both were headed for a card. The failure mode is a session reporting a
defect that does not exist, or missing one that does, with the evidence looking
clean either way.

ROUTES, none taken here.
1. A git worktree per reviewer. Creating one is reserved for a typed
   instruction, so this session could not.
2. Reviewers copy the repo to a temp root before mutating. Cheap, and within a
   brief's reach, but it depends on every brief remembering to say it.
3. A PreToolUse hook denying writes under the repo from a reviewer sub-agent.
   The enforcement point is the harness's own settings, which the hard line
   reserves for an instruction typed into the session that writes them.
4. Reviewers read git show HEAD:<path> rather than the working tree for any
   claim about committed behavior, and say so when they mutate. Does not stop
   the collision, only stops one session's claim resting on another's mutant.

RELATION TO ACT-135. That card's prevention half, already queued there, is a
hook denying writes under ~/.claude and ~/.agents. It does not cover the
repository working tree, which is where this happened. Whoever takes the
prevention ask should cover both or say why not.

QUEUED FOR A TYPED INSTRUCTION, not actionable here: whether reviewers get
worktrees, and whether a hook should bound where a review sub-agent may write.
Both edit surfaces the hard lines reserve.

Medium because the damage is silent and lands on a session other than the one causing it: a reviewer's mutation is read by a concurrent session as the code, and the resulting measurement is wrong with nothing to signal it. The card records four such instances in one review round, including two void measurements and a lost mutation.

Not High: the mutations are transient and the working tree is recoverable, and the project's own checks do report an untracked probe file the moment they run. Nothing is served wrong to a reader, which is what separates it from ACT-122 and ACT-137.

Next action is shaping rather than build, because the mechanism is undecided. The card names no approach, and the options differ sharply in cost: a worktree per reviewer, a refusal on writes to tracked files during review, or a check that names a dirty tree before a measurement is trusted.

Evidence added this run, from this session's own conduct. I ran three mutation probes for this triage and kept every one under /tmp with absolute imports back into the repository, and 'git status --short' was empty at the start of this run and again after all three. So the discipline is achievable without any tooling, which is an argument that the fix can be a guard rather than a sandbox. It is also an argument the guard is needed, since the discipline held here only because I chose it.

Related and already live: a PreToolUse hook now refuses a Bash command that appears to write under the live agent corpus. It fired on this session while I was writing a triage note whose text merely quoted such a path, so it currently catches text as well as writes. That hook covers the corpus tree only and not this repository's working tree, which is this card's subject.

Cross-board wait: implementation belongs to /Users/joaofnds/code/dotfiles. Reconsider when an owning-session result is available or that repository is explicitly in scope. This triage makes no reciprocal board edits.

## Triage verdict, 2026-09-09 (doc-61)

Disposition: defer; next action: shaping. Priority: medium. Shared-tree mutation can silently invalidate another session's evidence; no enforcement exists in this repo.

Evidence: Accepted doc-55/doc-56 incidents; this audit used /tmp and retained a clean tree, showing isolated probes are feasible.

Unresolved claims/resources: external review/delegation corpus ownership Work belongs to the linked dotfiles/corpus repository; this directive audits only Rehearsal.

Next action: Specify temp-copy mutation probes and a clean-tree/HEAD evidence check in the owning review workflow.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
