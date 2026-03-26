# Next Session Guide

## Session: 2026-03-26 (roadmap hygiene)
Phase: All phases complete (all remaining items DEFERRED on external dependencies)
Checkboxes checked this session: 0 (no actionable roadmap items)

### Completed
- **Roadmap hygiene:** Added explicit `[DEFERRED]` annotations to 20 telemetry items that were missing them. All 62 unchecked items now have `[DEFERRED]` or `[BLOCKED]` labels.
- **Full verification pass:** All golden commands pass — install, build, lint, typecheck, test (1330 tests, 0 failures), selftest (87/100, L5 Autonomous).

### Ticket Status Changes
- None — all tickets remain `status: done`

### In Progress
- None — all tickets are `status: done` or have only DEFERRED items

### Deferred
- All 62 remaining unchecked items are DEFERRED/BLOCKED across all phases
- Major blockers: npm publish (P3.10, P3.02 Marketplace), separate repo (P3.02 Action), AST-level analysis (P1.07), benchmark cohort expansion (P1.02), end-to-end perf benchmarks (P1.03)
- Telemetry items deferred across all phases (non-blocking, require server-side aggregation infrastructure)

### Key Decisions
- No code changes this session — roadmap is feature-complete from a code perspective.
- All previously unannotated telemetry items now carry explicit `[DEFERRED]` annotations for agent clarity.

### Blockers
- npm publish required for: P3.10 MCP integration, P3.02 Marketplace listing
- Separate `prontiq/ariscan-action` repo required for: P3.02 GitHub Action Marketplace
- 50+ repo benchmark cohort required for: P1.02 false-language detection rate validation
- Tree-sitter AST integration required for: P1.07 order-sensitive assertion detection

### Next Session Should Start With
1. **npm publish** — merge to main triggers the publish workflow (`publish.yml` with changesets). This is the single highest-impact unblock. Requires a changeset + merge to main.
2. **Post-publish verification** — after npm publish, verify `npx @prontiq/ariscan-cli .` works, MCP server works via `npx`, GitHub Action Marketplace listing.
3. **Benchmark cohort expansion** — expand from 21 to 50+ repos for P1.02 false-language detection validation.

### Roadmap Progress
- P1: all tickets done (3 have DEFERRED items)
- P2: 15/15 done
- P3: 10/10 tickets done (deferred items remain in P3.01, P3.02, P3.04, P3.05, P3.06, P3.07, P3.08, P3.09, P3.10)
- P3.5 Scaffolder: S.01-S.11 all done
- CI: CI.01-CI.10 all done (CI.10 alert visibility pending push to main)
- Selftest: 87/100 (L5 Autonomous)

### Verification Evidence (2026-03-26)
- `pnpm install` — up to date
- `pnpm build` — 5/5 tasks successful (cached)
- `pnpm lint` — 5/5 tasks successful (cached)
- `pnpm typecheck` — 7/7 tasks successful (cached)
- `pnpm test` — 1330 tests passed, 0 failures (cached)
- `pnpm selftest` — 87/100, L5 Autonomous
