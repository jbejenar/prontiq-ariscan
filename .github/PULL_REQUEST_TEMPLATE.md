## Summary

<!-- What does this PR do? 1-3 bullet points. -->

-

## ARI Impact

<!-- Which pillars are affected? Expected score change? -->

- **Pillars affected:**
- **Expected delta:**

## Test Plan

- [ ] All existing tests pass (`pnpm test`)
- [ ] New/changed behavior has test coverage
- [ ] Self-scan runs cleanly (`pnpm build && node packages/cli/dist/cli.js .`)

## Checklist

- [ ] No `any` types introduced
- [ ] `.js` extensions on all relative imports
- [ ] No new `console.log` (use CLI formatters)
- [ ] Finding codes follow `ARI-XXX-NNN` pattern and don't renumber existing codes
- [ ] Pillar weights still sum to 1.0 (if changed)
- [ ] Scaffold presets updated if scanner changes affect `ariscan init` output scores

---

> _If this PR was authored or co-authored by an AI agent, note which one below._
>
> **Agent:** <!-- e.g., Claude Code, Copilot, Cursor -->
