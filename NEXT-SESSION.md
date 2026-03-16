# Next Session Guide

## Session: 2026-03-16 (afternoon)
Phase: P1 (active — all remaining items blocked/deferred)
Checkboxes checked this session: 12 (8 telemetry + 3 CI.09 + 1 CI.08 partial)

### Completed
- **Telemetry consolidation round 2:** Resolved 18 remaining telemetry items across P1/P2. Added `devcontainer_detected` and `high_risk_test_count` fields to telemetry payload. 8 items checked (server-side or field added), 10 items deferred with justification.
- **CI.08 — Test Coverage Reporting:** Added `@vitest/coverage-v8`, `vitest.config.ts` with coverage config, `test:coverage` script, CI artifact upload. PR comment deferred (requires external service).
- **CI.09 — Branch Protection Rules Documentation:** Added "Branch Protection" section to CONTRIBUTING.md with all 3 required rules + GitHub rulesets note.

### Ticket Status Changes
- CI.08: todo → done (3/4 items checked, 1 deferred)
- CI.09: todo → done (all items checked)

### In Progress
- None

### Deferred
- P1.01 telemetry: install-to-first-scan time (external user-experience metric)
- P1.16 telemetry: fix adoption rate, fix types applied (requires fix-mode telemetry)
- P2.05 telemetry: .agentignore generation/patterns (requires fix-mode telemetry)
- P2.06 telemetry: template adoption, ARI improvement (requires fix-mode telemetry + before/after comparison)
- P2.07 telemetry: fix expansion, acceptance rates (requires fix-mode telemetry + interactive UI)
- P2.08 telemetry: hint adoption rate (requires user action tracking)
- P2.13 telemetry: opt-in rate, payload size, success rate (meta-telemetry, server infrastructure)
- CI.08: PR comment with coverage delta (requires external service integration)

### Key Decisions
- Telemetry items that are server-side aggregations of existing scan data were checked as "done" — server computes the metric from per-pillar findings
- Fix-mode telemetry deferred as a category — --fix runs separately from scan telemetry
- Meta-telemetry (opt-in rate, etc.) deferred — these are server infrastructure metrics

### Blockers
- P1 remaining: All functional items blocked/deferred (P1.04, P1.07 deferred; P1.02/P1.03/P1.06/P1.18 blocked on npm publish + benchmarks)
- P2 remaining: P2.01/P2.02/P2.03 blocked on P1.04; P2.12 blocked on P1.18
- Fix-mode telemetry is a cross-cutting concern blocking multiple telemetry items — consider adding as [NEW] roadmap item

### Next Session Should Start With
- Evaluate if P1 phase can advance (most remaining items are deferred/blocked)
- Consider P1.18 (Benchmark Cohort) — largest unblocked P1 item if npm publish happens
- CI.10 (SARIF Upload) is the next unblocked CI ticket
- Consider adding [NEW] item for fix-mode telemetry integration (blocks ~8 deferred items)
- P3 tickets are all `status: todo` — large scope, save for after P1/P2 advancement

### Roadmap Progress
- P1: ~119/122 done. Remaining: 1 deferred external metric, 2 deferred fix telemetry
- P2: 12/14 done. Remaining blocked on P1.04/P1.18
- CI: 9/10 done. CI.10 remaining (SARIF upload)
- Selftest: 92/100 (L5 Autonomous) — baseline maintained
