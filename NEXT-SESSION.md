# Next Session Guide

## Session: 2026-03-25
Phase: P3 (cross-phase — all P1/P2 remaining items blocked/deferred)
Checkboxes checked this session: 10 (P3.02 functional items)

### Completed
- **P3.02 — GitHub Action GA (partial):** Composite action implemented with all scripts, documentation, and example workflows. 10/12 functional items checked. Remaining: Marketplace publishing (requires separate repo) and runtime timing verification.

### Ticket Status Changes
- P3.02: todo → in-progress (10/12 functional items done, 2 require external verification)

### In Progress
- **P3.02 — GitHub Action GA:** Two items remain:
  1. Official Marketplace publication — requires creating `prontiq/ariscan-action` repo and copying `action/` contents with `action.yml` at root
  2. Runtime timing verification — needs actual CI run to confirm <3 minute execution
- **P1.18 — Benchmark execution:** Still blocked by sandbox (git clone). Run `pnpm build && bash benchmarks/run.sh && bash benchmarks/generate-results.sh` outside sandbox.
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
- GitHub Action implemented as a composite action (not JavaScript action) — leverages existing npm-published CLI
- Action lives in `action/` directory within this repo; needs separate `prontiq/ariscan-action` repo for Marketplace publication
- Scripts use Node.js built-ins only (fs, process) for zero-dependency portability

### Blockers
- **P3.02 Marketplace publication:** Requires creating `prontiq/ariscan-action` GitHub repo
- **P1.18 execution:** Requires running `bash benchmarks/run.sh` outside Claude Code session (sandbox blocks git clone)

### Next Session Should Start With
1. **Publish P3.02 to Marketplace:** Create `prontiq/ariscan-action` repo, copy action files, publish
2. **Test P3.02 live:** Open a PR using the action, verify comment appears, annotations work, timing is <3 min
3. **Execute P1.18 benchmark** outside sandbox if possible
4. After P1.18 completes, unblock P1.02/P1.03/P1.06 testing items and P2.12

### Roadmap Progress
- P1: ~129/132 done. Remaining: P1.18 functional items (pending execution), blocked telemetry/testing items
- P2: 13/14 done. Remaining: P2.12 blocked on P1.18
- P3: P3.01 done, P3.02 in-progress (10/12 functional). Next: finish P3.02 publication, then P3.04
- CI: 9.67/10 done. CI.10 in-progress (2/3 items checked)
- Selftest: 88/100 (L5 Autonomous) — baseline maintained
