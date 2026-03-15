# Next Session Guide

## Session: 2026-03-15 (sixteenth session)
**Phase:** P2 — Context Intelligence (continued)
**Self-scan:** 76/100 (L4 Productive) — holding steady
**Tests:** 550 engine + 28 schema + 68 CLI = 646 passing across 22 test files
**Quality gate:** typecheck, lint, test, build, selftest — all green
**Scaffold score:** 61/100 (L3 Capable) — stable
**Roadmap progress:** 3 items shipped this session

## Items Completed This Session
- Engine (P2.05): **`.agentignore` category annotations** — Parser now supports `# @category: <name>` annotations per RFC-0002 (generated, data, binary, vendor, sensitive). `AgentignoreFile.categories` maps category→count. Expanded ecosystem defaults with categorized output for TypeScript, Python, Go, Java, Rust, C#. 8 new tests.
- Engine (P2.06): **Framework-aware provider patterns** — Added Queue provider (`QueueProvider` + `InMemoryQueueProvider`) and Email provider (`EmailProvider` + `InMemoryEmailProvider`) templates to `--fix`. Detects SQS/Kafka/RabbitMQ/BullMQ for queue, SES/SendGrid/Nodemailer/Postmark/Mailgun/Resend for email. Shared `detectDependencyPatterns()` utility. 10 new tests.
- CLI (ARI-NAV-007): **Cognitive complexity reduction** — Extracted helpers from `formatTerminal` (3 functions) and `cli.ts` run handler (4 functions). No behavioral changes.

## Items Deferred
- P2.01: Context quality generator (requires semantic deduplication — NLP analysis, deferred)
- P2.02: `audit agents-md` command (depends on P1.04 additionality scoring)
- P2.03: Context delta viewer (depends on P2.02)
- P1.04: Semantic additionality engine (requires NLP/similarity analysis — deferred to P2)
- P1.07: AST-level order-sensitive assertion detection (deferred to P3.07)
- P1.18: Benchmark cohort v1 (requires npm publishing)
- Confidence-adjusted composite score (`--confidence-adjusted` flag) — deferred, needs UX design

## Next Session Should Start With

### Priority 1: P2.13 — Anonymous usage telemetry (opt-in)
- First-run consent flow (interactive, defaults to NO)
- `ariscan config set telemetry true/false` command
- `ARISCAN_TELEMETRY=false` environment variable override
- Payload definition (scan_id, version, platform, language, score bucketed, duration)
- `ariscan config show-telemetry-payload` for transparency
- TELEMETRY.md documentation
- Fire-and-forget POST to telemetry endpoint (no blocking)

### Priority 2: P2.06 remaining work
- Guided remediation validation (test templates against real repos, verify ARI impact estimates)
- Python/Go/Java provider pattern templates (currently TypeScript-only)

### Priority 3: Polish & DX
- Confidence-adjusted composite score (`--confidence-adjusted` flag)
- P1.04: Semantic additionality engine
- P1.18: Benchmark cohort v1
- Improve P3 Test Isolation score (currently 40, target 50+)
- Improve P5 Doc Machine-Readability score (currently 45, target 55+)

## Blockers
- None. All quality gates pass.
