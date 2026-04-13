# Agent Mux

## Dev Tooling

- Use `mise` to install exact versions of any dev tooling needed such as `node` and `pnpm`.

## Dependencies

- Use `pnpm` to manage node dependencies.
- Use `pnpm` instead of `npx` to run scripts and tools (e.g. `pnpm tsc` not `npx tsc`).
- Install exact versions in package.json (no `^` or `~` prefixes).

## Linting & Formatting

- Run `pnpm lint` to lint (oxlint). Run `pnpm lint:fix` to auto-fix.
- Run `pnpm fmt` to format (oxfmt). Run `pnpm fmt:check` to verify formatting.
- Run `pnpm check` to run both lint and format checks.
