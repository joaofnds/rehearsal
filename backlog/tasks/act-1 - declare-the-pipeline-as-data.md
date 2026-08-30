---
id: ACT-1
title: declare the pipeline as data
status: Shape
assignee: []
created_date: '2026-08-30 12:43'
updated_date: '2026-08-30 15:25'
labels: []
dependencies: []
references:
  - docs/design.md
ordinal: 1
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Discuss → Grill → Plan → Build sequence, each stage's skill, artifact expectations, and judge attachment are code in src/benchmark. Extract them into a declared pipeline definition the harness reads, so stages can be added, removed, or reordered without editing the stage loop. The stage loop already runs behind an injectable seam; make the injected value come from the definition. See docs/design.md 'Pipeline as data'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A parsed pipeline definition, authored as data outside TypeScript, names each stage with its kind, skill, expected artifact, and rubric path.
- [ ] #2 The four-stage run executes discuss, grill, plan, build in order from the definition, carrying each planning artifact into later stages' priorArtifacts and attaching build evidence only to the delivery stage; the existing runGradedStages tests pass unchanged in intent.
- [ ] #3 A definition with plan removed executes exactly discuss, grill, build, with grill's artifact in build's priorArtifacts, and no TypeScript differs between the four- and three-stage cases.
- [ ] #4 A definition with grill and plan swapped executes discuss, plan, grill, build.
- [ ] #5 A definition adding a fifth planning stage under a name absent from today's union executes it and judges it against the rubric the definition names.
- [ ] #6 A definition that omits a required field, names a missing rubric file, repeats a stage name, or declares no delivery stage is rejected with an error naming the offending stage and field, one test per defect class.
- [ ] #7 The rejection happens before the target repository is claimed, so a malformed definition cannot leave a target dirty.
<!-- AC:END -->

## Shaping

<!-- SECTION:SHAPING:BEGIN -->

### Goal

One sentence: the harness reads an ordered list of stage declarations and runs
exactly those stages, so the pipeline changes by editing data rather than
TypeScript.

### What the code looks like today

`runGradedStages` (`src/benchmark/run.ts:136`) already takes its collaborators
through an injected `StageDependencies`, but the stage *sequence* is not
injected: the loop reads the module constant `WORKFLOW_STAGES`
(`src/benchmark/config.ts:20`) directly. The card's premise that "the injected
value" only needs repointing is half right. The sequence is one of four things
that are stage-specific, and the other three are hard-coded branches:

| Per-stage knowledge | Where it lives today | Form |
| --- | --- | --- |
| Sequence | `config.ts:20` `WORKFLOW_STAGES` | module constant |
| Skill invoked | `workflow.ts:29` `stagePrompt` | `/${stage}` string interpolation |
| Expected artifact | `backlog.ts:129-141` | `discuss→spec`, `grill→grilled`, `plan→plan` map, plus the discuss-only acceptance-criteria check |
| Judge attachment | `stage-grading.ts:228` `loadStageRubric` | path convention `rubrics/${stage}.json` |
| Build-only evidence | `run.ts:164,183`; `stage-grading.ts:63,134,145` | `stage === "build"` branches |

`WorkflowStage` is a closed union derived from that constant, and it is baked
into the Zod schemas at `contracts.ts:48` and `contracts.ts:106`. A
user-authored stage name does not type-check today; this is the constraint that
shapes the whole task.

### The kind and its stage name are different things

The build stage differs from the planning stages in *kind*, not merely in name.
A planning stage validates a durable document and carries it forward as a prior
artifact. The build stage validates a commit and produces a diff, changed
paths, check integrity, and local check results. Ten call sites branch on the
literal `"build"` to express that difference.

So the declaration carries a `kind` (`planning` or `delivery`) that selects the
validation and evidence strategy, and a `name` that is free text. The harness
keeps exactly two strategies in code; the definition chooses which one each
stage uses and supplies its parameters. This is what makes criterion #3
attainable: a new planning stage is a new entry naming its skill, its document
suffix, and its rubric, with no new branch.

Rejected: one strategy per stage name (does not remove the branches), and a
fully generic validator expressed in the definition (a rules language nobody
asked for).

### Consequences for the type system

`WorkflowStage` stops being a union of four literals and becomes a `string`
that a parsed definition constrains at runtime. The two Zod schemas that
currently enumerate stage names (`contracts.ts:48` stage rubric,
`contracts.ts:106` human finding) must accept any declared stage name, with the
human-finding schema retaining `final` as its extra member and its default.
Parse the definition once at startup into a value that cannot hold an illegal
state, and pass that value down rather than re-validating names at each site.

Run artifacts already record stage names as strings, so recorded runs stay
readable; older artifacts remain parseable because the enums only widen.

### Where the definition lives

A file in the control repository, beside the rubrics it references. TypeScript
that exports a literal is not data: it fails criterion #3, which says a change
must need no TypeScript change. Question 1 below asks which format.

Whichever format, the definition names for each stage: `name`, `kind`, the
skill to invoke, the expected artifact (document suffix for planning stages),
its rubric path, and any stage-local validation flags such as the
acceptance-criteria requirement that only `discuss` carries today.

### Acceptance as observations

1. `bun test` passes with the existing 84 tests unchanged in intent: the
   current four-stage run still executes `discuss, grill, plan, build` in that
   order, still carries each planning artifact into the next stage's
   `priorArtifacts`, and still attaches build evidence only to the delivery
   stage. The existing `runGradedStages` tests assert this and must keep
   passing with the definition supplying the sequence.
2. A test constructs a definition with `plan` removed and observes
   `runGradedStages` execute exactly `discuss, grill, build`, with `grill`'s
   artifact appearing in build's `priorArtifacts`. No TypeScript changes
   between the four-stage and three-stage cases: only the definition value.
3. A test constructs a definition with `grill` and `plan` swapped and observes
   execution order `discuss, plan, grill, build`.
4. A test adds a fifth planning stage named something absent from today's union
   (for example `refine`, expecting a `-refined.md` document) and observes it
   execute and be judged against the rubric the definition names. This is the
   observation that proves the closed union is gone.
5. A definition missing a required field, naming a rubric file that does not
   exist, declaring a duplicate stage name, or declaring zero delivery stages
   is rejected before any Claude session starts, with an error message naming
   the offending stage and field. One test per defect class, each asserting on
   the message text.
6. A run whose definition parses starts up and reaches the first stage; the
   rejection in #5 happens before the target repository is claimed, so a bad
   definition cannot leave a target dirty.

### First test to write

Test #2 above: `runGradedStages` executes `discuss, grill, build` from a
definition with `plan` removed. It fails today because the loop cannot see a
definition at all, it forces the sequence parameter into existence, and it does
not depend on any decision below. Write it before touching the schemas.

### Order of work

The type widening is the risky part and everything else rests on it, so do it
first and keep the suite green at each step:

1. Introduce the definition type and its parser with the validation tests (#5),
   nothing consuming it yet.
2. Thread the sequence into `runGradedStages` (#2, #3), still with the closed
   union.
3. Widen `WorkflowStage` and the two Zod enums; add the new-stage test (#4).
4. Replace the `stage === "build"` branches with the `kind` strategies.
5. Move skill, document suffix, and rubric path out of code into the
   definition.

### Unknowns resolved without asking

- *Does the seam already exist?* Partly. Dependencies are injected; the
  sequence is not. Recorded above.
- *Does anything outside the harness read stage names?* Run artifacts and the
  calibration flow do, both as strings against the recorded scorecards
  (`calibration.ts:139`, `calibration.ts:267`). Widening the type does not
  break them.
- *Do the rubrics constrain stage names?* Each rubric JSON carries its own
  `stage` field, checked against the expected stage at
  `stage-grading.ts:45`. With paths in the definition, that check compares
  against the declared name.
- *Are harness blockers per stage?* Yes: delivery stages require
  `invalid-stage-delivery`, `false-test-safety`, and `unfinished-delivery`;
  planning stages require only the first (`stage-grading.ts:63`). This follows
  `kind`, not name.

<!-- SECTION:SHAPING:END -->

## Open questions

<!-- SECTION:OPEN-QUESTIONS:BEGIN -->

Answers go here; Build reads them from this section.

1. **Definition format.** Recommendation: JSON at `pipelines/default.json`,
   beside `rubrics/`, parsed with zod. Rejected: YAML (adds a dependency this
   repository does not have), and a TypeScript module (fails criterion #3).
   Answer: _pending_
2. **Configurability.** Recommendation: a `--pipeline` flag defaulting to the
   built-in path, matching how `--target` and `--model` already work; without
   it, a second pipeline means editing the default file in place.
   Answer: _pending_
3. **Fixed first and last stage?** Recommendation: require exactly one delivery
   stage and require it last, since the final Judge and the run artifact both
   assume a single committed result. Relaxing this belongs with checkpoints.
   Answer: _pending_

<!-- SECTION:OPEN-QUESTIONS:END -->
