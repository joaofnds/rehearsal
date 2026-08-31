# Project Core Guidelines

- **Stack**: NestJS, TypeScript, Bun.
- **Database**: PostgreSQL with MikroORM. `bun run migrate` runs migrations. Follow the existing `defineEntity` persistence pattern instead of adding entity decorators.
- **Formatting**: We strictly use Biome. Do not install/use ESLint or Prettier. Fix issues with `bun run check --apply`.
- **Validation**: We use `zod` for everything. Do not add `class-validator/class-transformer`.
- **Commits**: Conventional commit subjects (`type: description`, e.g. `feat: add audit worker`), matching the repository history.
- **Testing**: We use the native `bun:test` runner. Do not install Jest. Run tests via `CONFIG_PATH=src/config/test.yaml bun run test:unit`.
- **Backlog records**: Record acceptance criteria as backlog acceptance-criteria items (`backlog task edit <id> --ac "..."`), one directly observable behavior per item; prose in the card's sections does not count as acceptance criteria.
- **Workflow artifacts**: Treat explicit task and product-brief facts as settled constraints. Carry every observable behavior into the current artifact; when producing a specification, also put it in the acceptance criteria so downstream stages receive the complete behavior contract. Do not reopen settled behavior as a question or defer it.
