# Next Session Guide

## Session: 2026-03-26
Phase: P2 (complete) → P3 active
Checkboxes checked this session: 1 (P2.12 cohort expansion to 53 repos)

### Completed
- **P2.12: 50+ repos** — Expanded benchmark cohort from 21 to 53 repos across 9 languages. All scanned successfully. Leaderboard regenerated. Refs pinned. P2.12 ticket now `done`.

### Ticket Status Changes
- P2.12: in-progress → done (all 8 functional items complete)

### In Progress
- **P3.06 — Language Profiles:** Auto-selection accuracy at 94.3% (target 95%). 3 mismatches on genuinely multi-language repos (svelte, deno, swc). Score comparability across languages not yet achieved.
- **P3.02 — GitHub Action:** 2 items remain (Marketplace publication requires separate repo, runtime timing)
- **P3.09 — VS Code Extension:** Not started (status: todo)

### Deferred
- P1.02 false-language detection rate <5% on 50+ repos — now have 53 repos but detection rate item tracks different metric
- P1.03 discovery <1s for 100k files — needs end-to-end filesystem benchmark
- P1.07 all items — blocked on P3.07 AST/Tree-sitter integration
- All telemetry items requiring server-side infrastructure

### Discovered
- C#, Ruby, PHP languages now represented in benchmark (3+2+2 = 7 new language entries)
- swc (Rust runtime with JS tests) joins svelte/deno as genuinely multi-language repos that challenge auto-detection

### Key Decisions
- Included 9 languages in cohort (added C#, Ruby, PHP; Kotlin was considered but had 0 qualifying repos)
- Used `--pin-refs` to resolve all branch names to commit SHAs for reproducibility

### Blockers
- P3.06 auto-selection accuracy (94.3%) needs multi-language detection improvement for svelte/deno/swc
- P3.02 Marketplace publication requires separate `prontiq/ariscan-action` repo
- P3.09 VS Code Extension requires separate toolchain

### Next Session Should Start With
1. **P3.06 multi-language detection** — improve auto-selection for repos with multiple significant languages (svelte, deno, swc). Accuracy at 94.3%, need 95%+.
2. **P3.09 (VS Code Extension Preview)** — p2-medium, largest remaining P3 item
3. **P3.02 GitHub Action** — complete remaining items (Marketplace publication, runtime timing)
4. **P3 exit criteria review** — with P2 complete, focus shifts entirely to P3

### Roadmap Progress
- P1: ~132/132 done (all actionable items complete; remaining are BLOCKED/DEFERRED/telemetry)
- P2: 15/15 done. All tickets complete.
- P3: P3.01 done, P3.02 in-progress (2 items), P3.03 done, P3.04 done, P3.05 in-progress, P3.06 in-progress, P3.07 in-progress (performance done, cross-boundary deferred), P3.08 in-progress, P3.09 todo, P3.10 in-progress
- P3.5 Scaffolder: S.01–S.11 all done
- CI: 9/10 done
- Selftest: 87/100 (L5 Autonomous) baseline
