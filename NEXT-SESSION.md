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

### Blocked/Deferred Audit (2026-03-26)

**Now ACTIONABLE (P1.18 unblocked these):**
- P3.06 cross-language score comparison — P1.18 cohort has 21 repos across 6 languages, sufficient for L3 comparison
- P3.06 auto-selection accuracy >95% — testable against 21 benchmark repos
- P3.07 analysis <30s benchmark — P1.18 cohort includes large repos (VS Code, Spring Boot)
- P2.12 continuous benchmarking — fully unblocked by P1.18 completion
- P1.03 testing: Zero false negatives — can analyze against P1.18 benchmark results

**Still BLOCKED (genuine external blockers):**
- P1.02 testing: False-language detection rate <5% on 50+ repos — cohort has 21 repos, needs expansion (NOT npm publishing)
- P1.03 discovery <1s for 100k files — needs end-to-end filesystem fixture benchmark (not P1.18 data)
- P1.07: All items — genuinely blocked on P3.07 AST/Tree-sitter integration
- P3.10 MCP items requiring npm publish — genuinely external
- P3.02 Marketplace publication — requires separate repo

**Still DEFERRED (infrastructure not available):**
- P1.02 detection accuracy rate — needs manually-labelled ground-truth data
- All telemetry items requiring server-side infrastructure (P1.04, P1.17, P2, P3 telemetry)
- All --fix mode telemetry items — requires fix-mode telemetry integration
- Scaffolder items requiring npm publish (lockfile, ariscan dependency)

### Key Decisions
- Replaced Kubernetes subset and Chromium with more manageable repos (Gin for Go, Deno for Rust/multi-language) — Chromium too large for shallow clone
- Express uses `master` branch (not `main`)
- Added run-benchmark.cjs for environments where bash execution is restricted

### Blockers
- P3.02 Marketplace publication requires separate `prontiq/ariscan-action` repo
- P3.09 VS Code Extension requires separate toolchain (vsce, VS Code Extension API)

### Next Session Should Start With
1. **P2.12 (Continuous Benchmarking)** — fully unblocked by P1.18 completion
2. **P3.06 cross-language validation** — use P1.18 cohort to verify score comparability and auto-selection accuracy
3. **P3.07 analysis <30s benchmark** — use P1.18 large repos to verify performance
4. **P1.03 false-negative analysis** — analyze P1.18 benchmark results for context file discovery gaps
5. **P3.09 (VS Code Extension Preview)** — p2-medium, largest remaining P3 item
6. **P3.02 remaining items** — GitHub Marketplace publication, runtime timing

### Roadmap Progress
- P1: ~132/132 done (remaining: blocked/deferred testing items requiring 50+ repo benchmark, non-blocking telemetry)
- P2: 14/15 done. P2.12 now unblocked by P1.18
- P3: P3.01 done, P3.02 in-progress, P3.03 done, P3.04 done, P3.05 in-progress, P3.06 in-progress, P3.07 in-progress, P3.08 in-progress, P3.09 todo, P3.10 in-progress
- P3.5 Scaffolder: S.01–S.11 all done
- CI: 9/10 done (CI.10 needs main push for SARIF alerts)
- Selftest: 85/100 (L5 Autonomous) — baseline maintained
