# Next Session Guide

## Session: 2026-03-26
Phase: P3.5 (Scaffolder: `ariscan init`)
Checkboxes checked this session: ~35 (S.01–S.10 scaffolder items)

### Completed
- **S.01 — `ariscan init` Command:** Interactive + non-interactive modes fully working
- **S.02 — Bare TypeScript Preset:** 20 files generated, strict TS, providers, CI, devcontainer
- **S.03 — Next.js Preset:** 30 files generated — App Router, Tailwind CSS, server actions, providers
- **S.05 — Provider Pattern Scaffolding:** storage, queue, email interfaces + memory test doubles
- **S.06 — AGENTS.md Generation:** Generated from scaffold choices with architecture, module map, commands
- **S.07 — `.agentignore` Generation:** Stack-tuned patterns for both bare and Next.js presets
- **S.08 — Devcontainer Scaffolding:** devcontainer.json with postCreateCommand
- **S.09 — CI Pipeline Scaffolding:** GitHub Actions with lint/typecheck/test (+ build for Next.js)
- **S.10 — Non-interactive Mode:** `--preset` + `--name` flags, TTY detection, exit codes

### Ticket Status Changes
- S.01: todo → done
- S.02: todo → done (3 sub-items deferred: pre-commit hooks, error taxonomy stub, lockfile)
- S.03: todo → done
- S.05: todo → done
- S.06: todo → done (error taxonomy reference deferred)
- S.07: todo → done
- S.08: todo → done (Dockerfile, docker-compose deferred — using pre-built images)
- S.09: todo → done (ariscan score check in CI deferred — requires npm publish)
- S.10: todo → done

### In Progress
- **S.04 — Dogfood Gate:** Not yet implemented — init doesn't run ariscan on its output
- **S.11 — Preset API:** Types exist but community preset loading not implemented
- **P3.10 — MCP Server:** Remaining docs/benchmarks/telemetry items (deferred)
- **P3.02 — GitHub Action:** 2 items remain (Marketplace publication, runtime timing)
- **P3.09 — VS Code Extension:** Not started

### Deferred
- S.02: pre-commit hooks (husky requires npm install), error taxonomy stub, lockfile generation
- S.06: error taxonomy reference file
- S.08: custom Dockerfiles, docker-compose for local services
- S.09: ariscan score check in generated CI (requires npm publish)
- S.04: dogfood gate integration (init doesn't self-scan output yet)
- S.11: community preset loading, preset development docs

### Key Decisions
- Next.js preset duplicates shared generators from bare rather than inheriting at runtime (simpler, no preset composition engine needed)
- Used Tailwind v4 with `@tailwindcss/postcss` plugin (current best practice)
- Server actions demonstrated via `app/actions.ts` with `"use server"` directive
- Devcontainers use pre-built MS images rather than custom Dockerfiles
- Circular dependency finding from scanner on preset registry is false positive (index imports presets, not vice versa)

### Blockers
- None for core scaffolder implementation

### Next Session Should Start With
1. **S.04 (Dogfood Gate)** — p0-critical, wire self-scan into init command
2. **S.11 (Preset API)** — p1-high, community preset loading and docs
3. **P3.09 (VS Code Extension Preview)** — p2-medium, separate toolchain
4. **P3.02 remaining items** — GitHub Marketplace publication, runtime timing

### Roadmap Progress
- P1: ~129/132 done. Remaining: blocked/deferred items
- P2: 15/15 done. P2.12 blocked on P1.18
- P3: P3.01 done, P3.02 in-progress, P3.03 done, P3.04 done, P3.05 in-progress, P3.06 in-progress, P3.07 in-progress, P3.08 in-progress, P3.10 in-progress
- P3.5 Scaffolder: S.01 done, S.02 done, S.03 done, S.04 todo, S.05 done, S.06 done, S.07 done, S.08 done, S.09 done, S.10 done, S.11 todo
- CI: 9.67/10 done
- Selftest: 85/100 (L5 Autonomous) — baseline maintained
