# Next Session Guide

## Session: 2026-03-26
Phase: P1 (completing final items) → P3 active
Checkboxes checked this session: ~8 (P1.18 functional + documentation items)

### Completed
- **P1.18 — Benchmark Cohort v1:** 21 OSS repos scanned across 6 languages (JS, TS, Python, Go, Rust, Java). Scores range 28–65, mean=39, median=36. Results in benchmarks/RESULTS.md with full methodology. Refs pinned to commit SHAs. Reproducibility verified (3 repos re-scanned with identical results).

### Bug Fixes
- Fixed `composite.score` → `score` JSON field mismatch in `benchmarks/run.sh`, `benchmarks/helpers/build-summary.js` (existing scripts referenced wrong JSON path)
- Added `benchmarks/run-benchmark.cjs` as ESM-compatible Node.js alternative to `run.sh` (works in sandboxed environments)
- Fixed express clone failure (branch name `main` → `master`)

### Ticket Status Changes
- P1.18: in-progress → done (all functional + documentation items verified)

### In Progress
- **P3.10 — MCP Server:** Remaining docs/benchmarks/telemetry items (deferred)
- **P3.02 — GitHub Action:** 2 items remain (Marketplace publication, runtime timing)
- **P3.09 — VS Code Extension:** Not started

### Deferred
- P1.02 testing: False-language detection rate — BLOCKED on benchmark execution against 50+ repos (21 done, need more)
- P1.03 testing: Zero false negatives — needs larger benchmark
- P1.06 testing: False-positive rate <10% — needs benchmark analysis
- P1.07: All items deferred to P3.07 (AST analysis)
- P2.12: Blocked on P1.18 (now unblocked — continuous benchmarking can proceed)
- Non-blocking telemetry items across P1.04, P1.17, P2, P3

### Key Decisions
- Replaced Kubernetes subset and Chromium with more manageable repos (Gin for Go, Deno for Rust/multi-language) — Chromium too large for shallow clone
- Express uses `master` branch (not `main`)
- Added run-benchmark.cjs for environments where bash execution is restricted

### Blockers
- P3.02 Marketplace publication requires separate `prontiq/ariscan-action` repo
- P3.09 VS Code Extension requires separate toolchain (vsce, VS Code Extension API)

### Next Session Should Start With
1. **P2.12 (Continuous Benchmarking)** — now unblocked by P1.18 completion
2. **P3.09 (VS Code Extension Preview)** — p2-medium, largest remaining P3 item
3. **P3.02 remaining items** — GitHub Marketplace publication, runtime timing
4. **P1 remaining testing items** — analyze benchmark results for false-positive/false-negative rates

### Roadmap Progress
- P1: ~132/132 done (remaining: blocked/deferred testing items requiring 50+ repo benchmark, non-blocking telemetry)
- P2: 14/15 done. P2.12 now unblocked by P1.18
- P3: P3.01 done, P3.02 in-progress, P3.03 done, P3.04 done, P3.05 in-progress, P3.06 in-progress, P3.07 in-progress, P3.08 in-progress, P3.09 todo, P3.10 in-progress
- P3.5 Scaffolder: S.01–S.11 all done
- CI: 9/10 done (CI.10 needs main push for SARIF alerts)
- Selftest: 85/100 (L5 Autonomous) — baseline maintained
