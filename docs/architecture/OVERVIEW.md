# Architecture Overview

## System Diagram

```
prontiq/ariscan (CLI — ELv2)
  | npx @prontiq/ariscan .
  | consumes @prontiq/ariscan-engine
  |
  +-- packages/schema (@prontiq/ariscan-schema)
  |     Zod schemas for PillarId, Finding, PillarResult,
  |     ScanResult, ScanConfig, Confidence, MaturityLevel
  |
  +-- packages/engine (@prontiq/ariscan-engine)
  |     8 pillar analyzers, composite scoring, security gate,
  |     context budget analysis, .agentignore parser, --fix generators
  |
  +-- packages/cli (@prontiq/ariscan)
        CLI entrypoint, argument parsing, config loading,
        terminal/JSON/SARIF/Markdown output, badge generation
```

Build order: `schema` → `engine` → `cli`. Turborepo handles this automatically.

---

## Tech Stack

> **Reference architecture:** [ripple-next](https://github.com/jbejenar/ripple-next) — an AI-agent-first government digital platform — validated these technology choices and AI-first patterns at production scale. `ariscan` extracts the **patterns** (error taxonomy, provider pattern, machine-readable outputs, multi-agent configuration surfaces), not the code. See [RFC-0003](/rfcs/RFC-0003-tech-stack-ai-first-architecture.md) for full rationale.

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Node.js 22 + TypeScript 5.7 (strict) | Widest install base via `npx @prontiq/ariscan .`, type-safe internals. Pin via `.nvmrc` + `engines`. |
| Package Manager | pnpm 9.x + pnpm workspaces | Strict dependency management, workspace support for `@prontiq/ariscan-engine`. Same as ripple-next. |
| Monorepo | Turborepo | Task caching, parallel execution, workspace-aware builds. Same as ripple-next. |
| CLI Framework | citty (UnJS) | Lightweight, TypeScript-native, zero deps. Aligns with Nuxt/Nitro ecosystem. |
| AST Parsing | Tree-sitter (WASM) | Multi-language (20+ langs), incremental, no native compilation (`node-gyp`). |
| Schema/Validation | Zod | Shared schemas between CLI config, output format, and future API. Same as ripple-next. |
| Testing | Vitest | Fast, TypeScript-native, workspace-aware. Same as ripple-next. |
| Linting | ESLint 9 (flat config) + Prettier | `no-console: error`, `no-explicit-any: error`. Same as ripple-next. |
| Build | tsup (esbuild) | Single-file CLI bundle, fast builds, tree-shaking. |
| Git Hooks | Husky | Pre-commit lint + typecheck + format. Same as ripple-next. |
| Config Format | YAML + JSON Schema | `.ariscan.yml` with published schema for IDE autocomplete + agent consumption. |

### AI-First Architecture Patterns (from ripple-next)

| Pattern | Implementation | Reference |
|---|---|---|
| Error Taxonomy | `ARI-*` codes in `docs/error-taxonomy.json` | ripple-next `RPL-*` codes |
| Machine-Readable Output | `--format json` default for agents, `--format sarif` for GitHub | ripple-next `pnpm verify --json` |
| Provider Pattern | `PillarAnalyzer` interface + conformance suites per analyzer | ripple-next provider pattern + conformance |
| Structured Remediation | Findings include `remediation.action`, `remediation.generator` | ripple-next machine-readable runbooks |
| Agent Config Surfaces | AGENTS.md, CLAUDE.md, `.github/agents/`, `.github/prompts/` | ripple-next multi-surface AI config |
| Self-Check | `npx @prontiq/ariscan doctor --json` | ripple-next `pnpm doctor --json` |
| Pure Function Core | `scan(path, config) → ScanResult` for CLI/MCP/Action | Enables MCP server (P3.10) |

---

## Repository Boundaries and Responsibilities

### @prontiq/ariscan

The CLI entrypoint and the public face of the project. Runs entirely locally with no network calls required.

**Owns:**
- CLI entrypoint, argument parsing, config loading
- Language and framework detection
- Pillar analyser orchestration (parallel execution)
- Composite ARI score calculation and tier mapping
- JSON/Markdown/SARIF output generation
- Badge generation
- `.agentignore` parsing
- `ariscan.yml` policy evaluation
- GitHub Action and CI templates
- `--fix` safe file generation

### @prontiq/ariscan-engine

The analysis engine. Provides scoring depth across all 8 pillars.

**Owns:**
- AGENTS.md quality scoring (additionality, staleness, redundancy)
- Context budget analysis and token burden estimation
- Semantic deduplication across context files
- AST-based navigability analysis (Tree-sitter)
- Circular dependency and cohesion detection
- Language-specific rubric profiles and weighting
- Provider detection (Claude, Copilot, Cursor, etc.)
- Calibration benchmark execution harness

### @prontiq/ariscan-schema

The shared type and validation layer.

**Owns:**
- Zod schemas for PillarId, Finding, PillarResult, ScanResult, ScanConfig
- Confidence and MaturityLevel types
- Pillar weight definitions (must sum to 1.0)
- Finding code registry (`ARI-*` codes)

---

## Data Flow — CLI Scan (Local)

```
npx @prontiq/ariscan .
  -> Config loading (CLI flags > ariscan.yml > defaults)
  -> Language/framework detection
  -> Context file discovery (AGENTS.md, CLAUDE.md, Copilot rules, MCP files)
  -> Pillar analysers (parallel execution, 8 pillars)
  -> Weight application + confidence calculation
  -> Security gate check (P8 < 40% -> cap at L2)
  -> Composite ARI score + L1-L5 level
  -> Output (JSON / Markdown / SARIF / terminal)
  -> Exit code (0=pass, 1=fail, 2=warn per policy)
```
