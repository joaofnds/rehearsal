---
id: ACT-86
title: stop sessions overwriting a card's notes with backlog task edit --notes
status: To Do
assignee: []
created_date: '2026-09-05 22:48'
updated_date: '2026-09-05 22:59'
labels: []
dependencies: []
type: chore
ordinal: 82008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A session that writes a handoff onto a card cannot silently destroy notes already there
- [x] #2 The mechanism chosen is stronger than prose, or the reason prose is the only available mechanism is recorded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Observed 2026-09-06 during the ACT-40 iteration. Two of three sessions destroyed notes already on the card.

The shape session (0280ad9b) ran `backlog task edit ACT-40 --notes` and wiped João's recorded decision, a corrected reproduction count, and the reproduction command. The build session (9ed69b68) ran `--check-ac 1 --check-ac 2 --check-ac 3 --notes` and wiped the restored decision a second time. Both were recovered by the overseeing session, which happened to read the diff before committing. Nothing in the loop would have caught it otherwise, since the card file is the only record and it had already been rewritten.

Verified in the session transcripts under ~/.claude/projects: neither session used --append-notes.

Root cause. No instruction file tells a session to use --notes; `grep -rn '\-\-notes' ~/.agents ~/.claude/skills` returns one line, the warning against it. The shape and build skills both say 'write onto the task's record' without naming a flag, so each session picks one, and --notes is the flag whose name matches the field. The only warning sits in backlog-board.md as a comment inside a syntax block, read once at task start and several files away from the moment of writing. The CLI's own help says 'replaces existing' on --notes and the session reads that too. Prose has now failed at two independent points, which is the evidence that prose is the wrong mechanism rather than that this prose was worded badly.

Mechanism, ranked per continuous-improvement.md §3.4. Making the bad state unrepresentable means the session cannot issue --notes at all. backlog is a third-party binary at /opt/homebrew/bin/backlog, so the flag cannot be removed from it. The available equivalent is a PreToolUse hook that refuses a Bash command matching 'backlog task edit' with '--notes', naming --append-notes in the refusal. No hooks are configured today (~/.claude/settings.json has an empty hooks object).

Blocked on João. A hook is harness configuration, which the hard lines reserve for his typed instruction, and it takes effect mid-session for every running session. Recommend he direct the hook. The weaker fallback, naming --append-notes in the shape and build skills at the point each says to write the record, is worth doing regardless but is still prose and would not have stopped either failure on its own.

Note: ~/code/dotfiles has staged uncommitted changes from another session, including to backlog-board.md, which strengthens other parts of that file and leaves this rule unchanged. Any fix here must not disturb that work.

Decision (João, 2026-09-06): no hook. He answered 'no hooks!' to the recommendation. The unrepresentable-state mechanism is therefore ruled out by direction, not by unavailability, and acceptance criterion #2 is satisfied by recording that.

Remaining mechanism is prose at the point of use: name --append-notes where the shape and build skills tell a session to write the record, so the flag is in front of it at the moment it writes rather than in a file read once at task start. This is weaker than what failed and would not have stopped either observed failure on its own. It is still the strongest move left.

Landed 2026-09-06 as dotfiles commit e33c7abf, rendered through chezmoi so the loaded copies carry it.

The diagnosis in the note above was incomplete. Checking the transcripts for rule loading, not just for the flag, showed the shape session read no rulebook file at all and the build session read thirteen without ever opening backlog-board.md. The rule was in force through AGENTS.md's routing line and was never loaded. So the failure is not that the warning was worded weakly. It is that the file holding it was not opened by either session that needed it, which is why restating it there would have changed nothing.

The fix puts one sentence in the shape and build skills, at the sentence that tells the session to write the record, naming --append-notes and saying every other value flag overwrites.

An unprimed reviewer called for cutting both lines as a duplicate of the board rule, on the grounds that the routing rule guarantees the board file is loaded alongside. The transcripts refute that premise, so the lines stand. Its wording findings were applied: plain 'keeps what an earlier session recorded' in place of 'destroying', and the shape copy moved below the content rule it had split. It verified the flag names against the CLI and confirmed the overwrite behavior on a throwaway board.

This is prose, which is the mechanism that already failed once. It is weaker than the hook João ruled out. Whether it holds is only observable by watching a future shape or build session write a card. Criterion #1 is therefore not checkable yet.
<!-- SECTION:NOTES:END -->
