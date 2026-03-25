# Next Session Guide

## Session: 2026-03-25
Phase: P1 (active — P1.18 in-progress, other remaining items blocked/deferred)
Checkboxes checked this session: 4 (P1.18 meta + documentation items)

### Completed
- **P1.18 — Benchmark Cohort v1 (infrastructure):**
  - `benchmarks/revisions.json` — 21 repos across 6 languages (TS, JS, Python, Go, Rust, Java)
  - `benchmarks/run.sh` — automated benchmark runner (clone, scan, collect results)
  - `benchmarks/generate-results.sh` — generates RESULTS.md from summary.json
  - `benchmarks/RESULTS.md` — methodology, caveats, reproducibility docs
  - 4 roadmap checkboxes checked (results page, methodology, rerun script, revisions file)

### Ticket Status Changes
- P1.18: todo → in-progress (infrastructure done, execution pending)

### In Progress
- **P1.18 — Benchmark execution:** Run `bash benchmarks/run.sh && bash benchmarks/generate-results.sh` to clone 21 repos and populate scores. Then check remaining P1.18 functional checkboxes.
- CI.10: Third checkbox (ARI alerts visible in GitHub Security tab) still needs verification after merge to main

### Deferred
- P1.01 telemetry: install-to-first-scan time (external user-experience metric)
- P1.02 testing: false-language detection rate (BLOCKED: P1.18 benchmark cohort)
- P1.02 telemetry: detection accuracy rate (requires P1.18 ground-truth data)
- P1.03 testing: zero false negatives on benchmark cohort (BLOCKED: P1.18)
- P1.03 performance: discovery <1s for 100k files (BLOCKED: needs real filesystem benchmark)
- P1.04 telemetry: additionality score distribution, % repos with redundant files (non-blocking)
- P1.06 testing: false-positive rate <10% (BLOCKED: P1.18 benchmark cohort)
- P1.07: order-sensitive assertion detection (AST-level deferred to P3.07)
- P1.16 telemetry: fix adoption rate, fix types applied (requires fix-mode telemetry)
- CI.08: PR comment with coverage delta (requires external service)

### Key Decisions
- Benchmark infrastructure uses /tmp for repo clones (not inside repo) to avoid bloat
- 21 repos selected covering TS/JS, Python, Go, Rust, Java ecosystems
- Session sandbox blocked git clone and shell redirection; infrastructure was built but execution deferred

### Blockers
- **P1.18 execution:** Requires running `bash benchmarks/run.sh` outside Claude Code session (sandbox blocks git clone to external repos)
- P1 remaining: Most items blocked on P1.18 benchmark results
- P1.07: All 8 functional items require tree-sitter AST analysis (deferred to P3.07)

### Next Session Should Start With
1. **Execute P1.18 benchmark:** Run `pnpm build && bash benchmarks/run.sh && bash benchmarks/generate-results.sh`
2. Check remaining P1.18 functional checkboxes once scores are populated
3. After P1.18 completes, evaluate P1 exit criteria (20+ repos benchmarked gap will be closed)
4. Unblocked items: P1.02/P1.03/P1.06 testing items can use benchmark data
5. P2.12 (Continuous Benchmarking) becomes unblocked

### Roadmap Progress
- P1: ~129/132 done. Remaining: P1.18 functional items (pending execution), blocked telemetry/testing items
- P2: 13/14 done. Remaining: P2.12 blocked on P1.18
- CI: 9.67/10 done. CI.10 in-progress (2/3 items checked)
- Selftest: 88/100 (L5 Autonomous) — baseline maintained
