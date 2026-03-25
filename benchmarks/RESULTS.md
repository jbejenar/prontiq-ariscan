# ARI Benchmark Results

> Agent Readiness Index scores for well-known open-source repositories.
>
> **Status:** Infrastructure ready. Run `bash benchmarks/run.sh && bash benchmarks/generate-results.sh` to populate.

## How to Run

```bash
# Build the scanner
pnpm build

# Run benchmark (clones 21 repos, scans each)
bash benchmarks/run.sh

# Generate this results page from scan data
bash benchmarks/generate-results.sh
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

Each repository is scored using the ARI (Agent Readiness Index) rubric, which evaluates 8 pillars:

1. **Agent Context Quality** (15%) - AGENTS.md, CLAUDE.md, .cursorrules quality
2. **Feedback Loop Speed** (15%) - Test/lint/typecheck speed and configuration
3. **Test Isolation** (18%) - Cloud deps, flakiness patterns, ordering issues
4. **Dev Environment** (10%) - Devcontainer, bootstrap scripts, time-to-first-test
5. **Doc Machine-Readability** (10%) - OpenAPI, error taxonomy, env schema
6. **Build Determinism & Type Safety** (15%) - Strict types, lockfiles, build tools
7. **Code Navigability** (12%) - Directory depth, imports, complexity
8. **Security & Governance** (5%) - Branch protection, CODEOWNERS, secrets

### Maturity Levels

| Level | Range | Meaning |
|-------|-------|--------|
| L1 Hostile | 0-25 | Actively blocks AI agents |
| L2 Fragile | 26-45 | Agents struggle significantly |
| L3 Capable | 46-65 | Agents can work with guidance |
| L4 Productive | 66-80 | Agents work effectively |
| L5 Autonomous | 81-100 | Agents can operate independently |

### Reproducibility

Results are reproducible by running:

```bash
pnpm build
bash benchmarks/run.sh
bash benchmarks/generate-results.sh
```

Repos are cloned at the refs specified in `benchmarks/revisions.json`.
The ARI scanner is deterministic: same input produces same scores (no network calls, no randomness, no time-dependent logic).

### Caveats

- Scores reflect the state of each repo at the time of scanning (see commit SHAs in per-repo JSON files).
- ARI measures *agent readiness* — how well a repo supports AI coding agents. It is not a quality or popularity metric.
- Repos without test infrastructure, type checking, or agent context files will score lower, even if they are excellent projects.
- Monorepo scanning analyzes the root-level structure; per-package analysis may vary.
