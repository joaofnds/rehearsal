# Contributing

Read the [vision](docs/vision.md) and [current priorities](docs/status.md) before
choosing work. Changes that make a public clone usable, preserve trustworthy
experiment evidence, or make that evidence easier to read are especially useful.

Use an issue or pull request in this repository to describe the problem and the
observable result you want. Include reproduction steps for a defect. The
maintainer's personal Backlog.md board is outside the repository; contributing
does not require access to it. A local `backlog` symlink is personal workspace
state and must not become a public documentation dependency.

## Development setup

```sh
mise install
mise exec -- bun install --frozen-lockfile
```

[mise.toml](mise.toml) pins Bun and Backlog.md. Install and authenticate Claude
Code separately for real experiments. Provider calls cost money; ordinary
development checks use fakes and local filesystem fixtures.

Run commands from the repository root with `mise exec --` so CLI subprocesses
inherit the pinned Bun. The CLI and server check the version at startup. Keep
this prefix in the guidance until direct test entry paths enforce the pin too.

```sh
mise exec -- bun run typecheck
mise exec -- bun run lint
mise exec -- bun run lint:css
mise exec -- bun run fmt:check
mise exec -- bun run test
mise exec -- bun run build:client
```

`bun run test` runs the backend suite and then the client's DOM suite. A bare
`bun test` omits the client tests. If the first half fails, the second half does
not run; execute it separately when checking client work:

```sh
mise exec -- bun test --path-ignore-patterns "**/node_modules/**" \
  --preload ./client/test-setup.ts ./client
```

See [known limitations](docs/status.md#known-limitations) for the current
Backlog.md bootstrap failure. Record the failures you observe instead of
claiming the combined suite passed.

For an integrated browser check, run `mise exec -- bun run build:client`, then
`mise exec -- bun run serve`. The `dev:client` script runs Vite alone; its current
configuration has no API proxy. Use the built client with the server when
checking real records.

## Working conventions

The harness and CLI use TypeScript on Bun. The client uses React and shared
design tokens. Use the configured formatter, linters, and test runners. Do not
add competing tools. Use Zod for validation. Do not add class-validator or
class-transformer. Read [architecture](docs/design.md)
for the component boundaries and [design handoff](docs/design-handoff/README.md)
before implementing a new screen.

Keep provider calls behind injectable dependencies so behavior can be checked
without a paid run. Preserve record compatibility when changing schemas, and
distinguish missing evidence from a failed grade. Treat benchmark fixtures as
experimental inputs. Change them only when changing the case, since their bytes
affect what the experiment measures.

Use Conventional Commits with a lowercase imperative subject, such as
`docs: explain session confirmation limits`. Use commit bodies to explain why
the change is needed. A pull request should explain the
problem, the resulting behavior, and what was checked. Include any remaining
limitation that affects use of the change.

## Keep the documentation current

Update the relevant document in the same change that alters behavior. Use this
map to find its home:

| Change                                                           | Documentation to check                               |
| ---------------------------------------------------------------- | ---------------------------------------------------- |
| Purpose, audience, or first-use path                             | `README.md`, `docs/runbook.md`                       |
| Available feature or resolved limitation                         | `docs/status.md`                                     |
| CLI behavior, case inputs, records, corpus delivery, or recovery | `docs/reference.md`, affected runbook recipe         |
| Component boundary or execution model                            | `docs/design.md`                                     |
| Product direction or evidence standard                           | `docs/vision.md`                                     |
| Domain meaning or UI vocabulary                                  | `GLOSSARY.md`                                        |
| Toolchain, checks, or contributor workflow                       | `CONTRIBUTING.md`                                    |
| Agent-specific project convention                                | `CLAUDE.md`, `tools/orchestration/worker-agent.json` |

CLI flag definitions in `src/cli/commands.ts`, scripts in `package.json`, and
schemas in `src/benchmark/` are the sources for their respective contracts.
Keep representative recipes in prose and use command help for the complete flag
inventory. Avoid copying counts, personal absolute paths, or temporary prices
into onboarding instructions.

Check relative links from the document's own directory. When adding or changing
a command example, run its provider-free commands in a clean checkout and check
its inputs against the current parsers. Label paid recipes that were not
exercised. Move a feature out of the planned list only when its user-facing path exists; a schema or prototype
alone is not that evidence. Keep the status date and its source links current
when changing the feature inventory.

Preserve the archived design and recovered sources as references. Explain their
relationship to the current product in their index files instead of silently
rewriting historical evidence. Never put private transcripts or run artifacts
in a pull request without reviewing their contents for publication.
