# Next Session Guide

## Session: 2026-03-26
Phase: P3 active
Checkboxes checked this session: 2 (P3.06 auto-selection, P3.09 VS Code Extension)

### Completed
- **P3.06 auto-selection >95%:** Benchmark validation shows 51/53 correct (96.2%, PASS). Build-system authority heuristic (commit 8838f0f) improved accuracy above 95% threshold. Remaining 2 mismatches (deno, swc) use stale scan results from before the heuristic.
- **P3.09 VS Code Extension Preview:** New `packages/vscode/` with CodeLens, diagnostics, status bar, commands, local report import. 21 unit tests pass. esbuild bundle. No network dependency.

### Ticket Status Changes
- P3.06: in-progress (auto-selection item checked, score comparability still open)
- P3.09: todo → done (all functional items complete)

### In Progress
- **P3.06 — Language Profiles:** Auto-selection now 96.2% (target met). Score comparability across languages not yet achieved — score ranges still vary significantly by ecosystem.
- **P3.02 — GitHub Action:** 2 items remain (Marketplace publication requires separate repo, runtime timing)
- **P3.05 — Agent Simulation:** Research docs deferred
- **P3.07 — AST/Graph:** Cross-boundary violations deferred (needs redesign)
- **P3.08 — Plugin Architecture:** Telemetry items only
- **P3.10 — MCP Server:** 3 items deferred (require npm publish)

### Deferred
- P3.06 score comparability — score ranges vary by ecosystem (TS 33-65, Python 30-42, Go 28-37); needs further calibration
- P3.02 Marketplace publication — requires separate `prontiq/ariscan-action` repo
- P3.10 MCP items — require npm publish for npx to work
- P3.07 cross-boundary violations — dead code was removed, needs redesign

### Key Decisions
- VS Code extension is a standalone package (no engine/schema dependency) — reads JSON reports only
- Extension uses esbuild (CJS output for VS Code compatibility) rather than tsup

### Blockers
- P3.02 Marketplace publication requires separate `prontiq/ariscan-action` repo
- P3.10 MCP integration requires npm publish

### Next Session Should Start With
1. **P3.06 score comparability** — investigate calibration of language profiles to make scores comparable across ecosystems at the same maturity level
2. **P3.02 GitHub Action** — complete remaining items (runtime timing benchmark)
3. **P3 exit criteria review** — check which exit criteria are met vs remaining

### Roadmap Progress
- P1: complete (all actionable items done)
- P2: 15/15 done
- P3: P3.01 done, P3.02 in-progress (2 items), P3.03 done, P3.04 done, P3.05 in-progress (docs deferred), P3.06 in-progress (1 item), P3.07 in-progress (1 deferred), P3.08 in-progress (telemetry only), P3.09 done, P3.10 in-progress (3 deferred)
- P3.5 Scaffolder: S.01–S.11 all done
- Selftest: 87/100 (L5 Autonomous) — unchanged from baseline
