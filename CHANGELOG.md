# Changelog

## [2.5.0] — 2026-03-09

### Added
- **Navigability (P7):** Per-function cognitive complexity with aggregation (ARI-NAV-007) — replaces file-level heuristic with SonarSource-inspired per-function metric. Extracts functions via brace-matching (handles function declarations, arrow functions, class methods), computes complexity from control flow nesting depth, boolean operators, and ternaries. Reports top offenders with good/moderate/poor labels. (P1.11 AC#5)

### Changed
- ARI-NAV-007 severity upgraded: `high` for functions with complexity >15, `medium` for >3 moderate-complexity functions. Includes research evidence citation.
- Function extraction is robust against string literals, comments, and large files (max 200 lines per function body, max 50 functions per file, max 2000 scan lines).
- Self-scan score: 75/100 (L4 Productive) — no regression
- Tests: 334 passing across 13 test files (+5 new per-function complexity tests)
- Roadmap: P1.11 AC#5 complete

## [2.4.0] — 2026-03-09

### Added
- **Navigability (P7):** Code duplication / clone detection (ARI-NAV-008) — uses normalized line-chunk hashing to detect near-duplicate code blocks across source files. Thresholds tuned to avoid false positives from interface-following patterns. (P1.11 deliverable #6)
- **Context Quality (P1):** Non-parsable context file warnings (ARI-CTX-009) — validates JSON parse, YAML emptiness/mixed indentation, and empty file detection. Reduces score -5 per invalid file. (P1.03 acceptance criterion #2)

### Changed
- Self-scan score: 75/100 (L4 Productive) — down from 77 due to new duplication detector revealing structural similarity across analyzer files (expected: new rigorous checks surface previously invisible gaps)
- Tests: 329 passing across 13 test files (+9 new tests)
- Roadmap progress: 153/273 deliverables complete (56%)

## [2.3.0] — 2026-03-09

### Added
- **CLI:** `--jsonSchema` flag — outputs the JSON Schema for scan output and exits without scanning (P1.14)
- **Schema:** `ParseStatus` enum (valid/warning/error), `lastModified` and `parseStatus` fields on `ContextFileInfo` (P1.03)
- **Test Isolation (P3):** Code example fix hints and agent impact explanations on all 14 findings (ARI-TST-001 through ARI-TST-014)
- **Dogfooding:** `.env.example` file for dev environment onboarding

### Changed
- Context file discovery now populates `lastModified` (from `fs.stat`) and `parseStatus` (content validation) for each discovered file
- JSON Schema output (`formatJsonSchema()`) includes the new `lastModified` and `parseStatus` fields

### Metrics
- **Self-scan score:** 76/100 (L4 Productive) — up from 62 (L3 Capable)
- **Tests:** 375 passing across 15 test files
- **Roadmap progress:** 151/273 deliverables complete (55%)

## [2.2.0] — 2026-03-09

### Added
- **Schema enhancements:** `ContextFileInfo` type (path, type, size, lineCount), `PillarStatus` enum with `scoreToStatus()` helper, `EstimatedImpact` enum type, `$schema`/`$id` fields on JSON output, `formatJsonSchema()` function
- **Context Quality (P1):** 4 new findings — front-loading analysis (ARI-CTX-005), staleness detection (ARI-CTX-006), boilerplate/auto-generation detection (ARI-CTX-007), conciseness check (ARI-CTX-008). MCP config discovery (`.mcp.json`, `mcp.config.js`), `.claude/settings.json` and `.claude/commands/` discovery, nested AGENTS.md discovery for monorepos, file metadata tracking (size, lineCount)
- **Feedback Loop (P2):** 3 new findings — watch mode (ARI-FBK-007), incremental build (ARI-FBK-008), estimated feedback latency with confidence labels (ARI-FBK-009). Restructured scoring with local signals 2x weight, CI signals 1x weight
- **Test Isolation (P3):** 4 new findings — mutable global environment (ARI-TST-011), test order dependency (ARI-TST-012), concurrency/race conditions (ARI-TST-013), hardcoded credentials (ARI-TST-014). Luo 2014 root cause taxonomy evidence fields on all findings. Critical severity level added
- **Dev Environment (P4):** 8 new findings — devcontainer validation (ARI-ENV-005), first-run blockers (ARI-ENV-006), env var completeness (ARI-ENV-007), per-criterion status labels (ARI-ENV-008 through ARI-ENV-012)
- **Doc Readability (P5):** 3 new findings — machine-readable runbook detection (ARI-DOC-002), JSDoc coverage (ARI-DOC-003), documentation-code drift detection (ARI-DOC-004)
- **Build Determinism (P6):** 2 new findings — monorepo project references (ARI-BLD-006), lockfile drift detection (ARI-BLD-007)
- **Navigability (P7):** 2 new findings — dead code detection heuristic (ARI-NAV-006), cognitive complexity estimate (ARI-NAV-007). "Most costly navigation paths" summary added
- **Security (P8):** 1 new finding — license compliance tooling check (ARI-SEC-007). Configuration status labels (configured/partial/missing) in summary
- **New test file:** `doc-readability.test.ts` (14 tests)

### Changed
- Test suite expanded from 242 to 370 tests across 19 test files
- Self-scan score changed from 66 (L4) to 62 (L3) — expected: new rigorous checks reveal previously invisible gaps
- Security: tightened branch protection heuristic (pull_request trigger alone no longer counts)
- Security: summary shows configuration status labels instead of binary present/absent

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
