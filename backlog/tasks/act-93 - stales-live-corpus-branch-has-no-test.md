---
id: ACT-93
title: stale's live-corpus branch has no test
status: To Do
assignee: []
created_date: '2026-09-07 01:22'
updated_date: '2026-09-09 13:01'
labels: []
milestone: m-1
dependencies: []
priority: medium
type: bug
ordinal: 89008
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A test fails when stale's live-corpus check resolves against anything other than the operator's install
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split from ACT-63 on 2026-09-06 at João's direction ('agree').

What is untested: currentStageCorpus (staleness-report.ts) resolves a live corpus to the operator's install and deliberately ignores each run's recorded target. That decision was made, reverted once, and re-made during ACT-63, and nothing in the suite would catch a session flipping it back.

Why the obvious approaches fail, both tried and refuted this session:

1. A directory-source test cannot reach the branch. stageCorpusRoots returns [source.root] for a directory source and only consults the target root when source.kind is 'live' (checkpoint.ts). A test using a temporary corpus directory never executes the live path. I wrote one, then mutation-tested it by restoring the rejected code: it passed under both readings, proving nothing.

2. Injecting HOME does not work. The ACT-63 review tried it and found Bun's homedir() on macOS reads the account record rather than the environment variable, so the test still resolves the real user corpus.

3. A live-source test against the real ~/.claude would need the fixture's discuss and build skills installed there. That makes the suite depend on the developer's machine and writes to the user's corpus, which no test should do.

What would close it: an injectable home resolver threaded into stageCorpusRoots or currentStageCorpus, so a test can name a temporary directory as the user install. That is a signature change, which is why ACT-63 did not do it.

Cost: the behavior is a decision João made twice, against a plausible alternative, and the code now carries a comment explaining it. A future session that reads the comment and disagrees has nothing to stop it. The blast radius is the same class as ACT-73: stale reporting the wrong answer, which is the failure mode that makes an operator stop trusting the tool.

Related: ACT-92 covers a different untested seam from the same card (executeReplay's production wiring of corpusRoots) and also needs injectable dependencies. Worth checking whether one seam serves both before building either.

Decision by the overseeing iterate session, 2026-09-09, settling the question doc-54 left open: whether m-1's last two cards must finish before the UI work. They need not, and this card is NOT raised above the UI cards.

Read this run, doc-7 'The order': m-1 is 'Prove the loop once', its stated substance is that 'the tool has never answered its own question', and its named gate is ACT-41 -> ACT-39. Both are Done, as are the other 11 of 13. What remains under the milestone label is this card and ACT-93, neither of which is the loop: one is an interface inconsistency, the other a missing test on a branch that already works. So 'prove the loop once' is already met in the sense doc-7 wrote it, and holding the UI behind these two would be reading the milestone's counter rather than its goal.

Recorded here rather than in a doc because triage owns the triage docs. Whoever runs triage next should carry this into the next one, or overturn it with the reason.

Triage verdict, 2026-09-09 (doc-56). Disposition: keep, next action build. Priority raised Low to Medium this run.

Raised for the same reason as ACT-68: these two are all that remain of m-1, the goal's first increment, at 13 of 15. Left at Low the milestone the goal names first stays open indefinitely behind work the goal orders after it.

Its subject is a missing test on stale's live-corpus branch, and that branch is exactly the surface ACT-137 and ACT-134 are about to change, so the coverage is worth having before those builds rather than after.
<!-- SECTION:NOTES:END -->
