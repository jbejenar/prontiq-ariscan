# Next Session Guide

## Session: 2026-03-25
Phase: P1 (active — all remaining items blocked/deferred; cross-phase to P3 justified)
Checkboxes checked this session: 0 (governance only: P3.01 status → done)

### Completed
- **P3.01 ticket closure:** All functional items verified complete (except deferred path-specific rules). Status updated from `in-progress` to `done`, completed date set to 2026-03-25.
- **P1.18 benchmark execution attempt:** Confirmed sandbox blocks git clone to external repos. P1.18 execution remains blocked.

### Ticket Status Changes
- P3.01: in-progress → done (all functional items complete; path-specific rules deferred to future work)

### In Progress
- **P1.18 — Benchmark execution:** Infrastructure ready (run.sh, revisions.json, RESULTS.md). Requires running `bash benchmarks/run.sh && bash benchmarks/generate-results.sh` outside sandbox.
- **CI.10:** Third checkbox (ARI alerts visible in GitHub Security tab) needs verification after merge to main.

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
- P1.18 benchmark execution confirmed blocked by Claude Code sandbox (git clone to external repos not permitted)
- P3.01 marked done — all functional items complete, path-specific rules remain deferred
- Cross-phase work justified: all P1/P2 remaining items are blocked or deferred

### Blockers
- **P1.18 execution:** Requires running `bash benchmarks/run.sh` outside Claude Code session (sandbox blocks git clone)
- **P1 remaining:** All items blocked on P1.18 benchmark results or deferred
- **P1.07:** All 8 functional items require tree-sitter AST analysis (deferred to P3.07)

### Next Session Should Start With
1. **Execute P1.18 benchmark** outside sandbox: `pnpm build && bash benchmarks/run.sh && bash benchmarks/generate-results.sh`
2. Check remaining P1.18 functional checkboxes once scores are populated
3. After P1.18 completes, evaluate P1 exit criteria (20+ repos benchmarked gap will be closed)
4. Unblocked items: P1.02/P1.03/P1.06 testing items can use benchmark data
5. P2.12 (Continuous Benchmarking) becomes unblocked
6. **P3.02 (GitHub Action GA)** is now unblocked (P3.01 done, P1.14 done) — next p0-critical item

### Roadmap Progress
- P1: ~129/132 done. Remaining: P1.18 functional items (pending execution), blocked telemetry/testing items
- P2: 13/14 done. Remaining: P2.12 blocked on P1.18
- P3: P3.01 done. Next: P3.02 (GitHub Action GA, p0-critical, unblocked)
- CI: 9.67/10 done. CI.10 in-progress (2/3 items checked)
- Selftest: 88/100 (L5 Autonomous) — baseline maintained
