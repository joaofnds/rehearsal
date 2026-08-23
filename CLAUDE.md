# Project Core Guidelines

- **Stack**: NestJS, TypeScript, Bun.
- **Database**: PostgreSQL with MikroORM. `bun run migrate` runs migrations. Follow the existing `defineEntity` persistence pattern instead of adding entity decorators.
- **Formatting**: We strictly use Biome. Do not install/use ESLint or Prettier. Fix issues with `bun run check --apply`.
- **Validation**: We use `zod` for everything. Do not add `class-validator/class-transformer`.
- **Testing**: We use the native `bun:test` runner. Do not install Jest. Run tests via `CONFIG_PATH=src/config/test.yaml bun run test:unit`.
