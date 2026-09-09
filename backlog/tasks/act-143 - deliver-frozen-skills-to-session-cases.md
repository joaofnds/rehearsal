---
id: ACT-143
title: deliver frozen skills to session cases
status: Shape
assignee: []
created_date: '2026-09-09 15:49'
updated_date: '2026-09-09 16:33'
labels: []
milestone: m-3
dependencies: []
references:
  - src/benchmark/session-corpus.ts
  - src/benchmark/session-attempt.ts
documentation:
  - backlog/docs/doc-59 - Session-skill-benchmark-scope.md
priority: medium
type: feature
ordinal: 139008
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An explicit corpus source declaring skills/ is refused by snapshotSessionCorpus, while the live-source branch runs without a frozen overlay. A skill benchmark needs one changed skill and fixed surrounding inputs. Deliver the declared frozen corpus and settings to session attempts, with evidence that the invoked skill is the selected variant even when a same-name user skill exists.

Read ACT-28 and ACT-37 for the existing project-level delivery mechanism and harness-owned settings decision. Removing refuseDeclaredSkills alone does not install skill files or preserve the surrounding corpus when setting sources change. Include the skill's supporting files and declared global instructions, agents and styles. Specify file-editing and CLI permissions through the existing settings approach so an unrelated machine default cannot determine whether the case can execute.

An initial live snapshot is allowed; repeated reads from changing installed files are not fixed experiment inputs. Keep unrelated live files untouched. Identifier leakage is an advisory follow-up described in doc-59, not an automatic refusal criterion. First verification target: a same-name installed skill and frozen skill with different markers, plus a source mutation after snapshot capture.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A session case declaring a skill in an explicit corpus source runs and invokes that frozen skill; a same-name installed skill with different marker text does not supply the result (João’s approved session benchmark scope, doc-59)
- [ ] #2 Changing the source or live install after capture leaves the session’s delivered declared corpus bytes and recorded digests unchanged (João’s approved session benchmark scope, doc-59)
- [ ] #3 Two variants differing in one skill run with identical declared surrounding instructions and behavior settings, whose identities are recorded (João’s approved session benchmark scope, doc-59)
- [ ] #4 A case permitted to edit files and execute its fixture CLI does so with the declared settings even when user settings do not grant those permissions (João’s approved session benchmark scope, doc-59)
- [ ] #5 Running the case leaves the user’s installed corpus unchanged (João’s approved session benchmark scope, doc-59)
- [ ] #6 A control arm whose frozen corpus omits the treatment skill cannot invoke a same-name skill from the live install (João’s approved session benchmark scope, doc-59)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Triage verdict, 2026-09-09 (doc-61)

Disposition: keep; next action: shaping. Priority: medium. The approved skill experiment needs actual variant delivery with fixed surrounding inputs. Delay postpones the new experiment while comparison prerequisites are resolved.

Evidence: HEAD 3438d1f (product code unchanged from 1d02c8e). session-probes.ts: explicit skill refused; mutation after a live snapshot changes its bytes to after. installSessionCorpusSnapshot skips live snapshots and overlays no skills.

Unresolved claims/resources: No prerequisite for shaping. Claude 2.1.266 runs at /opt/homebrew/bin/claude; this session PATH omits /opt/homebrew/bin. Use a command-local PATH prefix for a future authorized provider check. Authentication and real-provider behavior remain unverified; executable presence grants no spending authority.

Next action: Shape isolated delivery of frozen skills, support files and declared settings, including omission control and same-name installed skill tests.

Record: [Triage record](<../docs/doc-61 - Triage-rehearsal-backlog.md>).
<!-- SECTION:NOTES:END -->
