# Next Session Guide

## Session: 2026-03-26
Phase: P3 (Readiness-as-Code and Ecosystem)
Checkboxes checked this session: 7 (P3.08 functional items)

### Completed
- **P3.08 — Plugin Architecture (functional):** Full implementation:
  - Plugin API types in schema package (PluginManifest, PluginFinding, PluginConfig, PLUGIN_API_VERSION)
  - Plugin loader: discovers from `.ariscan/plugins/` directory and npm packages
  - Plugin runner: isolated execution with timeout (30s default), error containment
  - Conformance suite: validatePlugin() checks manifest, API version, analyze function, error handling, timeout
  - Scan pipeline integration: plugins run after core analyzers, findings stored separately
  - Reference plugin: `examples/ariscan-plugin-terraform/` with 3 checks
  - 29 new tests (conformance: 9, runner: 7, loader: 10, integration: 3)
  - Selftest: 86/100 (L5 Autonomous) — baseline maintained

### Ticket Status Changes
- P3.08: todo → in-progress (7/7 functional items checked, telemetry remain)

### In Progress
- **P3.08 — Plugin Architecture:** Remaining items:
  1. Telemetry items (plugin count, usage distribution) — non-blocking
- **P3.07 — AST/Graph Navigability Analysis:** Remaining items:
  1. Performance benchmark on large repos (<30s for 50k files) — DEFERRED, needs P1.18
  2. Telemetry items (non-blocking)
- **P3.05 — Agent Simulation Hooks:** Remaining: research docs (DEFERRED), telemetry
- **P3.06 — Language Rubric Profiles:** Remaining: score comparability, auto-selection accuracy (both DEFERRED, need P1.18)
- **P3.02 — GitHub Action GA:** Two items remain (Marketplace publication, runtime timing)

### Deferred
- P3.08 telemetry: plugin count, usage distribution — non-blocking
- P3.07 cross-boundary violation detection: needs redesign
- P3.07 performance benchmark: requires P1.18 benchmark cohort
- P3.05 research documentation: deferred for documentation pass
- P3.06 score comparability: requires P1.18 benchmark cohort
- P3.06 auto-selection accuracy: requires P1.18 benchmark cohort
- P1.18: Benchmark execution (blocked by sandbox/npm publish)

### Key Decisions
- Plugin API uses `AriscanPlugin` interface (not `PillarAnalyzer`) — plugins return findings, not pillar results. This keeps plugins simpler and prevents them from manipulating core scores.
- Plugin findings stored in `pluginFindings` array on ScanResult, separate from core findings. This maintains output backward compatibility.
- Finding codes in 9xx range (e.g., ARI-BLD-901) reserved for plugins to avoid conflicts with core finding codes.
- `PLUGIN_API_VERSION = "1.0"` with major version compatibility check. Minor version differences are tolerated.

### Blockers
- None for plugin architecture

### Next Session Should Start With
1. **P3.10 (MCP Read-only Server)** — p2-medium, high adoption potential, MCP SDK integration
2. **P3.09 (VS Code Extension Preview)** — p2-medium, separate toolchain
3. **P3.02 remaining items** — GitHub Marketplace publication, runtime timing

### Roadmap Progress
- P1: ~129/132 done. Remaining: blocked/deferred items
- P2: 15/15 done. P2.12 blocked on P1.18
- P3: P3.01 done, P3.02 in-progress (10/12), P3.03 done, P3.04 done, P3.05 in-progress (8/9 non-telemetry), P3.06 in-progress (11/13), P3.07 in-progress (11/12 non-telemetry), P3.08 in-progress (7/7 functional, telemetry remain)
- CI: 9.67/10 done
- Selftest: 86/100 (L5 Autonomous) — baseline maintained
