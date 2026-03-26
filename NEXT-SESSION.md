# Next Session Guide

## Session: 2026-03-26
Phase: P1 (complete) → P2 (nearly complete) → P3 active
Checkboxes checked this session: 9 (P1.06 testing, P2.12 ×7, P3.07 performance)

### Completed
- **P1.06 testing: False-positive rate <10%** — `node benchmarks/validate-test-isolation.cjs` validates 82 P3 findings across 21 repos. FP rate: 3.7% (3/82). All 3 FPs are ripgrep ARI-TST-008 on non-test files (Rust inline test modules). Ticket P1.06 now `done`.
- **P2.12: Open Benchmark Leaderboard** (7/8 items) — `benchmarks/generate-leaderboard.cjs` produces ranked leaderboard with language/level filtering, summary statistics, per-pillar breakdowns. Methodology documented in `benchmarks/METHODOLOGY.md`. Reproducibility verified.
- **P3.07: Performance <30s** — VS Code: 719ms, Spring Boot: 699ms. Well under 30s threshold.

### Ticket Status Changes
- P1.06: in-progress → done (FP validation passed)
- P2.12: todo → in-progress (7/8 functional items done, 50+ repos remaining)
- P3.07: performance checkbox completed

### In Progress
- **P2.12 — 50+ repos:** Current cohort has 21 repos. Need 50+ for full DoD. Requires expanding `revisions.json` with more repos.
- **P3.06 — Language Profiles:** Auto-selection accuracy at 90.5% (target 95%). Score comparability across languages not yet achieved.
- **P3.02 — GitHub Action:** 2 items remain (Marketplace publication, runtime timing)
- **P3.09 — VS Code Extension:** Not started

### Deferred
- P1.02 false-language detection rate <5% on 50+ repos — cohort has 21 repos, needs expansion
- P1.03 discovery <1s for 100k files — needs end-to-end filesystem benchmark
- P1.07 all items — blocked on P3.07 AST/Tree-sitter integration
- All telemetry items requiring server-side infrastructure

### Discovered
- Leaderboard JSON format (`leaderboard.json`) provides full pillar-level data for downstream consumers

### Key Decisions
- Leaderboard uses default rubric weights (not language profiles) for consistent cross-language comparison
- Methodology versioning: scores only comparable within same rubric version

### Blockers
- P2.12 cohort expansion (21 → 50+) is a separate effort — need to identify and add 29+ more repos
- P3.06 auto-selection accuracy needs multi-language detection improvement
- P3.02 Marketplace publication requires separate `prontiq/ariscan-action` repo
- P3.09 VS Code Extension requires separate toolchain

### Next Session Should Start With
1. **P2.12 cohort expansion** — add 29+ repos to reach 50+ for leaderboard launch criterion. Expand revisions.json, run benchmarks, regenerate leaderboard.
2. **P3.06 multi-language detection** — improve auto-selection for repos with multiple significant languages (svelte, deno)
3. **P3.09 (VS Code Extension Preview)** — p2-medium, largest remaining P3 item
4. **P3.02 GitHub Action** — complete remaining items

### Roadmap Progress
- P1: ~132/132 done (all actionable items complete; remaining are BLOCKED/DEFERRED/telemetry)
- P2: 14/15 done. P2.12 in-progress (7/8 items, needs cohort expansion)
- P3: P3.01 done, P3.02 in-progress (2 items), P3.03 done, P3.04 done, P3.05 done, P3.06 in-progress, P3.07 in-progress (performance done, cross-boundary deferred), P3.08 in-progress, P3.09 todo, P3.10 in-progress
- P3.5 Scaffolder: S.01–S.11 all done
- CI: 9/10 done
- Selftest: 85/100 (L5 Autonomous) baseline
