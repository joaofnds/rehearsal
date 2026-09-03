---
id: ACT-35
title: run the three unrun brief-reply turns and record their word bands
status: To Do
assignee: []
created_date: '2026-09-03 11:56'
updated_date: '2026-09-03 11:56'
labels: []
dependencies:
  - ACT-32
references:
  - ACT-25
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
