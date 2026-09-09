---
id: ACT-143
title: deliver frozen skills to session cases
status: To Do
assignee: []
created_date: '2026-09-09 15:49'
updated_date: '2026-09-09 15:52'
labels: []
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
