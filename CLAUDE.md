# CLAUDE.md — Claude Code Guidance

See [AGENTS.md](./AGENTS.md) for full project context, architecture, and conventions.

## Quick Reference

```bash
pnpm install          # install deps
pnpm build            # build all packages
pnpm test             # run all tests
pnpm lint             # lint all packages
pnpm typecheck        # type-check (tsc --noEmit)
pnpm format:check     # check formatting
```

Build order matters: `schema` -> `engine` -> `cli`. Turborepo handles this automatically.

## Key Architectural Decisions

- **Read-only analysis** — analyzers receive a `RepoContext` abstraction and must never execute target repo code or make network calls. All scanning is local filesystem reads only.
- **One analyzer per pillar** — each of the 8 pillars has exactly one analyzer file in `packages/engine/src/analyzers/`. The analyzer registry is a flat array, not a plugin system.
- **Schema-first** — all types (PillarId, Finding, PillarResult) live in `@prontiq/schema` and are Zod-validated. Engine and CLI depend on schema, never the reverse.
- **ESM throughout** — every package uses `"type": "module"`. Relative imports must include `.js` extension.

## Testing Patterns

- **Framework:** Vitest (not Jest)
- **Mocking filesystem:** Tests create a mock `RepoContext` object with stubbed `readFile()`, `fileExists()`, and `readJson()` methods. Do not use real filesystem access in tests.
- **Test location:** `packages/{pkg}/src/__tests__/` or colocated `*.test.ts` files
- **Running single test:** `pnpm --filter @prontiq/engine test -- --run context-quality`
- **Assertions:** Use Vitest's `expect()` with `.toBe()`, `.toEqual()`, `.toContain()`, etc.

## Common Gotchas

1. **Import extensions** — forgetting `.js` in relative imports causes runtime errors. TypeScript compiles fine but Node ESM resolution fails. Always write `import { foo } from "./bar.js"`.
2. **Build before test** — the engine imports from `@prontiq/schema` via its built output. Run `pnpm build` after schema changes before testing engine.
3. **Pillar weights must sum to 1.0** — if you change weights in `packages/schema/src/pillar.ts`, ensure they still total exactly 1.0 or the composite score breaks.
4. **Finding codes are stable** — codes like `ARI-CTX-001` may be referenced by users in config files for suppression. Don't renumber existing codes.
5. **Score clamping** — every analyzer must clamp its score to [0, 100] via `Math.min(100, Math.max(0, score))` before returning.
6. **No `any`** — the ESLint config enforces `@typescript-eslint/no-explicit-any`. Use `unknown` and narrow.
