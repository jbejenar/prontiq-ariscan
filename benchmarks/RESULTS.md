# ARI Benchmark Results

> Agent Readiness Index scores for well-known open-source repositories.
>
> **Scoring version:** 0.2.0 | **Rubric:** v1 | **Date:** 2026-03-26

## Results

| # | Repository | Language | Score | Level | Description |
|---|-----------|----------|-------|-------|-------------|
| 1 | Next.js | TypeScript | 65 | L3 Capable | React framework for production |
| 2 | Astro | TypeScript | 54 | L3 Capable | Web framework for content-driven websites |
| 3 | Vue | TypeScript | 50 | L2 Fragile | Progressive JavaScript framework |
| 4 | React | JavaScript | 48 | L3 Capable | React UI library |
| 5 | Remix | TypeScript | 48 | L2 Fragile | Full-stack React framework |
| 6 | VS Code | TypeScript | 45 | L2 Fragile | Code editor |
| 7 | Nuxt | TypeScript | 43 | L2 Fragile | Vue framework |
| 8 | LangChain | Python | 42 | L2 Fragile | LLM application framework |
| 9 | Hugo | Go | 42 | L2 Fragile | Static site generator |
| 10 | FastAPI | Python | 37 | L2 Fragile | Modern Python web framework |
| 11 | Flask | Python | 36 | L2 Fragile | Lightweight Python web framework |
| 12 | Svelte | TypeScript | 36 | L2 Fragile | Cybernetically enhanced web apps |
| 13 | Deno | Rust | 35 | L2 Fragile | JavaScript/TypeScript runtime |
| 14 | Gin | Go | 34 | L2 Fragile | HTTP web framework for Go |
| 15 | Terraform | Go | 33 | L2 Fragile | Infrastructure as code |
| 16 | Django | Python | 32 | L2 Fragile | Python web framework |
| 17 | Pydantic | Python | 32 | L2 Fragile | Data validation using Python type hints |
| 18 | Express | JavaScript | 31 | L2 Fragile | Fast web framework for Node.js |
| 19 | Tokio | Rust | 30 | L2 Fragile | Async runtime for Rust |
| 20 | Spring Boot | Java | 29 | L2 Fragile | Java application framework |
| 21 | ripgrep | Rust | 28 | L2 Fragile | Fast line-oriented search tool |

**Summary:** 21 repos scanned. Mean score: 39. Median score: 36. Range: 28–65.

### By Language

| Language | Repos | Mean Score | Range |
|----------|-------|------------|-------|
| TypeScript | 7 | 49 | 36–65 |
| JavaScript | 2 | 40 | 31–48 |
| Python | 5 | 36 | 32–42 |
| Go | 3 | 36 | 33–42 |
| Rust | 3 | 31 | 28–35 |
| Java | 1 | 29 | 29 |

### Key Observations

- **TypeScript repos lead** — strong type systems, test infrastructure, and build tooling align well with the ARI rubric. Next.js (65) is the highest scorer, likely due to comprehensive CI, TypeScript strict mode, and contributor documentation.
- **Most major OSS repos are L2 (Fragile)** — agents can work with these repos but struggle significantly. The biggest gaps are: missing agent context files (AGENTS.md, .cursorrules), lack of .agentignore, and limited dev environment setup.
- **Python repos cluster at 32–42** — LangChain scores highest (42) likely due to its AGENTS.md and AI-aware documentation. Most Python repos lack strict type checking.
- **Rust and Go repos score lower** — despite excellent type safety, they lose points on agent context quality (no AGENTS.md), dev environment (no devcontainer), and documentation machine-readability.
- **No repo reaches L4 (Productive)** — this is expected for repos that weren't specifically optimized for AI agent workflows.

## How to Run

```bash
# Build the scanner
pnpm build

# Run benchmark (clones 21 repos, scans each)
node benchmarks/run-benchmark.cjs

# Or using the bash script
bash benchmarks/run.sh

# Pin refs for reproducibility
node benchmarks/run-benchmark.cjs --pin-refs
```

## Repos Included

21 repositories across 6 languages:

| Language | Repos |
|----------|-------|
| TypeScript | Next.js, Vue, Nuxt, Remix, Astro, Svelte, VS Code |
| JavaScript | React, Express |
| Python | FastAPI, Django, Flask, Pydantic, LangChain |
| Go | Hugo, Terraform, Gin |
| Rust | ripgrep, Tokio, Deno |
| Java | Spring Boot |

## Methodology

### Scoring

Each repository is scored using the ARI (Agent Readiness Index) rubric v1, which evaluates 8 pillars:

1. **Agent Context Quality** (15%) — AGENTS.md, CLAUDE.md, .cursorrules quality
2. **Feedback Loop Speed** (15%) — Test/lint/typecheck speed and configuration
3. **Test Isolation** (18%) — Cloud deps, flakiness patterns, ordering issues
4. **Dev Environment** (10%) — Devcontainer, bootstrap scripts, time-to-first-test
5. **Doc Machine-Readability** (10%) — OpenAPI, error taxonomy, env schema
6. **Build Determinism & Type Safety** (15%) — Strict types, lockfiles, build tools
7. **Code Navigability** (12%) — Directory depth, imports, complexity
8. **Security & Governance** (5% gate) — Branch protection, CODEOWNERS, secrets

### Maturity Levels

| Level | Range | Meaning |
|-------|-------|--------|
| L1 Hostile | 0–25 | Actively blocks AI agents |
| L2 Fragile | 26–45 | Agents struggle significantly |
| L3 Capable | 46–65 | Agents can work with guidance |
| L4 Productive | 66–80 | Agents work effectively |
| L5 Autonomous | 81–100 | Agents can operate independently |

### Reproducibility

Results are reproducible. All refs in `benchmarks/revisions.json` are pinned to specific commit SHAs. The ARI scanner is deterministic: same input produces same scores (no network calls, no randomness, no time-dependent logic).

**Verification:** Three repos (React, FastAPI, Hugo) were re-scanned to confirm identical scores on repeated runs.

### Caveats

- Scores reflect the state of each repo at the time of scanning (2026-03-26). See commit SHAs in `benchmarks/revisions.json`.
- ARI measures *agent readiness* — how well a repo supports AI coding agents. It is not a quality or popularity metric.
- Repos without test infrastructure, type checking, or agent context files will score lower, even if they are excellent projects.
- Monorepo scanning analyzes the root-level structure; per-package analysis may vary.
- The rubric is calibrated on TypeScript; language-specific profiles (P3.06) adjust weights for non-TS repos but the benchmark uses the default rubric for consistent comparison.
