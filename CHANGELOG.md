# Changelog

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
