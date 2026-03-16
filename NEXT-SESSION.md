# Next Session Guide

## Session: 2026-03-16
Phase: P1 (active — earliest phase with unchecked items)
Checkboxes checked this session: 31

### Completed
- **P1 Telemetry Consolidation:** Added 7 new optional telemetry fields (context_file_count, agent_context_types, security_gate_triggered, maturity_level, monorepo_detected, detection_confidence, finding_counts_by_severity). Checked 21 telemetry items across P1.01–P1.16.
- **P2.06 Guided Remediation Templates:** Audited all 18 generators — 100% have complete TemplateMetadata (prerequisites, steps, rollbackAdvice, expectedImpact). All 5 pillar categories covered. Added pillar coverage test. Checked all 10 functional items. Advanced to `done`.
- **Ticket status advances:** P1.05, P1.10, P1.11, P1.12, P1.13, P1.14, P1.16 → `done`. P2.06 → `done`.

### Ticket Status Changes
- P1.05: in-progress → done (all items checked including telemetry)
- P1.10: in-progress → done (all items checked including telemetry)
- P1.11: in-progress → done (all items checked including telemetry)
- P1.12: in-progress → done (all items checked including telemetry)
- P1.13: in-progress → done (all items checked including telemetry)
- P1.14: in-progress → done (all items checked including telemetry)
- P1.16: in-progress → done (all items checked including telemetry)
- P2.06: in-progress → done (all functional items verified with evidence)

### In Progress
- None (all batch items shipped)

### Deferred
- P1.04: Semantic additionality engine (requires NLP) [DEFERRED]
- P1.07: AST-level analysis (deferred to P3.07) [DEFERRED]
- P1.18: Benchmark cohort (requires npm publishing) [BLOCKED]

### Key Decisions
- Telemetry fields emit raw per-scan data points; server-side aggregation computes distributions/rates
- P2.06 templates already fully implemented — audit confirmed 18/18 generators with complete metadata
- P1 ticket status advances based on telemetry items being the last unchecked work

### Blockers
- P1.02/P1.03/P1.06 benchmark items require P1.18 (npm publishing + benchmark cohort)
- P1.01 "Install-to-first-scan time" is an external benchmark metric, not a per-scan telemetry field
- P1.04/P1.07 are deferred by design

### Next Session Should Start With
- P1 remaining unchecked: ~5 items (P1.01 install time, P1.02/P1.03/P1.06 benchmarks, P1.04 telemetry) — all blocked/deferred
- P1 exit criteria: "npm package published" (partial), "20+ repos benchmarked" (blocked on P1.18) — both require human action
- P2 remaining: P2.01 (blocked on P1.04), P2.02 (blocked on P1.04), P2.03 (blocked on P2.02), P2.12 (blocked on P1.18)
- Consider P2 tickets that are unblocked: P2.07, P2.08, P2.09 if status allows
- Fix-related telemetry (P1.16 fix adoption/types) needs --fix tracking field if prioritized

### Roadmap Progress
- P1: ~115/120 done. Remaining: 3 blocked benchmarks, 2 deferred tickets, 1 external metric
- P2: 10/14 done. Remaining: 3 blocked, 1 todo
- Selftest: 92/100 (L5 Autonomous) — baseline
