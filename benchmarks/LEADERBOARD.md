# ARI Open Benchmark Leaderboard

> Agent Readiness Index scores for well-known open-source repositories.
>
> **Scoring version:** 0.2.0 | **Rubric:** v1 | **Generated:** 2026-03-26 | **Repos:** 21

## Leaderboard

| # | Repository | Language | Score | Level | Description |
|---|-----------|----------|-------|-------|-------------|
| 1 | [Next.js](https://github.com/vercel/next.js) | TypeScript | **65** | 🟡 L3 Capable | React framework for production |
| 2 | [Astro](https://github.com/withastro/astro) | TypeScript | **54** | 🟡 L3 Capable | Web framework for content-driven websites |
| 3 | [Vue](https://github.com/vuejs/core) | TypeScript | **50** | 🟠 L2 Fragile | Progressive JavaScript framework |
| 4 | [React](https://github.com/facebook/react) | JavaScript | **48** | 🟡 L3 Capable | React UI library |
| 5 | [Remix](https://github.com/remix-run/remix) | TypeScript | **48** | 🟠 L2 Fragile | Full-stack React framework |
| 6 | [VS Code](https://github.com/microsoft/vscode) | TypeScript | **45** | 🟠 L2 Fragile | Code editor |
| 7 | [Nuxt](https://github.com/nuxt/nuxt) | TypeScript | **43** | 🟠 L2 Fragile | Vue framework |
| 8 | [Hugo](https://github.com/gohugoio/hugo) | Go | **42** | 🟠 L2 Fragile | Static site generator |
| 9 | [LangChain](https://github.com/langchain-ai/langchain) | Python | **42** | 🟠 L2 Fragile | LLM application framework |
| 10 | [FastAPI](https://github.com/fastapi/fastapi) | Python | **37** | 🟠 L2 Fragile | Modern Python web framework |
| 11 | [Flask](https://github.com/pallets/flask) | Python | **36** | 🟠 L2 Fragile | Lightweight Python web framework |
| 12 | [Svelte](https://github.com/sveltejs/svelte) | TypeScript | **36** | 🟠 L2 Fragile | Cybernetically enhanced web apps |
| 13 | [Deno](https://github.com/denoland/deno) | Rust | **35** | 🟠 L2 Fragile | JavaScript/TypeScript runtime |
| 14 | [Gin](https://github.com/gin-gonic/gin) | Go | **34** | 🟠 L2 Fragile | HTTP web framework for Go |
| 15 | [Terraform](https://github.com/hashicorp/terraform) | Go | **33** | 🟠 L2 Fragile | Infrastructure as code |
| 16 | [Django](https://github.com/django/django) | Python | **32** | 🟠 L2 Fragile | Python web framework |
| 17 | [Pydantic](https://github.com/pydantic/pydantic) | Python | **32** | 🟠 L2 Fragile | Data validation using Python type hints |
| 18 | [Express](https://github.com/expressjs/express) | JavaScript | **31** | 🟠 L2 Fragile | Fast web framework for Node.js |
| 19 | [Tokio](https://github.com/tokio-rs/tokio) | Rust | **30** | 🟠 L2 Fragile | Async runtime for Rust |
| 20 | [Spring Boot](https://github.com/spring-projects/spring-boot) | Java | **29** | 🟠 L2 Fragile | Java application framework |
| 21 | [Ripgrep](https://github.com/BurntSushi/ripgrep) | Rust | **28** | 🟠 L2 Fragile | Fast line-oriented search tool |

## Summary Statistics

| Metric | Value |
|--------|-------|
| Repos scanned | 21 |
| Mean score | 40 |
| Median score | 36 |
| Std deviation | 9.3 |
| Range | 28–65 |

### Level Distribution

| Level | Count | % |
|-------|-------|---|
| L2 Fragile | 18 | 86% |
| L3 Capable | 3 | 14% |

### By Language

| Language | Repos | Mean | Median | Range |
|----------|-------|------|--------|-------|
| TypeScript | 7 | 49 | 48 | 36–65 |
| JavaScript | 2 | 40 | 40 | 31–48 |
| Go | 3 | 36 | 34 | 33–42 |
| Python | 5 | 36 | 36 | 32–42 |
| Rust | 3 | 31 | 30 | 28–35 |
| Java | 1 | 29 | 29 | 29–29 |

### By Pillar (Average Across All Repos)

| Pillar | Mean | Median | Range |
|--------|------|--------|-------|
| P1: Agent Context Quality | 47 | 25 | 20–100 |
| P2: Feedback Loop Speed | 42 | 33 | 8–89 |
| P3: Test Isolation | 50 | 50 | 0–75 |
| P4: Dev Environment | 33 | 29 | 0–72 |
| P5: Doc Machine-Readability | 30 | 30 | 0–65 |
| P6: Build Determinism & Type Safety | 33 | 35 | 3–75 |
| P7: Code Navigability | 25 | 30 | 0–55 |
| P8: Security & Governance | 48 | 50 | 15–85 |

## Key Findings

- **No repo reaches L4 (Productive)** — even the best OSS repos lack agent-specific context (AGENTS.md), .agentignore, and dev environment configuration.
- **TypeScript repos lead** (mean: 49) — strong type systems, test infrastructure, and build tooling align with the ARI rubric.
- **Most repos are L2 (Fragile)** — agents can work with these repos but struggle significantly.
- **Agent Context Quality and Dev Environment are the weakest pillars** — very few OSS repos have agent-specific documentation or devcontainer configuration.

## Methodology

See [METHODOLOGY.md](METHODOLOGY.md) for full details on:
- Repo selection criteria
- Scanning process and reproducibility
- Scoring rubric (8 pillars, research-calibrated weights)
- Maturity level definitions
- Caveats and limitations

## Filtering

The machine-readable leaderboard is available at [`leaderboard.json`](leaderboard.json) with full pillar-level data. Filter by:
- **Language:** `entries[].language`
- **Level:** `entries[].level`
- **Score range:** `entries[].score`
- **Pillar scores:** `entries[].pillars.P1.score`, etc.

## How to Run

```bash
# Reproduce the leaderboard from existing benchmark data
node benchmarks/generate-leaderboard.cjs

# Re-scan all repos (requires cloning ~21 repos)
node benchmarks/run-benchmark.cjs
node benchmarks/generate-leaderboard.cjs
```
