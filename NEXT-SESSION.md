# Next Session Guide

## Session: 2026-03-26
Phase: P3 (Agent Simulation Hooks + Language Rubric Profiles)
Checkboxes checked this session: 9 (P3.05 functional items) + 1 (P3.06 changelog)

### Completed
- **P3.06 — Language Rubric Profiles (changelog):** Documented all 8 language profile weight differences in CHANGELOG.md [3.20.0]
- **P3.05 — Agent Simulation Hooks (core functional):** Full implementation of `ariscan simulate` command:
  - Schema types: SimulationResult, SimulationStepResult, SimulationProfile, PredictionComparison, IsolationMode
  - Engine: NativeExecutor, DockerExecutor, step runner with timeout, command detection, static vs simulation comparison
  - CLI: simulate subcommand with --isolation, --json, --timeout, --steps, --compare flags
  - 21 new tests (runner: 9, comparison: 9, docker: 3)
  - Selftest: 86/100 (L5 Autonomous) — baseline maintained

### Ticket Status Changes
- P3.05: todo → in-progress (8/8 functional items checked, docs/telemetry remain)
- P3.06: in-progress → in-progress (11/13 items checked — changelog done, 2 DEFERRED items remain)

### In Progress
- **P3.05 — Agent Simulation Hooks:** Remaining items:
  1. Research basis documentation (DEFERRED)
  2. Telemetry items (non-blocking)
- **P3.06 — Language Rubric Profiles:** Remaining DEFERRED items:
  1. Cross-language score comparability (needs P1.18 benchmark)
  2. Auto-selection accuracy >95% (needs P1.18 benchmark)
- **P3.02 — GitHub Action GA:** Two items remain (Marketplace publication, runtime timing)

### Deferred
- P3.05 research documentation: deferred for documentation pass
- P3.05 telemetry: non-blocking
- P3.06 score comparability: requires P1.18 benchmark cohort
- P3.06 auto-selection accuracy: requires P1.18 benchmark cohort
- P2.18 telemetry: Remediation acceptance rate by archetype
- P2.12: Open Benchmark Leaderboard (blocked on P1.18)
- P1.18: Benchmark execution (blocked by sandbox/npm publish)

### Next Session Should Start With
1. **P3.07 (AST/Graph Navigability Analysis)** — p1-high, Tree-sitter WASM-based analysis
2. **P3.08 (Plugin Architecture)** — p2-medium, extension API for community checks
3. **P3.10 (MCP Read-only Server)** — p2-medium, high adoption potential
4. **P3.05 research documentation** — if doing a docs pass

### Roadmap Progress
- P1: ~129/132 done. Remaining: blocked/deferred items
- P2: 15/15 done. P2.12 blocked on P1.18
- P3: P3.01 done, P3.02 in-progress (10/12), P3.03 done, P3.04 done, P3.05 in-progress (8/9 non-telemetry), P3.06 in-progress (11/13)
- CI: 9.67/10 done
- Selftest: 86/100 (L5 Autonomous) — baseline maintained
