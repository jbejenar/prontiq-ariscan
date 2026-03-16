# Next Session Guide

## Session: 2026-03-17
Phase: P1 (active — all remaining items blocked/deferred)
Checkboxes checked this session: 2 (CI.10 SARIF items)

### Completed
- **CI.10 — SARIF Upload for Code Scanning:** Added SARIF generation and upload steps to CI workflow using `github/codeql-action/upload-sarif@v3`. Added `security-events: write` permission. 2/3 items checked; third item (alerts visible in Security tab) requires push to main for verification.

### Ticket Status Changes
- CI.10: todo → in-progress (2/3 items checked, 1 requires remote verification after push)

### In Progress
- CI.10: Third checkbox (alerts visible in GitHub Security tab) needs verification after merge to main

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
- SARIF upload uses `if: always()` so findings are uploaded even when score gate fails
- Used `category: ariscan` to distinguish ARI findings from other code scanning tools (e.g., CodeQL)

### Blockers
- P1 remaining: All functional items blocked/deferred (P1.04, P1.07 deferred; P1.02/P1.03/P1.06/P1.18 blocked on npm publish + benchmarks)
- P2 remaining: P2.01/P2.02/P2.03 blocked on P1.04; P2.12 blocked on P1.18
- CI.10 third item requires push to main

### Next Session Should Start With
- Verify CI.10 third checkbox after PR is merged (check GitHub Security tab for ARI alerts)
- Evaluate if P1 phase can advance (most remaining items are deferred/blocked)
- Consider P1.18 (Benchmark Cohort) if npm publish happens
- P3 tickets are all `status: todo` — large scope, save for after P1/P2 advancement

### Roadmap Progress
- P1: ~119/122 done. Remaining: 1 deferred external metric, 2 deferred fix telemetry
- P2: 12/14 done. Remaining blocked on P1.04/P1.18
- CI: 9.67/10 done. CI.10 in-progress (2/3 items checked)
- Selftest: 92/100 (L5 Autonomous) — baseline maintained
