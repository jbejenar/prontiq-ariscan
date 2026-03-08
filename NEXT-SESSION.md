# Next Session Guide

## Session: 2026-03-09
**Phase:** P1 — MVP CLI Foundation (nearing completion)
**Self-scan:** 62/100 (L3 Capable) — score dropped from 66 due to more rigorous checks revealing real gaps
**Tests:** 370 passing across 19 test files
**Quality gate:** typecheck, lint, test, build — all green

## Items Completed This Session
- Schema: ContextFileInfo, PillarStatus, EstimatedImpact types; $schema/$id fields; formatJsonSchema()
- P1 (Context Quality): 4 new findings (ARI-CTX-005 through 008) — front-loading, staleness, boilerplate, conciseness
- P2 (Feedback Loop): 3 new findings (ARI-FBK-007 through 009) — watch mode, incremental build, estimated latency; 2x/1x local/CI weighting
- P3 (Test Isolation): 4 new findings (ARI-TST-011 through 014) — mutable globals, order dependency, concurrency, hardcoded credentials; Luo 2014 taxonomy
- P4 (Dev Environment): 8 new findings (ARI-ENV-005 through 012) — devcontainer validation, first-run blockers, env var completeness, per-criterion status
- P5 (Doc Readability): 3 new findings (ARI-DOC-002 through 004) — runbooks, JSDoc coverage, drift detection
- P6 (Build Determinism): 2 new findings (ARI-BLD-006, 007) — monorepo project refs, lockfile drift
- P7 (Navigability): 2 new findings (ARI-NAV-006, 007) — dead code, cognitive complexity; "most costly paths" summary
- P8 (Security): 1 new finding (ARI-SEC-007) — licence compliance; configuration status labels; tightened branch protection
- Research calibrator findings addressed: boilerplate detection + branch protection heuristic

## Items Deferred
- Semantic additionality engine (P1.04): requires NLP/similarity analysis — deferred to P2
- Code duplication / clone detection (P1.11): not yet attempted
- Cross-pillar type bonus (P1.13): designed but not implemented
- SARIF output (P1.14): format in config enum but no formatter
- Per-function cognitive complexity (P1.11): file-level estimate only, not per-function with aggregation
- P1.16 (Badge), P1.17 (--fix), P1.18 (Benchmark): not started — P2 priority

## Key Decisions Made
- Self-scan score decrease (66 to 62) is expected: stricter checks expose real gaps
- Local feedback signals weighted 2x vs CI signals (per DORA research)
- Luo 2014 root cause taxonomy added as evidence fields on all test isolation findings
- Security summary now uses configured/partial/missing status labels instead of binary present/absent
- ContextFileInfo tracks path, type, size, lineCount (not lastModified — would require git/stat calls)

## Next Session Should Start With

### Priority 1: Wire --json-schema CLI flag
The `formatJsonSchema()` function exists but no CLI flag is wired. Quick win.

### Priority 2: Address self-scan score regression
The ariscan repo itself dropped to 62/100. Improve the repo to recover score:
- Add `.env.example` (even if minimal) to satisfy ARI-ENV-006/007
- Add pre-commit hooks (husky) to improve P2 score
- Review P3 false positives from test fixture files

### Priority 3: Close remaining P1 gaps
Focus on the items that are partially done but close to completion:
- P1.03: Add lastModified and parseStatus to ContextFileInfo (requires fs.stat calls)
- P1.06: Add code example fix hints and agent impact explanations to test isolation findings
- P1.11: Per-function cognitive complexity aggregation (currently file-level only)

### Priority 4: P2 planning
If P1 gaps are sufficiently closed, begin P2 context intelligence:
- P2.01: Context quality generator (additive-only AGENTS.md generation)
- P2.02: `audit agents-md` command
- Semantic additionality engine (deferred from P1.04)

## Blockers
- None. All quality gates pass.
