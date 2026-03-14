# AGENTS.md — Prontiq ARI (ariscan)

## Project Overview

Prontiq ARI (Agent Readiness Index) is a CLI tool that scores repositories (0-100) on how ready they are for AI coding agents. Run `npx @prontiq/ariscan-cli .` to scan a repo. The score is derived from 8 research-calibrated pillars. This is an open-core product: the CLI is licensed under the Elastic License 2.0 (ELv2) — free to use, modify, and redistribute, but cannot be offered as a managed service or resold; future SaaS layers add longitudinal tracking and remediation.

## Architecture

Monorepo managed with pnpm workspaces and Turborepo:

```
packages/
  schema/     — Zod schemas, pillar types, score contracts (@prontiq/ariscan-schema)
  engine/     — 8 pillar analyzers, scoring pipeline, RepoContext abstraction
  cli/        — CLI entry point using citty, output formatting, policy execution
```

Dependencies flow one-way: `cli -> engine -> schema`. No circular imports.

### Key Abstractions

- **`PillarAnalyzer`** (`packages/engine/src/analyzers/analyzer.interface.ts`) — interface every analyzer implements: `pillar`, `name`, `version`, `supports()`, `analyze()`.
- **`RepoContext`** (`packages/engine/src/context/repo-context.ts`) — read-only filesystem abstraction passed to analyzers. Provides `readFile()`, `fileExists()`, `readJson()`, and a `files` listing.
- **`ANALYZERS` registry** (`packages/engine/src/analyzers/registry.ts`) — array of all 8 analyzers, queried by pillar ID.
- **`Finding`** — structured diagnostic with `code`, `severity`, `pillar`, `message`, `remediation`, optional `evidence`, and optional `confidence` (high/medium/low).

## Tech Stack

- **Language:** TypeScript (strict mode, ESM only)
- **Package manager:** pnpm 9+ with workspaces
- **Build orchestration:** Turborepo
- **Bundler:** tsup
- **CLI framework:** citty
- **Validation:** Zod
- **Testing:** Vitest
- **Linting:** ESLint 9 (flat config) + Prettier
- **Git hooks:** Husky
- **Runtime:** Node.js 22+

## The 8-Pillar Scoring Rubric

| ID | Pillar | Weight | Analyzer File |
|----|--------|--------|---------------|
| P1 | Agent Context Quality | 15% | `context-quality.ts` |
| P2 | Feedback Loop Speed | 15% | `feedback-loop.ts` |
| P3 | Test Isolation | 18% | `test-isolation.ts` |
| P4 | Dev Environment | 10% | `dev-environment.ts` |
| P5 | Doc Machine-Readability | 10% | `doc-readability.ts` |
| P6 | Build Determinism & Type Safety | 15% | `build-determinism.ts` |
| P7 | Code Navigability | 12% | `navigability.ts` |
| P8 | Security & Governance | 5% (gate) | `security-governance.ts` |

**Security gate:** P8 score below 40% caps the overall maturity level at L2 regardless of composite score.

**Composite formula:** `sum(pillar_score * pillar_weight)` clamped to [0, 100].

**Maturity levels:** L1 Hostile (0-25), L2 Fragile (26-45), L3 Capable (46-65), L4 Productive (66-80), L5 Autonomous (81-100).

## Key Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (turborepo)
pnpm test             # Run all tests (vitest)
pnpm lint             # Lint all packages (eslint)
pnpm typecheck        # Type-check all packages (tsc --noEmit)
pnpm format           # Format with prettier
pnpm format:check     # Check formatting
pnpm selftest         # Self-scan dogfood gate (score must be >= 70)
pnpm clean            # Remove dist/ and build artifacts
```

**Quality gate:** This repo dogfoods its own scanner. `pnpm selftest` runs `ariscan` against the repo itself and fails if the score drops below 70 (L4 Productive). CI also enforces a per-pillar floor of 35. Run `pnpm selftest` after any change that could affect the score.

## Code Conventions

- **ESM only** — all packages use `"type": "module"` and `.js` extensions in imports
- **Strict TypeScript** — `strict: true` in all tsconfigs
- **No `any` type** — use `unknown` and narrow, or define explicit types
- **No `console.log`** — use structured logging or CLI output formatters
- **Import extensions** — always use `.js` extension in relative imports (ESM requirement)
- **Naming:** `camelCase` for variables/functions, `PascalCase` for types/interfaces, `UPPER_SNAKE` for constants
- **Finding codes** follow pattern `ARI-{PILLAR}-{NNN}` (e.g., `ARI-CTX-001`, `ARI-SEC-003`)
- **Analyzer exports** are named `{pillarName}Analyzer` (e.g., `contextQualityAnalyzer`)

## File Structure

```
packages/schema/src/
  index.ts              — re-exports all types
  pillar.ts             — PillarId, PILLAR_NAMES, PILLAR_WEIGHTS
  config.ts             — configuration types
  scan-result.ts        — Finding, PillarResult, ScanResult, Confidence types

packages/engine/src/
  analyzers/
    analyzer.interface.ts — PillarAnalyzer interface
    registry.ts           — ANALYZERS array and getAnalyzer()
    context-quality.ts    — P1 analyzer
    feedback-loop.ts      — P2 analyzer
    test-isolation.ts     — P3 analyzer
    dev-environment.ts    — P4 analyzer
    doc-readability.ts    — P5 analyzer
    build-determinism.ts  — P6 analyzer
    navigability.ts       — P7 analyzer
    security-governance.ts — P8 analyzer
  context/
    repo-context.ts       — RepoContext read-only filesystem abstraction
  scoring/
    composite.ts          — composite score calculation, security gate logic
  budget/
    token-estimator.ts    — file classification and token estimation
    budget-analyzer.ts    — budget analysis, hotspots, compression recommendations
    index.ts              — barrel export
  fix/
    generators.ts         — safe --fix generators (up to 15 files: AGENTS.md, .agentignore, .devcontainer, tsconfig, .nvmrc, pre-commit, CODEOWNERS, PR template, ADR, CHANGELOG, docker-compose, .gitleaks.toml, provider skeleton, env var docs, DI wiring examples)
    index.ts              — barrel export
  agentignore/
    parser.ts             — .agentignore parser (gitignore-compatible patterns)
    index.ts              — barrel export
  scan.ts                — orchestrates analyzers, computes composite
  index.ts               — public API

packages/cli/src/
  cli.ts                 — CLI entry (citty)
  index.ts               — public API
  commands/
    scan.ts              — scan subcommand
  output/                — output formatting
    json.ts              — JSON output formatter
    terminal.ts          — terminal/text output formatter
    budget.ts            — token budget output formatter
```

## Common Tasks

### Adding a New Analyzer

1. Create `packages/engine/src/analyzers/{name}.ts` implementing `PillarAnalyzer`
2. Export a `const {name}Analyzer: PillarAnalyzer` with `pillar`, `name`, `version`, `supports()`, `analyze()`
3. Register it in `packages/engine/src/analyzers/registry.ts`
4. Add the pillar ID, name, and weight to `packages/schema/src/pillar.ts`
5. Add tests in `packages/engine/src/__tests__/`

### Adding a Finding Code

1. Use the pattern `ARI-{ABBREV}-{NNN}` where ABBREV maps to the pillar
2. Pillar abbreviations: CTX, FBK, TST, ENV, DOC, BLD, NAV, SEC
3. Include `severity`, `message`, `remediation` (with `action`, `description`, `confidence`)
4. Optionally include `evidence` with `paper`, `finding`, `confidence` for research-backed findings

### Modifying Scoring

1. Pillar weights are in `packages/schema/src/pillar.ts` — they must sum to 1.0
2. Individual pillar scores are computed in each analyzer's `analyze()` method
3. Scores are clamped to [0, 100] at the analyzer level
4. The security gate logic is in `packages/engine/src/scoring/composite.ts`

### Updating Scaffold Presets

When scanner changes affect what `ariscan init` produces (new findings, weight changes, new criteria):

1. Update affected preset templates to satisfy the new criteria
2. Run `ariscan init --preset <name>` and then `ariscan .` on the output — must score ≥ L3 (46+)
3. If a new `--fix` generator was added, align the scaffold template for the same concern
4. Update AGENTS.md generation logic if architecture patterns changed

The scaffolder and scanner share the same rubric and must co-evolve. CI runs the scaffold→scan loop on every build to catch drift.

## Do NOT

- **Don't execute target repo code** — analyzers only read files, never run scripts from the scanned repository
- **Don't make network calls during scan** — all analysis is local and offline
- **Don't use the `any` type** — use `unknown` with type narrowing or explicit interfaces
- **Don't import without `.js` extension** — ESM requires explicit extensions
- **Don't add `console.log`** — use the CLI formatter layer for output
- **Don't modify pillar weights** without updating the research calibration notes
- **Don't bypass the RepoContext abstraction** — analyzers must not use `fs` directly
