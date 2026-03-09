# Next Session Guide

## Session: 2026-03-09 (fourth session)
**Phase:** P1 — MVP CLI Foundation (nearing completion)
**Self-scan:** 75/100 (L4 Productive) — stable
**Tests:** 334 passing across 13 test files
**Quality gate:** typecheck, lint, test, build — all green
**Roadmap progress:** 154/273 deliverables complete (56%)

## Items Completed This Session
- Navigability (P7): Per-function cognitive complexity with aggregation (ARI-NAV-007) — replaced file-level heuristic with SonarSource-inspired per-function metric. Extracts functions, computes complexity, reports top offenders with good/moderate/poor labels. P1.11 AC#5 complete.
- 5 new tests added for per-function cognitive complexity
- Fixed function extraction bug (overly greedy regex matching const assignments as functions, causing RangeError on self-scan)

## Items Deferred (unchanged from previous session)
- Semantic additionality engine (P1.04): requires NLP/similarity analysis — deferred to P2
- Cross-pillar type bonus (P1.13): designed but not implemented
- SARIF output (P1.14): format in config enum but no formatter
- P1.16 (Badge), P1.17 (--fix), P1.18 (Benchmark): not started — P2 priority
- Cross-agent compatibility report (P1.03): not started

## Key Decisions Made
- Function extraction uses tightened regexes: only matches `function` declarations, arrow functions with `=> {`, and class methods. Avoids false positives from `.filter(`, `.map(`, etc.
- Brace counting skips string literals (single, double, template) and line comments for accuracy
- Safety bounds: max 200 lines per function body, max 50 functions per file, max 2000 scan lines
- Cognitive complexity thresholds: ≤8 good, 9-15 moderate, >15 poor (aligned with SonarSource defaults)

## Next Session Should Start With

### Priority 1: Close remaining P1 gaps
- P1.03 #3: Cross-agent compatibility report (which agents have context files vs none)
- P1.11 AC#2: Explicit threshold labels (good/moderate/poor) in navigability output for all metrics
- P1.11 AC#4: Dead code detection <15% false-positive rate (benchmark validation)

### Priority 2: P1.14 JSON contract items
- Semver impact rules documentation
- CI validation test (output validates against JSON Schema)
- Standalone JSON Schema file published in repo

### Priority 3: P1 polish
- P1.01: Document exit code matrix in `--help`
- P1.15: "First 3 actions" quick-start section in markdown output
- P1.15: Recommendations ordered by impact × ease

### Priority 4: P2 planning
If P1 gaps are sufficiently closed, begin P2 context intelligence:
- P2.01: Context quality generator (additive-only AGENTS.md generation)
- P2.03: .agentignore generator
- P2.04: Context budget analyzer

## Blockers
- None. All quality gates pass.
