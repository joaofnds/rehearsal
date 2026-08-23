# Project Core Guidelines

- **Stack**: NestJS, TypeScript, Bun.
- **Database**: PostgreSQL with MikroORM. `bun run migrate` runs migrations.
- **Formatting**: We strictly use Biome. Do not install/use ESLint or Prettier. Fix issues with `bun run check --apply`.
- **Validation**: We use `zod` for everything. Do not add `class-validator/class-transformer`.
- **Testing**: We use the native `bun:test` runner. Do not install Jest. Run tests via `bun run test:unit`.
