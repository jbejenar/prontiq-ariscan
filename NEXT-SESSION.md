# Next Session Guide

## Session: 2026-03-26
Phase: P2 (completing remaining P2 items)
Checkboxes checked this session: 10 (P2.18 functional + testing items)

### Completed
- **P2.18 — Context-Aware Remediation:** Full implementation across schema, engine, and CLI.
  - Added `BuildSystem` enum and `buildSystems` detection to `DetectionResult` schema
  - New build system detector: Make, Docker Compose, Poetry, Cargo, Go, Maven, Gradle, npm/pnpm/yarn
  - Remediation adapter post-processor rewrites finding descriptions per build tool and archetype
  - Fix generators accept `RepoProfile` and adapt rationale/steps for archetype
  - CLI passes classified profile to `--fix` generators
  - 30 unit tests + 2 integration tests covering all DoD items
  - Selftest: 86/100 (L5 Autonomous) — baseline maintained

### Ticket Status Changes
- P2.18: todo → done (all functional and testing items verified, telemetry deferred)

### In Progress
- **P3.02 — GitHub Action GA:** Two items remain:
  1. Official Marketplace publication — requires creating `prontiq/ariscan-action` repo
  2. Runtime timing verification — needs actual CI run
- **P1.18 — Benchmark execution:** Still blocked by sandbox (git clone)
- **CI.10:** Third checkbox needs verification after merge to main

### Deferred
- P2.18 telemetry: Remediation acceptance rate by archetype (requires --fix usage data)
- P2.17 telemetry: Top 10 finding codes by composite delta (requires telemetry infrastructure)
- P1.01 telemetry: install-to-first-scan time
- P1.02 testing: false-language detection rate (BLOCKED: P1.18)
- P1.02 telemetry: detection accuracy rate (requires P1.18)
- P1.03 testing: zero false negatives on benchmark cohort (BLOCKED: P1.18)
- P1.03 performance: discovery <1s for 100k files (BLOCKED: needs real filesystem benchmark)
- P1.04 telemetry: additionality score distribution
- P1.06 testing: false-positive rate <10% (BLOCKED: P1.18)
- P1.07: all items deferred to P3.07 (AST-level analysis requires Tree-sitter)
- P1.16 telemetry: fix adoption rate
- P3.04 telemetry: pre-commit adoption rate
- CI.08: PR comment with coverage delta

### Next Session Should Start With
1. Review deferred items and roadmap priorities
2. **P2.12** — Open Benchmark Leaderboard (blocked on P1.18 benchmark cohort)
3. **P3.03 (GitLab CI Template)** — next actionable P3 ticket
4. **Publish P3.02 to Marketplace** — create `prontiq/ariscan-action` repo
5. **Execute P1.18 benchmark** outside sandbox if possible

### Roadmap Progress
- P1: ~129/132 done. Remaining: P1.18 functional items, blocked telemetry/testing items, P1.07 deferred to P3.07
- P2: 15/15 done (P2.18 completed this session). Remaining: P2.12 blocked on P1.18
- P3: P3.01 done, P3.02 in-progress (10/12), P3.04 done. Next: P3.03
- CI: 9.67/10 done. CI.10 in-progress (2/3 items checked)
- Selftest: 86/100 (L5 Autonomous) — baseline maintained
