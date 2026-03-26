# Next Session Guide

## Session: 2026-03-26
Phase: P3 active
Checkboxes checked this session: 4 (P3.06 auto-selection, P3.09 VS Code Extension, P3.06 score comparability, P3.02 runtime timing)

### Completed
- **P3.06 score comparability:** Per-language calibration offsets normalize composite scores across ecosystems. Calibrated means converge to 34-49 range (from 27-49). 15 new unit tests. All 1086 engine tests pass.
- **P3.02 runtime timing:** Benchmark data verifies median scan 171ms, max 4.5s. Full Action estimated ~100s worst case.
- **P3.06 auto-selection >95%:** Benchmark validation shows 51/53 correct (96.2%, PASS). Build-system authority heuristic (commit 8838f0f) improved accuracy above 95% threshold.
- **P3.09 VS Code Extension Preview:** New `packages/vscode/` with CodeLens, diagnostics, status bar, commands, local report import. 21 unit tests pass.

### Ticket Status Changes
- P3.06: in-progress → done (all functional items complete including score comparability)
- P3.02: in-progress (runtime timing item checked)

### In Progress
- **P3.02 — GitHub Action:** 1 item remains (Marketplace publication requires separate repo)
- **P3.05 — Agent Simulation:** Research docs deferred
- **P3.07 — AST/Graph:** Cross-boundary violations deferred (needs redesign)
- **P3.08 — Plugin Architecture:** Telemetry items only
- **P3.10 — MCP Server:** 3 items deferred (require npm publish)

### Deferred
- P3.02 Marketplace publication — requires separate `prontiq/ariscan-action` repo
- P3.10 MCP items — require npm publish for npx to work
- P3.07 cross-boundary violations — dead code was removed, needs redesign

### Key Decisions
- Calibration offset uses CALIBRATION_FLOOR=25: repos scoring at or below L1 threshold are not calibrated (hostile repos stay hostile regardless of language)
- Calibration offsets derived as ~40% of language-to-TS mean gap — balances ecosystem bias compensation with preserving real readiness differences

### Blockers
- P3.02 Marketplace publication requires separate `prontiq/ariscan-action` repo
- P3.10 MCP integration requires npm publish

### Next Session Should Start With
1. **P3 exit criteria review** — check which exit criteria are met vs remaining
2. **P3.05 research docs** — complete deferred documentation item
3. **P3 remaining telemetry items** — evaluate which telemetry items can be addressed

### Roadmap Progress
- P1: complete (all actionable items done)
- P2: 15/15 done
- P3: P3.01 done, P3.02 in-progress (1 blocked item), P3.03 done, P3.04 done, P3.05 in-progress (docs deferred), P3.06 done, P3.07 in-progress (1 deferred), P3.08 in-progress (telemetry only), P3.09 done, P3.10 in-progress (3 deferred)
- P3.5 Scaffolder: S.01-S.11 all done
- Selftest: 87/100 (L5 Autonomous) — unchanged from baseline
