# Project Core Guidelines

- **What this is**: A benchmark harness that runs a workflow's stages against a
  target repository, checkpoints each stage, and replays one stage from a
  checkpoint so corpus edits can be graded. Entry points are `run-benchmark.ts`
  and `replay-stage.ts`; the harness lives in `src/benchmark/`. Domain terms are
  in [GLOSSARY.md](GLOSSARY.md); the direction is in `docs/vision.md` and
  `docs/design.md`.
- **Stack**: TypeScript on Bun. No framework, no database, no server. State is
  files under `.benchmark-runs`.
- **Formatting**: oxfmt. `bun run fmt` writes, `bun run fmt:check` verifies. Do
  not install ESLint, Prettier, or Biome.
- **Linting**: oxlint with type-aware rules, every category at error. Run
  `bun run lint`. Tests are held to the same rules as source.
- **Types**: `bun run typecheck` runs `tsc --noEmit`. Exact optional property
  types are on: an optional field must be typed `?: T | undefined`.
- **Validation**: We use `zod` for everything. Do not add
  `class-validator/class-transformer`.
- **Testing**: The native `bun:test` runner. Do not install Jest. Run the suite
  with `bun test`.
- **Commits**: Conventional Commits. A lowercase type, an optional scope, then a
  lowercase imperative subject: `fix: latch the signal path so it cannot kill its
own restore`. The body says why. Commits between 2026-08-30 and 2026-08-31 omit
  the type prefix; that was a regression, not the convention, so do not read the
  recent log as evidence.
- **Stage hygiene**: Commit every workflow artifact a stage creates (glossary,
  documents, instruction references) before declaring the stage complete; never
  claim completion with uncommitted changes or an open question in the
  completion message.
- **Backlog records**: Record acceptance criteria as backlog acceptance-criteria
  items (`backlog task edit <id> --ac "..."`), one directly observable behavior
  per item; prose in the card's sections does not count as acceptance criteria.
- **Workflow artifacts**: Treat explicit task and product-brief facts as settled
  constraints. Carry every observable behavior into the current artifact; when
  producing a specification, also put it in the acceptance criteria so
  downstream stages receive the complete behavior contract. Do not reopen
  settled behavior as a question or defer it.
