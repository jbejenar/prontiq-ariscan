# Changelog

## [2.1.0] — 2026-03-08

### Added
- **Language/Framework/Monorepo detection** (P1.02): 9 languages, 14 frameworks, 6 monorepo tools detected automatically before analysis. Results included in ScanResult.
- **Markdown report output** (P1.15): `--format markdown` generates shareable reports with badge header, pillar table, severity-sorted findings, and remediations.
- **Config file loading** (P1.01): `.ariscan.yml` config with directory walk-up discovery, `--config` flag, CLI > config > defaults precedence. FileConfig Zod schema.
- **Analyzer enhancements** across 6 pillars:
  - Test Isolation: filesystem dependency detection (ARI-TST-008), order-sensitive assertion detection (ARI-TST-009), test file ratio check (ARI-TST-010)
  - Feedback Loop: execution time categories (ARI-FBK-005), changeset scope controls (ARI-FBK-006)
  - Dev Environment: doctor/health-check command detection (ARI-ENV-004), seed/fixture data detection
  - Security Governance: AI-specific review checklist detection (ARI-SEC-005), agent scope controls (ARI-SEC-006)
  - Build Determinism: TypeScript projectReferences check, Go `interface{}` abuse (ARI-BLD-004), Rust `unwrap()` abuse (ARI-BLD-005)
  - Navigability: import count analysis (ARI-NAV-004), circular dependency detection (ARI-NAV-005)
- **28 new detection tests** (languages, frameworks, monorepo)
- **New analyzer tests**: navigability (9), dev-environment (13), plus 28 new tests across existing analyzer test files
- **CLI help examples**: 3 usage examples in `--help` output

### Changed
- Test suite expanded from 141 to 242 tests across 16 test files
- Self-scan score improved from 64 (L3) to 66 (L4 Productive)

### Fixed
- CLAUDE.md: corrected `pillars.ts` → `pillar.ts` filename reference
- CONTRIBUTING.md: corrected clone URL and `pillars.ts` → `pillar.ts` filename reference

## [2.0.0] — 2026-03-08

### Added
- **@prontiq/schema:** Zod schemas for all core types — PillarId, MaturityLevel, Finding, PillarResult, ScanResult, ScanConfig
- **@prontiq/engine:** All 8 pillar analyzers (context quality, feedback loop, test isolation, dev environment, doc machine-readability, build determinism/type safety, code navigability, security/governance), composite scoring with research-calibrated weights, security gate (P8 < 40% caps at L2), maturity level classification (L1-L5)
- **ariscan CLI:** Terminal and JSON output formats, threshold-based exit codes, error handling
- **Test suite:** 141 tests across 10 test files covering schemas, analyzers, scoring, and CLI
- **Dogfooding artifacts:** AGENTS.md, CLAUDE.md, .agentignore, devcontainer configuration, CONTRIBUTING.md, SECURITY.md, CODEOWNERS
- **CI pipeline:** GitHub Actions workflow for lint, typecheck, test, build, and self-scan
- **Test fixtures:** hostile-repo (L1 baseline) and capable-repo (L3 baseline) for regression testing

## [1.2.0] — 2026-03-07

### Added
- RFC-0003: Tech Stack & AI-First Architecture for `ariscan` — defines CLI stack (Node.js 22, TypeScript strict, pnpm, Turborepo, citty, Tree-sitter WASM, Zod, Vitest, tsup) and AI-first patterns extracted from ripple-next reference architecture
- Architecture overview updated with refined tech stack tables, AI-first pattern matrix, ripple-next reference
- Roadmap updated: tech stack decision section in P1, `ARI-*` error taxonomy references in P1.01/P1.14, provider pattern in P3.08, Tree-sitter WASM in P3.07, pure function core in P3.10, `@prontiq/ai-first-toolkit` in P4

### Changed
- Architecture overview tech stack section now references RFC-0003 and ripple-next patterns
- P1.01 now includes tech stack specification and AI-first pattern requirements
- P1.14 JSON output now specifies Zod schema generation and `ARI-*` taxonomy integration

## [1.1.0] — 2026-03-07

### Added
- Milestones expanded with full acceptance criteria, success metrics, and risk registers
- Architecture overview expanded with detailed repository boundaries, data flows, security architecture, and package dependency graph
- Competitive landscape expanded with strategic analysis, emerging threat assessments, market timing, and win/loss framework
- RFC-0002: .agentignore file specification v1 (syntax, categories, scoring impact, default templates)
- Evidence base expanded with methodology section, confidence grading, per-pillar product implications, known limits, and research gap backlog

## [1.0.0] — 2026-03-06

### Added
- Initial roadmap structure
- VISION.md — platform thesis and ARI score definition
- Roadmap phases, deliverables, and exit criteria
- Milestones with acceptance criteria
- Architecture overview with system diagram and tech stack
- Competitive landscape analysis
- RFC template and RFC-0001 (ARI Scoring Rubric v1)
- Research evidence base with 28 key papers

### Research Foundation
- Three independent research sweeps across 80+ papers
- Evidence-based pillar weights calibrated against empirical data
- Test Isolation elevated to 18% weight (flakiness transfer research)
- Build Determinism elevated to 15% weight (type system convergence)
- Security gate behaviour grounded in IEEE-ISTAS iterative degradation
