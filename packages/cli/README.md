# ariscan

> Measure and improve how ready your codebase is for AI coding agents.

**ARI** (Agent Readiness Index) is a composite score (0-100) derived from 8 research-calibrated pillars. Run a single command to get an actionable readiness report.

## Install

```bash
npx ariscan .
```

Or install globally:

```bash
npm install -g ariscan
ariscan .
```

## Usage

```bash
# Scan current directory
ariscan .

# Scan a specific path
ariscan /path/to/repo

# JSON output (for CI pipelines)
ariscan . --json

# Fail CI if score is below threshold
ariscan . --threshold 60

# Markdown report
ariscan . --format markdown

# Generate SVG badge
ariscan . --badge ari-badge.svg
```

## What It Scores

| Pillar | Weight | What It Measures |
|---|---|---|
| Agent Context Quality | 15% | AGENTS.md quality, information additionality |
| Feedback Loop Speed | 15% | Local test/lint/typecheck speed, CI duration |
| Test Isolation | 18% | Cloud credential independence, DI patterns |
| Dev Environment | 10% | Devcontainer, bootstrap scripts |
| Doc Machine-Readability | 10% | OpenAPI schemas, error taxonomy |
| Build Determinism & Type Safety | 15% | Strict mode, lockfiles, reproducible builds |
| Code Navigability | 12% | Module boundaries, import graph, complexity |
| Security & Governance | 5% (gate) | Branch protection, CODEOWNERS, secrets scanning |

## Maturity Levels

| Level | Score | Meaning |
|---|---|---|
| L1 Hostile | 0-25 | Agents thrash and hallucinate |
| L2 Fragile | 26-45 | Simple edits with heavy supervision |
| L3 Capable | 46-65 | Routine tasks with moderate supervision |
| L4 Productive | 66-80 | Multi-file features with light supervision |
| L5 Autonomous | 81-100 | Complex cross-service tasks, self-verified |

Security acts as a **gate**: scoring below 40% on Security & Governance caps the overall level at L2.

## Programmatic API

```ts
import { runScan } from "ariscan";

const result = await runScan({ path: ".", json: true });
```

## Related Packages

- [`@prontiq/schema`](https://www.npmjs.com/package/@prontiq/schema) — Type definitions and Zod schemas
- [`@prontiq/engine`](https://www.npmjs.com/package/@prontiq/engine) — Scoring engine for programmatic use

## License

Elastic License 2.0 (ELv2) — free to use, modify, and redistribute. Cannot be offered as a managed service.
