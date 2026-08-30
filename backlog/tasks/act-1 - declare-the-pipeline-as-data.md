---
id: ACT-1
title: declare the pipeline as data
status: Done
assignee:
  - '@claude'
created_date: '2026-08-30 12:43'
updated_date: '2026-08-30 17:37'
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
- [x] #1 The four-stage run executes discuss, grill, plan, build in order from the definition, carrying each planning artifact into later stages' priorArtifacts and attaching build evidence only to the delivery stage; the existing runGradedStages tests pass unchanged in intent.
- [x] #2 A definition with plan removed executes exactly discuss, grill, build, with grill's artifact in build's priorArtifacts, and no TypeScript differs between the four- and three-stage cases.
- [x] #3 A definition with grill and plan swapped executes discuss, plan, grill, build.
- [x] #4 A definition adding a fifth planning stage under a name absent from today's union executes it and judges it against the rubric the definition names.
- [x] #5 The pipeline definition is JSON at pipelines/default.json, parsed with zod, naming each stage's kind, skill, expected artifact, and rubric path.
- [x] #6 A --pipeline flag selects the definition file and defaults to pipelines/default.json, alongside the existing --target and --model flags.
- [x] #7 A definition that omits a required field, names a missing rubric file, repeats a stage name, declares no delivery stage, declares more than one, or does not place the delivery stage last is rejected with an error naming the offending stage and field, one test per defect class.
- [x] #8 Definition rejection happens before the target repository is claimed, so a malformed definition cannot leave a target dirty.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What changed

The stage sequence is a JSON file the harness reads, not code. `pipelines/default.json` declares the four stages; `--pipeline` (or `BENCHMARK_PIPELINE`) selects another, defaulting to that file.

Three things had to move before the loop could be driven by data:

1. `WorkflowStage` was a closed union of the four names, baked into `stageRubricSchema` and `humanFindingSchema`. A user-authored stage name could not be expressed. It is now an open string; `WORKFLOW_STAGES` is gone.
2. Per-stage behavior branched on the literal `"build"` in three places (mandatory rubric blockers, forced check failures, build-candidate capture) and on `"discuss"` in one (acceptance criteria). All four now key off the stage's declared kind or a declared flag.
3. A rubric declared its own `stage` name and was refused for any other stage. The definition already names each stage's rubric, so the field was a second answer to the same question; it is removed from the schema and the four rubric files. What it actually protected is enforced by kind instead.

## What opening the type cost, and what closes it

Opening a type that five files relied on created a class of defect: values that were safe because they could only be one of four identifiers are now user-authored. Six were found and fixed, three by me and three by independent review.

- A stage named `final` collided with the marker human review uses for findings against the final Judge, making a correct finding about that stage unrecordable. Reserved.
- A stage named `review` collided with the human-review file's path, so a scorecard and the human's findings overwrote each other. Reserved.
- A stage name was interpolated into scorecard file paths, so `../../escaped` wrote outside the run directory and `a/b` created a silent subdirectory. Names are constrained to one plain identifier.
- The `skill` field was interpolated into the prompt of the one session that runs with `access: "unrestricted"`. A newline put arbitrary instructions in that prompt. Same identifier constraint.
- Unknown fields were accepted, so `requiresAcceptanceCritera` parsed cleanly and silently disabled the acceptance-criteria check. Both stage schemas are strict.
- `runWorkflowStage` used one value as both the skill to invoke and the transcript's label. A stage whose name differed from its skill produced a run artifact whose transcript and scorecard disagreed about which stage ran. The two are now separate parameters.

Two further gaps closed: `loadPipeline` now parses every rubric against its stage's kind, so a delivery stage pointed at a planning rubric is refused before the target is claimed rather than mid-run; and the `--pipeline` value is confined to the control repository.

## Observed, this session

Ran `runGradedStages` against four definitions on the final code and read the judged order, transcript labels, skills invoked, rubrics applied, and the delivery stage's priorArtifacts:

- default: discuss, grill, plan, build; priors discuss, grill, plan
- plan removed: discuss, grill, build; priors discuss, grill
- grill/plan swapped: discuss, plan, grill, build
- fifth stage `research` running the `discuss` skill: judged and transcribed as `research`, skill `discuss` invoked, graded against the grill rubric its definition names

No TypeScript differs between these cases. Build evidence attached only to the delivery stage in all four.

Verified each rejection by construction, reading the actual message: reserved names, unsafe names, injecting skills, unknown fields, missing rubric, duplicate name, no delivery stage, two delivery stages, delivery not last, rubric that does not fit its kind, and a path outside the control repository. Each names the offending stage and field.

Ran the harness binary: a missing definition is rejected before the target is touched, via both the flag and the environment variable.

Mutation-checked the acceptance-criteria guard: deleting it left the suite green before, and fails a test now.

112 pass / 0 fail, typecheck clean, Biome clean.

## Not verified

No live end-to-end run against a real target with real Claude sessions. The Claude-invoking dependencies were faked; the rest of the loop is real code. A live run costs money and was not directed.

Note: this machine's `bun` is 1.3.13, not the 1.4.0 the project pins. The suite passes on both; the earlier runs in this task were on 1.4.0.

## Deliberately left

A planning stage may still adopt the delivery rubric. It fails every requirement and stops the run at its first Judge, so it is loud rather than silent, and refusing it would also refuse two planning stages sharing one rubric, which a pipeline should be able to do.

`parsePipeline` reports only the first schema issue, so fixing a broken definition can take more than one pass.

## Carried forward

ACT-9: the run artifact records the model, efforts, budget, rubric, and every SHA, but not the pipeline. Harmless when the sequence was a constant; now that it varies per run, two artifacts can differ in which stages ran with nothing saying so. ACT-6 and ACT-2 both need it.

Nothing is built-but-unwired. Every caller is on the new path.
<!-- SECTION:NOTES:END -->

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

JSON at `pipelines/default.json`, beside the rubrics it references, parsed with
zod, selected by a `--pipeline` flag that defaults to that path. TypeScript that
exports a literal is not data: it fails the criterion that a pipeline change
must need no TypeScript change.

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

Acceptance #2: `runGradedStages` executes `discuss, grill, build` from a
definition with `plan` removed. It fails today because the loop cannot see a
definition at all, and it forces the sequence parameter into existence. Write it
before touching the schemas.

### Order of work

The type widening is the risky part and everything else rests on it, so do it
first and keep the suite green at each step:

1. Introduce the definition type and its zod parser with the rejection tests
   (acceptance #7), nothing consuming it yet.
2. Thread the sequence into `runGradedStages` (acceptance #2, #3), still with
   the closed union.
3. Widen `WorkflowStage` and the two zod enums; add the new-stage test
   (acceptance #4).
4. Replace the `stage === "build"` branches with the `kind` strategies.
5. Move skill, document suffix, and rubric path out of code into the
   definition, and write `pipelines/default.json` describing today's four
   stages (acceptance #5).
6. Add the `--pipeline` flag to `parseArgs`, and parse the definition before
   `claimTarget` so a bad file cannot dirty a target (acceptance #6, #8).

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

All three are answered; Build treats them as settled constraints.

1. **Definition format.** JSON at `pipelines/default.json`, beside `rubrics/`,
   parsed with zod. Rejected: YAML (adds a dependency this repository does not
   have), and a TypeScript module (fails criterion #3).
   Answer: agreed.
2. **Configurability.** A `--pipeline` flag defaulting to the built-in path,
   matching how `--target` and `--model` already work.
   Answer: agreed.
3. **Fixed first and last stage?** Require exactly one delivery stage and
   require it last, since the final Judge and the run artifact both assume a
   single committed result. Relaxing this belongs with checkpoints.
   Answer: agreed.

<!-- SECTION:OPEN-QUESTIONS:END -->
