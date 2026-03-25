# Next Session Guide

## Session: 2026-03-26
Phase: P3 (Language Rubric Profiles)
Checkboxes checked this session: 10 (P3.06 functional + documentation items)

### Completed
- **P3.06 — Language Rubric Profiles (partial):** Core implementation across schema, engine, and CLI.
  - Added `SupportedLanguage` enum to schema (8 languages)
  - Added `language` field to `ScanConfig` and `FileConfig`
  - Added `languageProfile` field to `ScanResult`
  - 8 language profile definitions with per-pillar weight adjustments and rationale
  - Auto-selection from P1.02 language detection with 0.3 minimum confidence
  - Manual override via `--language` CLI flag and `ariscan.yml` `language` field
  - Composite scoring accepts custom weights (language profile + user override merge)
  - 36 unit tests + 15 scoring integration tests
  - Selftest: 86/100 (L5 Autonomous) — baseline maintained

### Ticket Status Changes
- P3.06: todo → in-progress (core functional items done, benchmark/changelog items deferred)

### In Progress
- **P3.06 — Language Rubric Profiles:** Two items remain:
  1. Profile differences documented in changelog
  2. Cross-language score comparability (DEFERRED: needs P1.18 benchmark)
  3. Auto-selection accuracy >95% (DEFERRED: needs P1.18 benchmark)
- **P3.02 — GitHub Action GA:** Two items remain:
  1. Official Marketplace publication — requires creating `prontiq/ariscan-action` repo
  2. Runtime timing verification — needs actual CI run

### Deferred
- P3.06 score comparability: requires P1.18 benchmark cohort
- P3.06 auto-selection accuracy: requires P1.18 benchmark cohort
- P2.18 telemetry: Remediation acceptance rate by archetype
- P2.12: Open Benchmark Leaderboard (blocked on P1.18)
- P1.18: Benchmark execution (blocked by sandbox/npm publish)

### Next Session Should Start With
1. **P3.06 changelog entry** — document profile weight differences
2. **P3.05 (Agent Simulation Hooks)** — next actionable P3 p1-high ticket
3. **P3.08 (Plugin Architecture)** — p2-medium, all deps met
4. **P3.10 (MCP Read-only Server)** — p2-medium, high adoption potential

### Roadmap Progress
- P1: ~129/132 done. Remaining: blocked/deferred items
- P2: 15/15 done. P2.12 blocked on P1.18
- P3: P3.01 done, P3.02 in-progress (10/12), P3.03 done, P3.04 done, P3.06 in-progress (10/13)
- CI: 9.67/10 done
- Selftest: 86/100 (L5 Autonomous) — baseline maintained
