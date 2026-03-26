# Next Session Guide

## Session: 2026-03-26
Phase: P3.5 (Scaffolder: `ariscan init`)
Checkboxes checked this session: ~42 (S.01–S.11 scaffolder items, S.04 and S.11 newly completed)

### Completed
- **S.01 — `ariscan init` Command:** Interactive + non-interactive modes fully working
- **S.02 — Bare TypeScript Preset:** 20 files generated, strict TS, providers, CI, devcontainer
- **S.03 — Next.js Preset:** 30 files generated — App Router, Tailwind CSS, server actions, providers
- **S.04 — Dogfood Gate:** Init runs self-scan, score >= L3 (46+) enforced, CI scaffold gates for bare and nextjs
- **S.05 — Provider Pattern Scaffolding:** storage, queue, email interfaces + memory test doubles
- **S.06 — AGENTS.md Generation:** Generated from scaffold choices with architecture, module map, commands
- **S.07 — `.agentignore` Generation:** Stack-tuned patterns for both bare and Next.js presets
- **S.08 — Devcontainer Scaffolding:** devcontainer.json with postCreateCommand
- **S.09 — CI Pipeline Scaffolding:** GitHub Actions with lint/typecheck/test (+ build for Next.js)
- **S.10 — Non-interactive Mode:** `--preset` + `--name` flags, TTY detection, exit codes
- **S.11 — Preset API:** Community preset loading from local dirs and npm, manifest validation, example preset, docs

### Ticket Status Changes
- S.04: todo → done (all 5 sub-items verified with evidence)
- S.11: todo → done (4 sub-items complete: preset API, community loading, dogfood gate, docs)

### In Progress
- **P3.10 — MCP Server:** Remaining docs/benchmarks/telemetry items (deferred)
- **P3.02 — GitHub Action:** 2 items remain (Marketplace publication, runtime timing)
- **P3.09 — VS Code Extension:** Not started

### Deferred
- S.02: pre-commit hooks (husky requires npm install), error taxonomy stub, lockfile generation
- S.06: error taxonomy reference file
- S.08: custom Dockerfiles, docker-compose for local services
- S.09: ariscan score check in generated CI (requires npm publish)

### Key Decisions
- Community presets use `community/<name>` prefix convention
- Local presets take priority over npm packages (`.ariscan/presets/` checked first)
- `ariscan-preset-<name>` npm naming convention (mirrors `ariscan-plugin-<name>` pattern)
- Community presets pass through same dogfood gate as built-in presets (no special treatment)

### Blockers
- None for core scaffolder implementation

### Next Session Should Start With
1. **P3.09 (VS Code Extension Preview)** — p2-medium, separate toolchain, largest remaining P3 item
2. **P3.02 remaining items** — GitHub Marketplace publication (requires separate repo), runtime timing
3. **P1.18 (Benchmark)** — execute benchmark run on 20+ OSS repos (requires npm publish or local execution)

### Roadmap Progress
- P1: ~129/132 done. Remaining: blocked/deferred items (benchmark execution, telemetry)
- P2: 15/15 done. P2.12 blocked on P1.18
- P3: P3.01 done, P3.02 in-progress, P3.03 done, P3.04 done, P3.05 in-progress, P3.06 in-progress, P3.07 in-progress, P3.08 in-progress, P3.09 todo, P3.10 in-progress
- P3.5 Scaffolder: S.01 done, S.02 done, S.03 done, S.04 done, S.05 done, S.06 done, S.07 done, S.08 done, S.09 done, S.10 done, S.11 done
- CI: 9.67/10 done
- Selftest: 85/100 (L5 Autonomous) — baseline maintained
