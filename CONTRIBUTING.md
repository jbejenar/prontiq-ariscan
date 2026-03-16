# Contributing to Prontiq ARI (ariscan)

Thank you for your interest in contributing. This guide covers setup, development workflow, and conventions.

## Prerequisites

- **Node.js** 22+ (see `engines` in root `package.json`)
- **pnpm** 9+ (`corepack enable` to activate)
- **Git** 2.30+

## Setup

```bash
git clone https://github.com/jbejenar/prontiq-ariscan.git
cd prontiq-ariscan
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
pnpm --filter @prontiq/ariscan-engine test
pnpm --filter @prontiq/ariscan-schema test
```

### Running a Single Test File

```bash
pnpm --filter @prontiq/ariscan-engine test -- --run context-quality
```

## Project Structure

```
packages/
  schema/    — Types, Zod schemas, pillar definitions (@prontiq/ariscan-schema)
  engine/    — 8 pillar analyzers and scoring pipeline
  cli/       — CLI entry point (citty), output formatters
```

Dependencies are one-directional: `cli -> engine -> schema`.

## How to Add a New Pillar Analyzer

1. **Define the pillar** in `packages/schema/src/pillar.ts` — add a new `PillarId`, name, and weight (weights must sum to 1.0).

2. **Create the analyzer** at `packages/engine/src/analyzers/{name}.ts`:
   - Import from `@prontiq/ariscan-schema` and `./analyzer.interface.js`
   - Implement the `PillarAnalyzer` interface
   - Export as `const {name}Analyzer: PillarAnalyzer`
   - Use `RepoContext` for all file access (never import `fs` directly)
   - Clamp the score to [0, 100]

3. **Register** it in `packages/engine/src/analyzers/registry.ts`.

4. **Add tests** using a mock `RepoContext` — see existing tests for patterns.

5. **Update documentation** — add the pillar to the rubric table in `README.md` and `AGENTS.md`.

6. **Update scaffold presets** if the new analyzer or finding affects scaffolded project scores. Run `ariscan init --preset bare && ariscan .` locally to verify preset output still passes the dogfood gate (≥ L3).

## How to Update Scaffold Presets

When scanner changes (new findings, weight adjustments, new criteria) affect what `ariscan init` produces:

1. Modify templates in the preset directory for each affected preset
2. Run `ariscan init --preset <name>` to scaffold a test project
3. Run `ariscan .` on the scaffolded output — must score ≥ L3 (46+)
4. Update AGENTS.md generation if architecture patterns changed
5. Add tests for new template content

> **Why:** The scaffolder and scanner share the same rubric. If the scanner evolves but templates don't, `ariscan init` output will fail its own dogfood gate. CI enforces this — but catching it locally is faster.

## Branch Protection

The `main` branch is protected with the following rules:

- **Require CI to pass** — all status checks (format, lint, typecheck, test, build, ARI self-scan) must succeed before merge.
- **Require review** — at least one approving review is required.
- **No force push** — force pushes to `main` are blocked to preserve commit history.
- **No direct pushes** — all changes go through pull requests.

These settings align with what the P8 (Security & Governance) analyzer checks for. The ARI scanner detects branch protection patterns in CI configuration and awards points for enforcement.

> **GitHub Rulesets:** GitHub's [repository rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets) offer a code-as-config alternative to branch protection settings. Consider using rulesets for more granular control (e.g., requiring signed commits, restricting file paths).

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

By contributing, you agree that your contributions will be licensed under the Elastic License 2.0 (ELv2).
