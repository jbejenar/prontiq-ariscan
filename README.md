# Prontiq ARI — `@prontiq/ariscan-cli`

[![CI](https://github.com/jbejenar/prontiq-ariscan/actions/workflows/ci.yml/badge.svg)](https://github.com/jbejenar/prontiq-ariscan/actions/workflows/ci.yml)

> Measure and improve how ready your codebase is for AI coding agents.

**ARI** (Agent Readiness Index) is a composite score (0-100) derived from 8 research-calibrated pillars. Run `npx @prontiq/ariscan-cli .` to get an actionable readiness report in under 10 minutes.

> **Naming note:** historical research and draft materials may refer to **Tide Conform**. Current naming is **Prontiq ARI**.

---

## What Is This?

Prontiq is an open-core platform that measures and improves repository readiness for AI coding agents.

### Product Layers

1. **Scoring engine** — 8-pillar readiness scoring with maturity tiers.
2. **Remediation engine** — practical fixes for context quality, testability, environment parity, and governance controls.
3. **Data platform** — longitudinal insights linking repository structure to agent outcomes.

---

## The ARI Score

| Pillar | Weight | What It Measures |
|---|---|---|
| Agent Context Quality | 15% | AGENTS.md quality, information additionality, conciseness |
| Feedback Loop Speed | 15% | Local test/lint/typecheck speed, CI duration |
| Test Isolation | 18% | Cloud credential independence, DI patterns, determinism |
| Dev Environment | 10% | Devcontainer, bootstrap scripts, time-to-first-test |
| Doc Machine-Readability | 10% | OpenAPI schemas, error taxonomy, env var validation |
| Build Determinism & Type Safety | 15% | TypeScript strict, lockfiles, reproducible builds |
| Code Navigability | 12% | Module boundaries, import graph, dead code, complexity |
| Security & Governance | 5% (gate) | Branch protection, CODEOWNERS, secrets scanning, SAST |

### Maturity Levels

| Level | Name | Score | What Agents Can Achieve |
|---|---|---|---|
| L1 | Hostile | 0-25 | Almost nothing — agents thrash, hallucinate, waste tokens |
| L2 | Fragile | 26-45 | Simple single-file edits with heavy supervision |
| L3 | Capable | 46-65 | Routine tasks with moderate supervision |
| L4 | Productive | 66-80 | Multi-file features and refactoring with light supervision |
| L5 | Autonomous | 81-100 | Complex cross-service tasks, agent self-verifies |

Security acts as a **gate**: below 40% on Pillar 8 caps the overall level at L2 regardless of other scores.

---

## Quick Start

```bash
# Scan the current directory
npx @prontiq/ariscan-cli .

# JSON output for CI
npx @prontiq/ariscan-cli . --json

# SARIF output for GitHub Code Scanning
npx @prontiq/ariscan-cli . --format sarif

# Markdown report (includes "Quick Start: Top 3 Actions")
npx @prontiq/ariscan-cli . --format markdown

# With threshold (exit code 1 if score below)
npx @prontiq/ariscan-cli . --threshold 50

# Token budget analysis
npx @prontiq/ariscan-cli . --budget

# Safe fix generation — scaffold a new repo to L3 Capable (61/100)
npx @prontiq/ariscan-cli . --fix --dry-run   # preview changes
npx @prontiq/ariscan-cli . --fix              # apply changes

# Generate badge SVG
npx @prontiq/ariscan-cli . --badge badge.svg

# Export JSON Schema
npx @prontiq/ariscan-cli --json-schema > ariscan.schema.json

# From source (after pnpm build)
pnpm selftest
```

**Exit codes:** `0` = pass, `1` = below threshold, `2` = runtime error.

---

## Scaffold a New Repo to L3 in One Command

Running `--fix` on any project generates up to 15 best-practice files — enough to jump from L2 Fragile (~35) to **L3 Capable (61/100)** in a single pass, even on an empty TypeScript project with just a `package.json` and one source file. (A typical TypeScript project gets 12 files; the remaining 3 are conditional on framework/dependency detection.)

```bash
# Start with a fresh project
mkdir my-project && cd my-project
npm init -y
# Run the scaffold
npx @prontiq/ariscan-cli . --fix
# Verify the score
npx @prontiq/ariscan-cli .
#  → Score: 61/100 — L3 Capable
```

**What gets generated:**

| File | Pillar | Purpose |
|---|---|---|
| `AGENTS.md` | P1 Context | Agent-specific context with build commands, constraints, TODOs |
| `.agentignore` | P1 Context | Excludes high-token, low-value files from agent context |
| `.devcontainer/devcontainer.json` | P4 Environment | Language-appropriate dev container config |
| `tsconfig.json` | P6 Build | Strict TypeScript config (TS projects only) |
| `.nvmrc` | P4 Environment | Pins Node.js version (Node projects only) |
| `.husky/pre-commit` | P8 Security | Pre-commit hooks for lint + typecheck |
| `.github/CODEOWNERS` | P8 Security | Code ownership template |
| `.github/pull_request_template.md` | P8 Security | PR template with AI-Code Review Checklist |
| `docs/decisions/000-template.md` | P5 Docs | ADR template for architecture decisions |
| `CHANGELOG.md` | P5 Docs | Keep-a-Changelog template |
| `providers/storage.provider.ts` | P3 Isolation | DI-ready storage provider skeleton |
| `.env.example` | P5 Docs | Environment variable documentation (when env vars detected) |
| `docker-compose.yml` | P3 Isolation | Service dependencies (when PostgreSQL/Redis/etc. detected) |
| DI wiring example | P3 Isolation | Framework-specific DI example (NestJS, FastAPI, Spring Boot, Go) |
| `.gitleaks.toml` | P8 Security | Secrets scanning config |

All generated files are **additive-only** — existing files are never overwritten. Running `--fix` twice is idempotent. Review the generated files and customize for your project; the TODO comments indicate where project-specific details should be added.

---

## Current Status

The core scanning engine is functional. What's built:

- **@prontiq/ariscan-schema** — Zod schemas for all types (PillarId, MaturityLevel, Finding, PillarResult, ScanResult, ScanConfig, Confidence)
- **@prontiq/ariscan-engine** — All 8 pillar analyzers, composite scoring, security gate, maturity classification, context budget analyzer, `.agentignore` parser, safe `--fix` generators (up to 15 files including AGENTS.md, .agentignore, .devcontainer, tsconfig, .nvmrc, pre-commit hooks, CODEOWNERS, PR template, ADR template, CHANGELOG, docker-compose, .gitleaks.toml, provider skeleton, env var docs, DI wiring examples)
- **@prontiq/ariscan-cli** — Terminal, JSON, SARIF, Markdown output; threshold exit codes; badge generation; JSON Schema export; `--budget` token analysis; `--fix`/`--dry-run` safe file generation
- **841 tests** across 44 test files
- **CI pipeline** — GitHub Actions (lint, typecheck, test, build, self-scan)
- **Test fixtures** — hostile-repo (L1), capable-repo (L3)
- **JSON Schema** — `ariscan.schema.json` in repo root for output validation
- **Dogfooding** — Self-scan: 92/100 (L5 Autonomous)

---

## Versioning Policy

ARI output follows [Semantic Versioning](https://semver.org/). The JSON schema file (`ariscan.schema.json`) and the `--json-schema` flag document the current output contract.

**Two version signals:** Scan output carries two version identifiers with different semantics:

| Signal | Location | Example | Semantics |
|---|---|---|---|
| **Schema URI** | `$schema` / `$id` field | `.../v1.json` | Schema format revision. Bumps only on breaking structural changes (field removals, type changes). Consumers use this to select the correct parser. |
| **Output version** | `metadata.version` | `0.2.0` | Authoritative semver of the scan output contract. Tracks all changes per the table below. **This is the version consumers should target for feature detection.** |

The schema URI uses major-only versioning (`v1`, `v2`, …) as a structural stability contract — any consumer built for `v1.json` can parse all output where `metadata.version` is within the `v1` schema generation. The `metadata.version` field is the precise semver that indicates which optional fields, pillars, and finding codes are available.

| Change Type | Semver Impact | Examples |
|---|---|---|
| **Patch** | `x.y.Z` | Bug fixes in scoring, documentation updates, internal refactors — no change to the JSON output surface |
| **Minor** | `x.Y.0` | Any additive change to the JSON output surface: new fields (required or optional), new finding codes, new pillars |
| **Major** | `X.0.0` | Removing or renaming fields, changing field types, changing score semantics, breaking schema changes |

**Backwards compatibility guarantee:** within a major version, all previously valid JSON output fields remain present with the same types and semantics. Consumers can safely parse ARI output without breaking when patch or minor versions are released. A major version bump in `metadata.version` will coincide with a new schema URI (e.g., `v2.json`).

---

## Documentation

| Document | Purpose |
|---|---|
| [roadmap/ROADMAP.md](./roadmap/ROADMAP.md) | Roadmap phases, deliverables, and exit criteria |
| [milestones/MILESTONES.md](./milestones/MILESTONES.md) | Milestone-level acceptance criteria |
| [rfcs/](./rfcs/) | RFC process and architecture/product decisions |
| [docs/research/](./docs/research/) | Evidence base and calibration references |
| [docs/architecture/](./docs/architecture/) | System architecture overview |
| [CHANGELOG.md](./CHANGELOG.md) | Documentation and roadmap revision history |

---

## Current Program Snapshot

| Track | Status | Target |
|---|---|---|
| P1 — MVP CLI | In Progress | May 2026 |
| P2 — Context intelligence | In Progress | Jul 2026 |
| P3 — Readiness-as-Code | Planned | Sep 2026 |

---

## Product Principles

1. **Evidence over opinion** — scoring must remain research-traceable.
2. **Open-core integrity** — free CLI remains genuinely useful.
3. **Agent agnosticism** — ARI is independent of any single model vendor.
4. **Operational outcomes first** — readiness scores must drive concrete improvements.
5. **Transparent evolution** — rubric and roadmap updates are explicit and versioned.

---

## Packages

| Package | Status | Purpose |
|---|---|---|
| `@prontiq/ariscan-cli` | Built | CLI scan, scoring, reporting, threshold exit codes |
| `@prontiq/ariscan-schema` | Built | Zod schemas for scan results, config, findings |
| `@prontiq/ariscan-engine` | Built | 8-pillar analyzers, composite scoring, security gate |
| `@prontiq/sdk` | Planned | Programmatic integration for reporting/workflow automation |
| `@prontiq/agentignore` | Built (in engine) | `.agentignore` parser — gitignore-compatible patterns, negation, default patterns. Currently in `@prontiq/ariscan-engine`; standalone MIT package planned. |

---

## Contributing

See [roadmap/ROADMAP.md](./roadmap/ROADMAP.md) for the full feature plan. RFCs are in [rfcs/](./rfcs/).

---

## License

Elastic License 2.0 (ELv2) — see [LICENSE](./LICENSE).

Free to use, modify, and redistribute. Cannot be offered as a managed/hosted service or resold.
The planned `@prontiq/agentignore` parser will be MIT-licensed for ecosystem reuse.
