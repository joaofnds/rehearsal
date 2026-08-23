Evaluate the provided diff on these strict binary questions:

1. Did the agent write the tests using `bun:test`? (FAIL if they imported globals or used `jest`).
2. Is validation strictly done via `zod`? (FAIL if `class-validator` was used).
3. Are they using `@mikro-orm` decorators like `@Entity()`? (FAIL if they imported `typeorm`).
4. Did they successfully place the implementation in a new `src/audit/` directory?
   Output what they missed, if anything.
