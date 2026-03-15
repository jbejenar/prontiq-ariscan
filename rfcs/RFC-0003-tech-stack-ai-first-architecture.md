# RFC-0003: Tech Stack & AI-First Architecture for `ariscan`

**Author:** John Bejenariu
**Date:** 2026-03-07
**Status:** Draft
**Relates to:** P1.01, P1.02, P1.03, P3.07, P3.08, P3.10
**Repo:** `prontiq/ariscan`

---

## Summary

Defines the technology stack, architectural patterns, and AI-first design principles for the `ariscan` open-source CLI. The stack is informed by production-validated patterns from the [ripple-next](https://github.com/jbejenar/ripple-next) reference architecture — an AI-agent-first government digital platform — adapted for a cross-stack scanning tool that must work across any repository with zero friction.

## Motivation

The `ariscan` CLI must satisfy three constraints simultaneously:

1. **Zero-friction adoption:** `npx @prontiq/ariscan-cli .` must work on any repository without requiring the target repo's language toolchain, global installs, or configuration.
2. **AI-agent-first design:** AI coding agents (Claude Code, Copilot, Cursor, Codex, Aider) are treated as first-class developers. Every output, error, and interface is designed for machine consumption first, human readability second.
3. **Cross-stack universality:** The scanner must analyze TypeScript, Python, Go, Rust, Java, C#, Ruby, and PHP repositories without depending on any of those ecosystems' toolchains.

The ripple-next project (Apache 2.0, Victorian government digital platform) has validated an AI-agent-first development methodology at scale: machine-readable error taxonomies, provider pattern abstractions, structured runbooks, and multi-agent configuration surfaces (AGENTS.md, CLAUDE.md, `.github/agents/`, `.github/prompts/`, `.github/skills/`). This RFC extracts those **patterns** (not code) for application to `ariscan`.

### Why Not Use Ripple-Next Directly

Ripple-next is a full-stack government web application with Drupal CMS integration, WCAG 2.1 AA accessibility requirements, Ripple UI components, and government-specific auth flows. Approximately 70% of its codebase is irrelevant to a CLI scanning tool. Additionally:

- **Dependency gravity:** Pulling `@ripple-next/*` packages ties `ariscan` to a separate registry and a government platform's release cadence.
- **Shape mismatch:** `ariscan` is a CLI scanner; ripple-next is a web app framework.
- **Timeline:** `ariscan` v0.1.0 ships May 4, 2026 (M1). Waiting for a generic fork of ripple-next is not viable.

### Why Not Wait for a Generic Fork

- No timeline exists for a generic fork, and it may never happen.
- The value is in the **patterns**, not the **code**.
- A future `@prontiq/ai-first-toolkit` package (post-M3) could extract shared patterns into a standalone library.

## Design

### Option A: Mirror Ripple-Next Stack, Extract Patterns (Recommended)

Use the same core technology choices as ripple-next for ecosystem consistency, but build `ariscan` from scratch applying ripple-next's AI-first patterns.

#### Core CLI Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Runtime** | Node.js 22 + TypeScript 5.7 (strict) | Same as ripple-next. `npx @prontiq/ariscan-cli .` = zero install. Widest reach via npm. Pin exact version in `.nvmrc` and `engines` field. |
| **Package Manager** | pnpm 9.x + pnpm workspaces | Same as ripple-next. Strict dependency management, workspace support for monorepo packages. |
| **Monorepo Orchestration** | Turborepo | Same as ripple-next. Task caching, parallel execution, workspace-aware builds. |
| **CLI Framework** | citty (UnJS) | Lightweight, TypeScript-native, zero dependencies. Part of the UnJS ecosystem. Preferable over Commander.js/Yargs (heavyweight, many transitive deps) or oclif (unnecessary plugin architecture). |
| **AST Parsing** | Tree-sitter (WASM bindings) | Multi-language parsing (20+ languages) without requiring target language toolchains. WASM eliminates native compilation (`node-gyp`). Incremental parsing for performance. |
| **Schema/Validation** | Zod | Same as ripple-next. Shared schemas between CLI config, output format, and future API. Type inference from schemas. |
| **Testing** | Vitest | Same as ripple-next. Fast, TypeScript-native, workspace-aware. |
| **Linting** | ESLint 9 (flat config) + Prettier | Same as ripple-next. `no-console: error`, `@typescript-eslint/no-explicit-any: error`. |
| **Build** | tsup (esbuild) | Single-file CLI bundle. Fast builds, tree-shaking, minimal distributable size. |
| **Git Hooks** | Husky | Same as ripple-next. Pre-commit lint + typecheck + format. |
| **Config Format** | YAML (`.ariscan.yml`) + JSON Schema | Human-writable, machine-parseable. Published JSON Schema for IDE autocomplete + agent consumption. |

### Option B: Lightweight Standalone Stack

Use minimal tooling without alignment to ripple-next. Built-in `parseArgs` instead of citty, Jest instead of Vitest, no monorepo tooling.

**Trade-offs:** Faster initial setup, but divergent tooling creates friction when extending the platform. No ecosystem consistency with the reference implementation that validates the AI-first patterns.

### Recommendation

**Option A.** The alignment benefit is significant: same tooling means engineers (human and AI) move between repos without context-switching. The validated patterns from ripple-next reduce design risk for the AI-first architecture.

---

## AI-First Architecture Patterns

These patterns are extracted from ripple-next's production-validated approach and adapted for `ariscan`.

### Pattern 1: Error Taxonomy (`ARI-*` Codes)

Modeled on ripple-next's `RPL-*` error taxonomy (`docs/error-taxonomy.json`, 51KB). Every finding has a machine-readable code, not just a human-readable message.

```
ARI-CTX-001  Missing AGENTS.md
ARI-CTX-002  AGENTS.md exceeds context budget (>4000 tokens)
ARI-CTX-003  AGENTS.md is LLM-generated (low additionality)
ARI-CTX-004  Context file stale (>90 days since last update vs code changes)
ARI-FBK-001  Test execution time >5 minutes
ARI-FBK-002  No watch mode configured
ARI-TST-001  Tests require cloud credentials
ARI-TST-002  Unordered collection assertion detected
ARI-TST-003  Flakiness transfer risk (timing-dependent pattern)
ARI-ENV-001  No devcontainer.json found
ARI-ENV-002  No bootstrap script detected
ARI-DOC-001  No OpenAPI/API contract found
ARI-DOC-002  No error taxonomy defined
ARI-TYP-001  TypeScript strict mode disabled
ARI-TYP-002  No lockfile committed
ARI-NAV-001  Circular dependency detected
ARI-NAV-002  Cyclomatic complexity >15
ARI-SEC-001  No branch protection detected
ARI-SEC-002  No CODEOWNERS file
ARI-SEC-003  No secrets scanning configured
```

**Implementation:** Taxonomy stored as structured JSON in `docs/error-taxonomy.json`, consumable via `npx @prontiq/ariscan-cli taxonomy --json`. Each code includes: severity, pillar, description, remediation action, research citation.

### Pattern 2: Machine-Readable Everything

Modeled on ripple-next's `pnpm verify --json` and `pnpm doctor --json` patterns.

```bash
# Human developer (default when TTY detected)
npx @prontiq/ariscan-cli .

# AI agent / CI pipeline (structured output)
npx @prontiq/ariscan-cli . --format json

# GitHub Code Scanning integration
npx @prontiq/ariscan-cli . --format sarif --output ariscan.sarif

# Self-check (modeled on ripple-next's pnpm doctor)
npx @prontiq/ariscan-cli doctor --json

# Taxonomy lookup
npx @prontiq/ariscan-cli taxonomy ARI-TST-001 --json

# Schema export for validation tooling
npx @prontiq/ariscan-cli --json-schema
```

**Output contract:** JSON output is the primary contract (P1.14). Terminal output is a pretty-printed derivative. SARIF is a projection for GitHub integration. All three are generated from the same internal `ScanResult` type (Zod schema).

### Pattern 3: Structured Remediation Data

Modeled on ripple-next's machine-readable runbooks (`pnpm runbook <name> --json`).

```json
{
  "code": "ARI-CTX-001",
  "severity": "critical",
  "pillar": "agent-context-quality",
  "pillar_weight": 0.15,
  "file": null,
  "line": null,
  "message": "No AGENTS.md found at repository root",
  "remediation": {
    "action": "create-file",
    "path": "AGENTS.md",
    "generator": "npx @prontiq/ariscan-cli init agents-md",
    "template": "https://prontiq.dev/templates/agents-md",
    "estimated_impact": "+12 points composite",
    "confidence": "high"
  },
  "evidence": {
    "paper": "Lulla et al., 2026",
    "finding": "Quality AGENTS.md reduces agent time 28.6%, tokens 16.6%",
    "confidence": "high"
  }
}
```

An AI agent reads this and knows exactly what command to run. No parsing English prose.

### Pattern 4: Provider Pattern for Analyzers

Modeled on ripple-next's provider pattern (queue, auth, storage, email, CMS — each with memory/mock/cloud implementations and conformance suites).

```typescript
// packages/engine/src/analyzers/analyzer.interface.ts
export interface PillarAnalyzer {
  readonly pillar: PillarId;
  readonly name: string;
  readonly version: string;

  analyze(context: RepoContext): Promise<PillarResult>;
  supports(context: RepoContext): boolean;
}

// Each pillar implements the interface
// packages/engine/src/analyzers/context-quality.ts
export class ContextQualityAnalyzer implements PillarAnalyzer {
  readonly pillar = 'P1';
  readonly name = 'agent-context-quality';
  readonly version = '1.0.0';

  async analyze(context: RepoContext): Promise<PillarResult> { /* ... */ }
  supports(context: RepoContext): boolean { return true; } // Always applicable
}
```

**Conformance suites:** Every analyzer must pass the conformance tests in `packages/testing/conformance/`. Community contributors adding new analyzers implement the interface and pass conformance — same pattern as ripple-next's provider conformance.

### Pattern 5: AI-Agent Configuration Surfaces

Modeled on ripple-next's multi-surface AI configuration:

| Ripple-Next Surface | Ariscan Equivalent | Purpose |
|---|---|---|
| `AGENTS.md` | `AGENTS.md` | Primary AI agent reference — architecture, task routing, conventions |
| `CLAUDE.md` | `CLAUDE.md` | Claude Code-specific guidance — quality gates, auto-imports, testing |
| `.github/copilot-instructions.md` | `.github/copilot-instructions.md` | GitHub Copilot-specific instructions |
| `.github/agents/*.agent.md` | `.github/agents/*.agent.md` | Specialized agent personas (e.g., `scorer.agent.md`, `analyzer.agent.md`) |
| `.github/prompts/*.prompt.md` | `.github/prompts/*.prompt.md` | Reusable prompt templates for common tasks |
| `docs/error-taxonomy.json` | `docs/error-taxonomy.json` | Machine-readable error codes (`ARI-*`) |
| `pnpm verify --json` | `npx @prontiq/ariscan-cli verify --json` | Structured quality gate execution |
| `pnpm doctor --json` | `npx @prontiq/ariscan-cli doctor --json` | Environment self-check |

**The meta-requirement:** `ariscan`'s own repository must score L5 on its own rubric. It eats its own dog food by shipping all the context files, configurations, and patterns it measures in other repos.

### Pattern 6: Pure Function Core for MCP Integration

The scanning engine is designed as a pure function: `(repoPath, config) → ScanResult`. This enables:

1. **CLI consumption:** The primary interface.
2. **MCP server (P3.10):** Expose as a Model Context Protocol tool that Claude/Copilot/Cursor can invoke directly.
3. **GitHub Action (P3.02):** Import and execute in CI.
4. **Programmatic integration:** Consumable as a library by downstream tools and services.

```typescript
// Core scanning is a pure function
export async function scan(
  repoPath: string,
  config: ScanConfig
): Promise<ScanResult> {
  const context = await buildRepoContext(repoPath, config);
  const results = await Promise.all(
    analyzers
      .filter(a => a.supports(context))
      .map(a => a.analyze(context))
  );
  return compositeScore(results, config.weights);
}
```

---

## Cross-Stack Compatibility (Lowest Friction)

The scanner must work on **any** repository without imposing dependencies:

| Friction Source | Solution |
|---|---|
| **Install** | `npx @prontiq/ariscan-cli .` — no global install, no brew, no pip, no cargo. npm is the universal distribution channel. |
| **Runtime deps on target** | Zero. Tree-sitter WASM parses any language without that language's toolchain installed. |
| **Native compilation** | None. Tree-sitter grammars shipped as WASM. No `node-gyp`, no build tools required on user's machine. |
| **Configuration** | Works with zero config. `.ariscan.yml` is opt-in for customization. |
| **CI integration** | Single GitHub Action (`prontiq/ariscan-action@v1`). Exit codes (0/1/2) + SARIF for any CI. |
| **Agent integration** | JSON-first output with taxonomy codes. Any agent can consume output and act on findings. |
| **Monorepo support** | Workspace detection built-in (Turborepo, Nx, Lerna, pnpm workspaces, Cargo workspaces, Go modules). Per-package scoring. |
| **Offline operation** | Core scanning is fully offline. No API keys, no network calls. Telemetry is opt-in (P2.13). |
| **Supply chain trust** | Minimal dependency footprint. Every dependency is a reason for a security-conscious team to not adopt. |

---

## Project Structure

```
prontiq/ariscan/
├── packages/
│   ├── cli/                        # CLI entrypoint (citty)
│   │   ├── src/
│   │   │   ├── commands/           # scan, doctor, init, audit, taxonomy
│   │   │   ├── output/             # json.ts, sarif.ts, terminal.ts
│   │   │   └── cli.ts              # Entry point
│   │   └── package.json
│   ├── engine/                     # Core scanning engine (pure functions)
│   │   ├── src/
│   │   │   ├── analyzers/          # One module per pillar
│   │   │   │   ├── analyzer.interface.ts
│   │   │   │   ├── context-quality.ts      # P1
│   │   │   │   ├── feedback-loop.ts        # P2
│   │   │   │   ├── test-isolation.ts       # P3
│   │   │   │   ├── dev-environment.ts      # P4
│   │   │   │   ├── doc-readability.ts      # P5
│   │   │   │   ├── build-determinism.ts    # P6
│   │   │   │   ├── navigability.ts         # P7
│   │   │   │   └── security-governance.ts  # P8
│   │   │   ├── detection/          # Language, framework, monorepo detection
│   │   │   ├── context/            # Context file discovery and analysis
│   │   │   ├── scoring/            # Composite scoring, weighting, gates
│   │   │   └── scan.ts             # Pure function: (path, config) → ScanResult
│   │   └── package.json
│   ├── schema/                     # Shared Zod schemas + JSON Schema generation
│   │   ├── src/
│   │   │   ├── scan-result.ts      # ScanResult schema
│   │   │   ├── config.ts           # ariscan.yml schema
│   │   │   ├── taxonomy.ts         # Error taxonomy schema
│   │   │   └── sarif.ts            # SARIF output schema
│   │   └── package.json
│   └── testing/                    # Test infrastructure
│       ├── conformance/            # Analyzer conformance suites
│       ├── fixtures/               # Test repos for each language
│       └── package.json
├── docs/
│   ├── error-taxonomy.json         # ARI-* error codes (machine-readable)
│   └── architecture/
├── rfcs/
├── .github/
│   ├── agents/                     # Specialized agent personas
│   ├── prompts/                    # Reusable prompt templates
│   └── copilot-instructions.md
├── AGENTS.md                       # Primary AI agent reference
├── CLAUDE.md                       # Claude Code-specific guidance
├── .agentignore                    # Dog-fooded agentignore
├── ariscan.yml                     # Dog-fooded policy (targets L5)
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── vitest.workspace.ts
└── package.json
```

---

## Implementation Plan

1. **M0 (Mar 22, 2026):** Claim `ariscan` npm package. Initialize monorepo with pnpm + Turborepo + TypeScript strict. Set up Vitest, ESLint 9, Prettier, Husky. Create AGENTS.md, CLAUDE.md, .agentignore, error-taxonomy.json scaffolds.

2. **M1 (May 4, 2026):** Ship `ariscan` v0.1.0. All 8 pillar analyzers implementing the `PillarAnalyzer` interface. JSON output contract v1. citty CLI with `scan`, `doctor`, `init` commands. Tree-sitter WASM for TypeScript/Python/Go/Java AST parsing.

3. **M2 (Jul 13, 2026):** Ship `ariscan` v0.5.0. Context quality generator, `.agentignore` parser, context budget analyzer. Guided remediation templates. Conformance suites for all analyzers.

4. **M3 (Sep 21, 2026):** Ship `ariscan` v1.0.0. `ariscan.yml` policy contract, GitHub Action GA, plugin architecture, MCP read-only server. Evaluate extracting shared AI-first patterns into `@prontiq/ai-first-toolkit`.

---

## Future: `@prontiq/ai-first-toolkit` (Post-M3)

After `ariscan` v1.0.0 validates the patterns, consider extracting shared AI-first infrastructure into a standalone package:

- Error taxonomy scaffolding and validation
- AGENTS.md / CLAUDE.md templates and quality checker
- Machine-readable runbook runtime
- Provider pattern base classes and conformance harness
- `verify --json` / `doctor --json` conventions

This would allow any project to adopt the AI-first patterns validated in both ripple-next and ariscan without depending on either.

---

## Open Questions

1. Should the `engine` package be published as a separate npm package from day one, or should all analysis logic live in the `ariscan` monorepo until external consumption is needed?
2. Should Tree-sitter grammars be bundled in the npm package (larger install size, offline-capable) or downloaded on first use (smaller install, requires network)?
3. Should the error taxonomy version independently of the rubric version (RFC-0001), or are they always released together?

## Decision

[Pending]
