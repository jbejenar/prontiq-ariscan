# Next Session Guide

## Session: 2026-03-08
**Phase:** P1 — MVP CLI Foundation
**Self-scan:** 66/100 (L4 Productive)
**Tests:** 242 passing across 16 test files
**Quality gate:** typecheck, lint, test, build — all green

## Items Completed This Session
- P1.01 — CLI Scaffold: config file loading (.ariscan.yml), --config flag, help examples
- P1.02 — Language/Framework/Monorepo detection (9 languages, 14 frameworks, 6 monorepo tools)
- P1.15 — Markdown report output (--format markdown)
- Analyzer enhancements across 6 pillars (test-isolation, feedback-loop, dev-environment, security-governance, build-determinism, navigability) — 12 new finding codes added
- Doc fixes (CLAUDE.md, CONTRIBUTING.md filename references)
- Research calibration validation completed

## Items Deferred
- P1.07 — Order-sensitive assertion detection: basic detection added (ARI-TST-009) but AST-level analysis deferred to P3.07
- P1.16 — README Badge: not started (P2 priority)
- P1.17 — Safe --fix: not started (P2 priority)
- P1.18 — Benchmark Cohort: not started (P2 priority)
- Context additionality semantic comparison (P1.04): deferred — requires token-level analysis
- Context budget/redundancy analysis: deferred to P2.04

## Key Decisions Made
- Detection runs BEFORE analyzers so language/framework info is available to scoring
- Detection result stored in optional `detection` field on ScanResult (backwards-compatible)
- Config file format: `.ariscan.yml` with `threshold`, `format`, `pillars.exclude`, `pillars.weights`
- Markdown output uses Unicode block chars for score bars (no emoji dependency)

## Research Calibrator Findings
- Pillar weights: VALID — all traceable to research
- Security gate at 40%: VALID — traced to IEEE-ISTAS 37.6% finding
- Test Isolation at 18%: VALID — strongest evidence base
- Maturity thresholds: UNSUPPORTED — expert judgment, not empirically derived (recommend SWE-bench validation)
- Context Quality heuristics: NEEDS-ADJUSTMENT — missing boilerplate/auto-generation detection (Gloaguen 2026 finding)
- Branch protection check: slightly over-generous (pull_request trigger is too broad)

## Next Session Should Start With
1. **Wire detection into analyzers** — analyzers don't yet use language/framework detection results. The detection data flows into ScanResult but analyzers don't read it.
2. **Complete remaining P1 gaps** — focus on the "partially done" items:
   - P1.03: Context file discovery metadata (size, lastModified, parseStatus)
   - P1.04: Semantic additionality analysis
   - P1.09: Machine-readable docs — runbook detection, drift detection
   - P1.14: JSON output — add languages/frameworks/contextFiles fields
3. **Address research calibrator findings**:
   - Add boilerplate/auto-generation detection to context-quality analyzer
   - Tighten branch protection heuristic
4. **P2 planning** — if P1 gaps are closed, begin P2 context intelligence features

## Blockers
- None currently. All quality gates pass.
