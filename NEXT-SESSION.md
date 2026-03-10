# Next Session Guide

## Session: 2026-03-10 (tenth session)
**Phase:** P2 — Context Intelligence (continued)
**Self-scan:** 76/100 (L4 Productive) — holding steady
**Tests:** 518 passing across 19 test files (450 engine + 68 CLI)
**Quality gate:** typecheck, lint, test, build — all green
**Roadmap progress:** 6 items shipped this session

## Items Completed This Session
- Engine (P2.09): Confidence weighting expanded to all 8 analyzers — context-quality, feedback-loop, test-isolation, dev-environment, security-governance, navigability now annotated (was only build-determinism + doc-readability)
- Engine (P2.08): Security governance remediation hints — framework-specific code snippets for all 7 security findings (CODEOWNERS, SECURITY.md, gitleaks, dependabot, PR template, .agentignore, license-checker)
- Engine (P2.10): Flakiness transfer risk signals — ARI-TST-015 detects agent-propagated anti-patterns (shared mutable state, sleep-based sync, network calls in tests)
- Engine (P2.11): Change-scope heuristics — ARI-FBK-010 detects PR size limits, conventional commits, package boundaries, breaking change detection
- Engine (P1.06 AC#3): Rust cargo test coverage — test-isolation analyzer now detects `#[cfg(test)]` and `#[test]` attributes in `.rs` files
- Engine (P1.17): Provider pattern skeleton — `--fix` generates StorageProvider interface + InMemoryStorageProvider for TypeScript/Python/Go with cloud SDK detection

## Items Deferred
- P2.01: Context quality generator (requires semantic deduplication — NLP analysis, deferred)
- P2.02: `audit agents-md` command (depends on P1.04 additionality scoring)
- P2.03: Context delta viewer (depends on P2.02)
- P1.04: Semantic additionality engine (requires NLP/similarity analysis — deferred to P2)
- P1.07: AST-level order-sensitive assertion detection (deferred to P3.07)
- P1.18: Benchmark cohort v1 (requires npm publishing)
- Confidence-adjusted composite score (`--confidence-adjusted` flag) — deferred, needs UX design

## Next Session Should Start With

### Priority 1: Performance & large-repo testing
- P1.01 AC#4: 100k file performance test (ensure <30s scan time)
- P1.01 AC#5: Streaming output for large repos

### Priority 2: Remaining P2 items
- P2.01: Context quality generator (semantic deduplication)
- P2.06: Agent behaviour simulation test harness
- P2.07: Context budget optimization recommendations

### Priority 3: Polish & DX
- Confidence-adjusted composite score (`--confidence-adjusted` flag)
- P1.04: Semantic additionality engine
- P1.18: Benchmark cohort v1

## Blockers
- None. All quality gates pass.
