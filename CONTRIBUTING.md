# Contributing to Prontiq ARI (ariscan)

Thank you for your interest in contributing. This guide covers setup, development workflow, and conventions.

## Prerequisites

- **Node.js** 22+ (see `engines` in root `package.json`)
- **pnpm** 9+ (`corepack enable` to activate)
- **Git** 2.30+

## Setup

```bash
git clone https://github.com/prontiq/ariscan.git
cd ariscan
pnpm install
pnpm build
```

Verify everything works:

```bash
pnpm test
pnpm lint
pnpm typecheck
```

## Development Workflow

### Common Commands

| Command | Purpose |
|---------|---------|
| `pnpm build` | Build all packages (Turborepo orchestrated) |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm lint` | Lint all packages (ESLint 9) |
| `pnpm typecheck` | Type-check all packages (tsc --noEmit) |
| `pnpm format` | Format code (Prettier) |
| `pnpm format:check` | Check formatting without writing |
| `pnpm clean` | Remove build artifacts |

### Running Tests for a Single Package

```bash
pnpm --filter @prontiq/engine test
pnpm --filter @prontiq/schema test
```

### Running a Single Test File

```bash
pnpm --filter @prontiq/engine test -- --run context-quality
```

## Project Structure

```
packages/
  schema/    — Types, Zod schemas, pillar definitions (@prontiq/schema)
  engine/    — 8 pillar analyzers and scoring pipeline
  cli/       — CLI entry point (citty), output formatters
```

Dependencies are one-directional: `cli -> engine -> schema`.

## How to Add a New Pillar Analyzer

1. **Define the pillar** in `packages/schema/src/pillars.ts` — add a new `PillarId`, name, and weight (weights must sum to 1.0).

2. **Create the analyzer** at `packages/engine/src/analyzers/{name}.ts`:
   - Import from `@prontiq/schema` and `./analyzer.interface.js`
   - Implement the `PillarAnalyzer` interface
   - Export as `const {name}Analyzer: PillarAnalyzer`
   - Use `RepoContext` for all file access (never import `fs` directly)
   - Clamp the score to [0, 100]

3. **Register** it in `packages/engine/src/analyzers/registry.ts`.

4. **Add tests** using a mock `RepoContext` — see existing tests for patterns.

5. **Update documentation** — add the pillar to the rubric table in `README.md` and `AGENTS.md`.

## Pull Request Guidelines

- **One concern per PR** — keep changes focused
- **All checks must pass** — `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`
- **Include tests** for new analyzers and finding codes
- **Finding codes are stable** — never renumber existing `ARI-*` codes; append new ones
- **Describe the "why"** — PR description should explain motivation, not just what changed

## Code Style

- TypeScript strict mode, ESM only
- `.js` extensions in all relative imports
- No `any` type — use `unknown` and narrow
- No `console.log` — use structured output formatters
- `camelCase` for variables/functions, `PascalCase` for types, `UPPER_SNAKE` for constants
- Prettier handles formatting; ESLint handles logic and type rules

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
