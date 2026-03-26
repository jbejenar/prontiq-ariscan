# ARI Benchmark Methodology

> How the ARI Open Benchmark Leaderboard is produced and maintained.
>
> **Version:** 1.0 | **Rubric version:** v1 | **Last updated:** 2026-03-26

## Repo Selection

Repos are selected to represent a broad cross-section of popular open-source projects:

- **Diversity:** Multiple languages (TypeScript, JavaScript, Python, Go, Rust, Java), frameworks (web, CLI, runtime, infrastructure), and project sizes.
- **Popularity:** Projects with significant community adoption (stars, downloads, active maintenance).
- **No self-selection bias:** Repos are chosen regardless of whether they have agent-specific tooling. Most do not.
- **Pinned refs:** Each repo is scanned at a specific commit SHA recorded in `revisions.json`. This ensures reproducibility — the same commit always produces the same score.

### Current Cohort

21 repositories across 6 languages. Target: 50+ repos at launch, growing to 200+ within 3 months.

## Scanning Process

1. Clone each repo at its pinned commit SHA to a temporary directory.
2. Run `ariscan <path> --json` with default configuration (no overrides, no language profile).
3. Save the full JSON result to `benchmarks/results/<name>.json`.
4. Save scan metadata (commit SHA, timestamp) to `benchmarks/results/<name>.meta.json`.
5. Generate `summary.json` and the leaderboard from per-repo results.

### Reproducibility

The process is fully reproducible:

- **Deterministic scanner:** No network calls, no randomness, no time-dependent logic. Same input → same scores.
- **Pinned refs:** All repos scanned at specific commit SHAs. Re-cloning the same SHA produces identical filesystem state.
- **Scripted pipeline:** `benchmarks/run.sh` or `node benchmarks/run-benchmark.cjs` automate the full pipeline.
- **Verification:** Re-running the leaderboard generator (`node benchmarks/generate-leaderboard.cjs`) on the same result files produces identical output (the `generatedAt` timestamp will differ between runs; all other fields are deterministic).

## Scoring Rubric

Each repo is scored 0–100 using 8 research-calibrated pillars:

| # | Pillar | Weight | What It Measures |
|---|--------|--------|-----------------|
| P1 | Agent Context Quality | 15% | AGENTS.md, .cursorrules, .agentignore quality |
| P2 | Feedback Loop Speed | 15% | Test/lint/typecheck speed and configuration |
| P3 | Test Isolation | 18% | Cloud deps, flakiness patterns, ordering |
| P4 | Dev Environment | 10% | Devcontainer, bootstrap, time-to-first-test |
| P5 | Doc Machine-Readability | 10% | OpenAPI, error taxonomy, env schema |
| P6 | Build Determinism & Type Safety | 15% | Strict types, lockfiles, build tools |
| P7 | Code Navigability | 12% | Directory depth, imports, graph structure |
| P8 | Security & Governance | 5% (gate) | Branch protection, CODEOWNERS, secrets |

**Composite formula:** `sum(pillar_score × pillar_weight)`, clamped to [0, 100].

**Security gate:** P8 score below 40% caps the overall maturity level at L2 regardless of composite score.

### Research Basis

Pillar weights are calibrated from published research:

- **Test Isolation (18%):** Memon et al. (2017): 41% flakiness at Google. Berndt et al. (2026): 63% of LLM-generated flaky tests from unordered collections.
- **Agent Context Quality (15%):** Gloaguen et al. (2026): human-authored context files improve agent success by ~4%.
- **Code Navigability (12%):** arXiv 2601.08773 (2025): AST-derived knowledge graphs achieve 3.4x accuracy over vector RAG.

See RFC-0001 for the full scoring rubric specification.

## Maturity Levels

| Level | Score Range | Meaning |
|-------|-----------|---------|
| L1 Hostile | 0–25 | Actively blocks AI agents |
| L2 Fragile | 26–45 | Agents struggle significantly |
| L3 Capable | 46–65 | Agents can work with guidance |
| L4 Productive | 66–80 | Agents work effectively |
| L5 Autonomous | 81–100 | Agents can operate independently |

## Update Cadence

- **Minimum:** Monthly re-scan of all repos at latest pinned refs.
- **Ad-hoc:** When the rubric version changes (weight adjustments, new findings), all repos are re-scanned for consistency.
- **Expansion:** New repos added as the cohort grows toward 200+.

## Caveats and Limitations

1. **Point-in-time snapshot:** Scores reflect repo state at the pinned commit. Repos evolve.
2. **Not a quality metric:** ARI measures agent readiness, not code quality or popularity.
3. **TypeScript calibration:** The default rubric is calibrated on TypeScript. Language-specific profiles (P3.06) exist but the benchmark uses default weights for consistent cross-language comparison.
4. **Root-level scanning:** Monorepos are analyzed at the root level. Per-package scores may vary.
5. **Static analysis only:** No code execution, no runtime measurement, no network calls.
6. **Cohort size:** Currently 21 repos — insufficient for statistically robust ecosystem-level conclusions. Target: 50+ for meaningful cross-ecosystem comparison.

## Versioning

Leaderboard versions track the rubric version. Scores from different rubric versions are not directly comparable. The `rubricVersion` field in `leaderboard.json` identifies which rubric was used.

When the rubric changes (new pillars, weight adjustments, new findings), all repos are re-scanned to maintain consistency within a leaderboard version.
