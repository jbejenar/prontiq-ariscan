# Next Session Guide

## Session: 2026-03-26
Phase: P3 (Readiness-as-Code and Ecosystem)
Checkboxes checked this session: 11 (P3.10 functional items)

### Completed
- **P3.10 — MCP Read-only Server (functional):** Full implementation:
  - New `@prontiq/ariscan-mcp` package with MCP SDK integration
  - 5 read-only resources: score, pillars, recommendations, context-files, budget
  - Safety constraints: read-only (no tools), no file content exposure, configurable cache TTL and scan timeout
  - CLI entry point: `ariscan-mcp` with `--path`, `--cache-ttl`, `--timeout` flags
  - Example MCP configurations for Claude Code and Cursor
  - 13 tests (resource extractors: 10, server: 3)
  - Selftest: 86/100 (L5 Autonomous) — baseline maintained

### Ticket Status Changes
- P3.10: todo → in-progress (11/11 functional items checked, docs/benchmarks/telemetry remain)

### In Progress
- **P3.10 — MCP Read-only Server:** Remaining items:
  1. Protocol documentation (requires npm publish + docs site)
  2. Works with Claude Code and Cursor (requires npm publish)
  3. Startup time benchmark (requires end-to-end testing)
  4. Telemetry items (non-blocking)
- **P3.08 — Plugin Architecture:** Remaining: telemetry items (non-blocking)
- **P3.07 — AST/Graph Navigability Analysis:** Remaining: performance benchmark, telemetry
- **P3.05 — Agent Simulation Hooks:** Remaining: research docs, telemetry
- **P3.06 — Language Rubric Profiles:** Remaining: score comparability, auto-selection accuracy
- **P3.02 — GitHub Action GA:** Two items remain (Marketplace publication, runtime timing)

### Deferred
- P3.10 protocol docs: requires npm publish and docs site
- P3.10 client testing: requires npm publish for npx to work
- P3.10 startup benchmark: requires end-to-end benchmarking with published package
- P3.10 telemetry: MCP server connections, query frequency — non-blocking
- P3.08 telemetry: plugin count, usage distribution — non-blocking
- P3.07 performance benchmark: requires P1.18 benchmark cohort
- P3.05 research documentation: deferred for documentation pass
- P3.06 score comparability: requires P1.18 benchmark cohort
- P1.18: Benchmark execution (blocked by sandbox/npm publish)

### Key Decisions
- MCP server uses `readiness://` URI scheme for resource identification
- Scan results cached with configurable TTL (default 5 min) to avoid re-scanning on every resource query
- Budget resource triggers a separate `analyzeTokenBudget()` call since it's not part of ScanResult
- Resources expose finding codes and messages but strip file paths from finding data (safety constraint)
- Server uses deprecated `server.resource()` API (stable) rather than `registerResource()` (newer) for broader SDK version compatibility

### Blockers
- None for core MCP server implementation

### Next Session Should Start With
1. **P3.09 (VS Code Extension Preview)** — p2-medium, separate toolchain (VS Code Extension API)
2. **P3.02 remaining items** — GitHub Marketplace publication, runtime timing
3. **Scaffolder (P3.5/S.01)** — p0-critical, `ariscan init` command

### Roadmap Progress
- P1: ~129/132 done. Remaining: blocked/deferred items
- P2: 15/15 done. P2.12 blocked on P1.18
- P3: P3.01 done, P3.02 in-progress (10/12), P3.03 done, P3.04 done, P3.05 in-progress (8/9 non-telemetry), P3.06 in-progress (11/13), P3.07 in-progress (11/12 non-telemetry), P3.08 in-progress (7/7 functional), P3.10 in-progress (11/11 functional)
- CI: 9.67/10 done
- Selftest: 86/100 (L5 Autonomous) — baseline maintained
