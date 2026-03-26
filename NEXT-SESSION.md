# Next Session Guide

## Session: 2026-03-26
Phase: P3 active
Checkboxes checked this session: 13 (P3.05 research docs, 12 telemetry items across P3.02/P3.05/P3.07/P3.08/P3.10)

### Completed
- **P3.05 research basis documented:** Added research references (Tutorial Problem 94-96% drop-off, SWE-bench setup failures, Microsoft/GitLab 60%/30% improvements) to simulate command description. Cross-references EVIDENCE-BASE.md entries 4.1-4.3.
- **P3 telemetry consolidation (Round 3):** Added 9 new optional telemetry schema fields covering all remaining P3 telemetry items:
  - P3.02: `action_used` (GitHub Action detection)
  - P3.05: `simulation_ran`, `simulation_step_count`, `simulation_pass_rate_bucket`, `simulation_prediction_accuracy_bucket`
  - P3.07: `circular_dependency_detected`, `module_cohesion_bucket`
  - P3.08: `plugin_count`
  - P3.10: `mcp_resource_count`
- Extended `TelemetryOptions` with `actionUsed`, `simulation`, `pluginCount`, `mcpResourceCount`
- 14 new unit tests for all telemetry fields. All 1099+ engine tests pass.
- Updated TELEMETRY.md with new field documentation.

### Ticket Status Changes
- P3.05: in-progress → done (research docs + telemetry items complete)
- P3.07: telemetry items complete (functional item still deferred)
- P3.08: telemetry items complete (ticket functionally done)
- P3.10: telemetry items complete (functional items still deferred)

### In Progress
- **P3.02 — GitHub Action:** 1 functional item remains (Marketplace publication requires separate repo)
- **P3.07 — AST/Graph:** Cross-boundary violations deferred (needs redesign)
- **P3.10 — MCP Server:** 3 functional items deferred (require npm publish)

### Deferred
- P3.02 Marketplace publication — requires separate `prontiq/ariscan-action` repo
- P3.10 MCP items — require npm publish for npx to work
- P3.07 cross-boundary violations — needs redesign

### Key Decisions
- Telemetry fields use existing `ScoreBucket` type for rate/accuracy bucketing (reuse, privacy-preserving)
- Circular dependency detection derived from ARI-NAV-010 findings in scan results
- Module cohesion proxied via P7 navigability pillar score bucket
- All new fields are optional for backward compatibility

### Blockers
- P3.02 Marketplace publication requires separate `prontiq/ariscan-action` repo
- P3.10 MCP integration requires npm publish

### Next Session Should Start With
1. **P3 exit criteria review** — evaluate which exit criteria are met vs blocked
2. **P3.07 cross-boundary violations** — evaluate if redesign is feasible or should be deferred to P4
3. **P3 phase advancement decision** — most remaining items are blocked on external deps (npm publish, separate repo). Consider whether P3 can be advanced with blocked items documented.

### Roadmap Progress
- P1: complete
- P2: 15/15 done
- P3: P3.01 done, P3.02 in-progress (1 blocked), P3.03 done, P3.04 done, P3.05 done, P3.06 done, P3.07 in-progress (1 deferred), P3.08 done, P3.09 done, P3.10 in-progress (3 deferred)
- P3.5 Scaffolder: S.01-S.11 all done
- Selftest: 87/100 (L5 Autonomous) — unchanged from baseline
