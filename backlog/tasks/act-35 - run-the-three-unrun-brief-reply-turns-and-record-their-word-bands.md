---
id: ACT-35
title: run the three unrun brief-reply turns and record their word bands
status: To Do
assignee: []
created_date: '2026-09-03 11:56'
updated_date: '2026-09-08 12:21'
labels: []
milestone: m-3
dependencies:
  - ACT-32
references:
  - ACT-25
priority: medium
ordinal: 37008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ACT-25 is Done with three acceptance criteria unchecked, #9, #10, and #11, all of them paid observations it deliberately did not make. Its notes record why: 'Not observed: the three other turns, projected about 7 USD cold, left unrun after Build stopped on the inconclusive first attempt as its dispatch directed.'

What is unobserved:
- #9: that the first attempt returns prose addressed to Joao rather than tool use or a refusal. The orchestrator's control run settled the underlying question (a settings overlay IS honored on --resume), but the criterion as written was never checked. It may be satisfiable from the record already on disk rather than by a new call.
- #10: that the attempt record's corpusFiles names output-styles/brief.md with the live sha256, and that `rehearsal stale` reports none of the four cases stale against that corpus and all four stale against a corpus directory whose brief.md differs by one byte. The stale half needs no provider call.
- #11: one debug attempt of each of the other three cases, with all four replies' word counts recorded beside the accepted lengths (145, 136, 108, 76).

Only #11 needs real money, projected about 7 USD. ACT-32 is worth landing first: until it does, every one of these attempts records a FAIL on tool-calls that is evidence about the check and not about the corpus, so the runs would have to be re-read afterwards.

Filed at triage 2026-09-03 because an obligation recorded only in a Done card's prose is invisible to the next session reading the board.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One debug attempt of each of brief-reply-e3dea673, brief-reply-02f0f204, and brief-reply-40878d26 exits 0 with a non-empty reply
- [ ] #2 All four replies' word counts are recorded on this card beside that turn's accepted length (145, 136, 108, 76), each with its word-band result
- [ ] #3 `rehearsal stale` reports none of the four cases stale against the live corpus and all four stale against a corpus directory whose brief.md differs by one byte
- [ ] #4 ACT-25's criteria #9, #10, and #11 are each either checked with the observation that satisfies them or restated on this card as still unobserved with the reason
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Bet, 2026-09-08: picked first from the ready queue by iterate. The newest triage doc's queue entry for it is the bet.

Oversight probe, 2026-09-08 (iterate, no provider call spent):

ACT-32's fix is confirmed on real data, not only in tests. The second recorded
attempt of brief-reply-92b2e8b0 (936e9ee1) reports tool-calls PASS "0 tool calls"
where the first (935649b6) reported FAIL "211 tool calls". The blocker this card
named is genuinely cleared, so the three runs would now record evidence about the
corpus rather than about the check.

AC#3 is unsatisfiable as written, and not for a fixable reason. `rehearsal stale`
compares a corpus against the sha recorded in a case's latest attempt record, and
src/benchmark/staleness-report.ts:304 skips any case with no attempt record. Only
brief-reply-92b2e8b0 has ever run, so it is the only one of the four that `stale`
can name. Observed directly: against the live corpus, `stale` reports
`case:brief-reply-92b2e8b0  output-styles/brief.md changed` and does not mention
the other three; against a full mirror of the live corpus with one byte appended
to output-styles/brief.md, the same one case is named plus manifest-probe. The
other three stay invisible in both runs.

This refutes the card's premise that "the stale half needs no provider call". The
stale half depends on the paid half. AC#3 can only be checked after AC#1 runs.

Also note the live corpus has drifted since the recorded runs: attempts recorded
output-styles/brief.md at sha 1d1bc829..., the live file is now 16f2833a....
That drift is ordinary editing, not a defect, but it means the three new runs
would record the current sha and AC#3's first clause ("none of the four stale")
would then hold for those three while 92b2e8b0 stays stale until it is re-run.
Satisfying AC#3 as written needs all four re-run, not three.

Not spent: the ~7 USD for the runs. Stopped here for the money decision rather
than starting it unasked.
<!-- SECTION:NOTES:END -->
