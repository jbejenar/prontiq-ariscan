# Next Session Guide

## Session: 2026-03-26
Phase: P1 (completing final REVIEW items) → P3 active
Checkboxes checked this session: 1 (P1.03 testing)

### Completed
- **P1.03 testing: Zero false negatives** — Validated via `benchmarks/validate-context-discovery.cjs` using GitHub API. 22 ground-truth context files across 21 repos, 22 discovered, 0 missed. False negative rate: 0.0%.
- **P3.06 auto-selection accuracy validation** — Tested via `benchmarks/validate-language-selection.cjs`. 19/21 correct (90.5%), below 95% target. Mismatches on multi-language repos (svelte: JS vs TS, deno: TS vs Rust).

### Ticket Status Changes
- P1.03: unchecked → done

### In Progress
- **P1.06 testing: False-positive rate <10%** — Script rewritten with semantic file-scoping validation via `isTestFile()` (3.7% FP rate per rewritten script). Needs formal re-run and roadmap evidence update. Ticket status reverted to `in-progress`.
- **P3.06 — Language Profiles:** Auto-selection accuracy at 90.5% (target 95%). Svelte and Deno mismatches are multi-language edge cases requiring multi-language detection or heuristic tuning.
- **P3.06 — Score comparability:** TS repos score significantly higher than other ecosystems. Further weight calibration needed.
- **P3.02 — GitHub Action:** 2 items remain (Marketplace publication, runtime timing)
- **P3.09 — VS Code Extension:** Not started

### Deferred
- P1.02 false-language detection rate <5% on 50+ repos — cohort has 21 repos, needs expansion
- P1.03 discovery <1s for 100k files — needs end-to-end filesystem benchmark
- P1.07 all items — blocked on P3.07 AST/Tree-sitter integration
- All telemetry items requiring server-side infrastructure

### Discovered
- Multi-language repo detection is a gap: repos like Deno (Rust + TypeScript) and Svelte (JS + TypeScript) need better primary language heuristics or multi-language support
- P3 (test isolation) findings have good precision (3.7% FP rate — 3/82 findings on non-test files). Script rewritten with semantic `isTestFile()` validation; needs formal re-run for roadmap evidence.

### Key Decisions
- Conservative FP methodology: only clearly malformed findings classified as false positives. Scanner's test-file scoping prevents most FP sources.
- Multi-language mismatches documented as partial evidence rather than adjusting revisions.json ground truth.

### Blockers
- P3.06 auto-selection accuracy needs multi-language detection improvement to reach 95% target
- P3.02 Marketplace publication requires separate `prontiq/ariscan-action` repo
- P3.09 VS Code Extension requires separate toolchain

### Next Session Should Start With
1. **P1.06 testing re-run** — re-run `benchmarks/validate-test-isolation.cjs` with semantic `isTestFile()` validation and update roadmap with evidence. Script already rewritten; just needs formal execution and evidence recording.
2. **P3.06 multi-language detection** — improve auto-selection for repos with multiple significant languages (svelte, deno). Consider returning top-2 languages or using framework detection as tiebreaker.
2. **P2.12 (Open Benchmark Leaderboard)** — fully unblocked by P1.18
3. **P3.07 performance <30s benchmark** — use P1.18 large repos to verify
4. **P3.09 (VS Code Extension Preview)** — p2-medium, largest remaining P3 item

### Roadmap Progress
- P1: ~131/132 done (P1.06 in-progress — semantic FP validation rewritten, pending re-run; remaining items all BLOCKED/DEFERRED/telemetry)
- P2: 14/15 done. P2.12 still todo
- P3: P3.01 done, P3.02 in-progress (2 items), P3.03 done, P3.04 done, P3.05 done, P3.06 in-progress, P3.07 in-progress, P3.08 in-progress, P3.09 todo, P3.10 in-progress
- P3.5 Scaffolder: S.01–S.11 all done
- CI: 9/10 done
- Selftest: 85/100 (L5 Autonomous) baseline
