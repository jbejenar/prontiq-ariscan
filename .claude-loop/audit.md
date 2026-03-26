# Audit Report — P3 Telemetry Fields + P3.05 Research Docs (Round 2)

**Date:** 2026-03-26
**Branch:** `claude/prompt/adhoc-task-1774506141`
**Auditor:** Claude Sonnet 4.6 (audit mode)
**Verdict:** **PASS_WITH_NOTES**

> **Note:** A prior audit (same file) returned FAIL and flagged a fabricated Microsoft/GitLab citation and four unchecked roadmap items. All four findings are marked `[REMEDIATED]` in the prior audit. This report audits the current diff, which reflects the remediated state.

---

## Summary

Implementation is correct, privacy-safe, backward-compatible, and well-tested. Research citations now accurately match EVIDENCE-BASE.md entries 4.1–4.3. Previously unchecked roadmap items are now correctly annotated `[DEFERRED: reason]`. One minor documentation inconsistency (TELEMETRY.md example value) and one design note (semantic coverage of "Time-to-green distribution") are recorded below but do not block ship.

---

## Findings by Category

### 1. Correctness — PASS

**Schema (`packages/schema/src/telemetry.ts`):**
- All 9 new fields correctly typed and validated. Optional throughout — no backward-compat risk.
- `simulation_pass_rate_bucket` and `simulation_prediction_accuracy_bucket` correctly reuse `ScoreBucket` enum.
- `plugin_count` and `mcp_resource_count` correctly constrained as `int().nonnegative()`.

**Payload builder (`packages/engine/src/telemetry/payload.ts`):**
- `simulation_ran` is `true | undefined` (never `false`) — correct sentinel: absence means "not run," presence means "ran."
- `hasCircularDependencies()`: gates on P7 pillar presence before checking findings — returns `undefined` when P7 is absent, correctly omitting the field when the analyzer didn't run. ✓
- `moduleCohesionBucket()`: same P7 gate pattern, consistent behavior. ✓
- `scoreToBucket(80)` → `"61-80"` (boundary: `score <= 80`). Test at line 333 passes `predictionAccuracy: 80` and asserts `"61-80"` — implementation and test are self-consistent. ✓

**Research citations (`packages/cli/src/commands/simulate.ts:38–45`):**
All three citations now match EVIDENCE-BASE.md verbatim:
- 4.1: "94-96% drop-off when users must follow manual setup steps" ✓
- 4.2: "agent task failure frequently traces to environment setup, not task complexity" ✓
- 4.3: "reproducibility reduces debugging time by 40-60% across team sizes" ✓

### 2. Completeness — PASS

**Plan vs. implementation:**
- 9 schema fields implemented (plan originally listed 12; 3 were correctly deferred with annotations).
- `TelemetryOptions` extended: `actionUsed`, `simulation`, `pluginCount`, `mcpResourceCount`.
- `SimulationTelemetry` interface extracted and exported from `index.ts`.
- TELEMETRY.md updated with all new fields.
- Roadmap updated: 8 items checked, 5 items annotated `[DEFERRED: reason]`. All deferral reasons are accurate.
- NEXT-SESSION.md reflects current session state with actionable next steps.

**Deferred items — all correctly annotated:**
- P3.02 "Runs per week" / "Fail rate" → `[DEFERRED: requires server-side aggregation across scans]` ✓
- P3.08 "Plugin usage distribution" → `[DEFERRED: requires per-plugin telemetry beyond count]` ✓
- P3.10 "Query frequency by resource" → `[DEFERRED: requires per-resource telemetry beyond count]` ✓

### 3. Code Quality — PASS

- `hasCircularDependencies` and `moduleCohesionBucket` extracted as named helpers — readable and testable.
- JSDoc on all new `TelemetryOptions` fields and `SimulationTelemetry` members with pillar cross-references.
- No `any`. `ReturnType<typeof scoreToBucket>` avoids repeating the union type literal.
- `.js` extensions present on all relative imports (ESM compliance).
- Round 3 fields grouped with comment block in both schema and builder — consistent with existing "Round 2" pattern.

### 4. Tests — PASS (unverified)

13 new test cases added in `packages/engine/src/__tests__/telemetry/payload.test.ts`:
- `action_used` present / absent ✓
- simulation fields (all 4) present / absent ✓
- `circular_dependency_detected` when ARI-NAV-010 finding present ✓
- `circular_dependency_detected` when finding absent ✓
- `circular_dependency_detected` undefined when no P7 pillar ✓
- `module_cohesion_bucket` from P7 score / undefined when no P7 ✓
- `plugin_count` present / absent ✓
- `mcp_resource_count` present / absent ✓

Test logic is structurally correct — no obvious errors. Tests could not be executed in audit environment; runtime verification is deferred to CI.

**Minor gap (info):** No test for `simulation_step_count: 0`. Not a risk — schema constraint (`nonnegative()`) catches invalid values at parse time. Low priority.

### 5. Security / Privacy — PASS

- No PII, no repo names/paths, no raw scores transmitted.
- `plugin_count` and `mcp_resource_count` are raw small integers. The plan explicitly chose count over bucket here — a defensible tradeoff given that plugin counts in realistic repos are small (< 20) and non-identifying.
- No new network surfaces, no injection points.

### 6. Performance — PASS

- `hasCircularDependencies` and `moduleCohesionBucket` each do one `Array.find()` + one `Array.some()/find()` — O(n) on pillar count and finding count, both negligible.

### 7. Breaking Changes — PASS

- All new fields optional — existing payloads remain schema-valid.
- No changes to existing field types or semantics.
- `SimulationTelemetry` and updated `TelemetryOptions` are additive.

---

## Notes (Non-Blocking)

### WARNING: TELEMETRY.md example value inconsistent with bucket boundaries

**File:** `TELEMETRY.md:32`

The documentation table shows:
```
| `simulation_prediction_accuracy_bucket` | `"81-100"` | ...
```

But `scoreToBucket(80) = "61-80"` (boundary condition: `score <= 80` → `"61-80"`). A reader using the example value `"81-100"` as a guide would need accuracy ≥ 81 to reproduce it. The example is illustrative, but it creates a subtle inconsistency for anyone cross-referencing the bucket logic.

**Severity:** warning
**Fix:** Change the example to `"61-80"` (corresponding to e.g. 75% accuracy), or change to `"81-100"` and use an input of 85% in the prose. One line fix in TELEMETRY.md.

### INFO: "Time-to-green distribution" → `simulation_pass_rate_bucket` (semantic drift)

**Roadmap item (P3.05):** "Time-to-green distribution"
**Implementation:** `simulation_pass_rate_bucket` (step pass rate, not timing)

The roadmap was updated to say "Pass rate distribution (bucketed step pass rate)" — correctly reflecting what was built. However, `timeToGreenMs` from `SimulationResult` could have been bucketed instead (or in addition). This is an intentional design simplification that was self-documented in the roadmap. No action needed, but noted for future sessions that want to add a true time-to-green bucket.

**Severity:** info
**Action:** None required. Roadmap was updated to reflect actual implementation.

### INFO: `simulation_ran` can only ever be `true | undefined`, never `false`

**File:** `packages/engine/src/telemetry/payload.ts:103`

```ts
simulation_ran: options?.simulation != null ? true : undefined,
```

The schema permits `boolean`, but the builder never produces `false`. This is intentional (absence-means-not-run pattern), but downstream consumers need to understand `false` is not a valid emitted value despite the schema allowing it. Consider adding a JSDoc note on the schema field clarifying this.

**Severity:** info

---

## Checklist Summary

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | Pass | All field logic, bucketing, and citations verified correct |
| Completeness | Pass | All plan items implemented or deferred with reasons |
| Code Quality | Pass | Clean, idiomatic, follows project conventions |
| Tests | Pass (unverified) | Logic correct; runtime verification needs CI |
| Security/Privacy | Pass | No PII, privacy-safe counts |
| Performance | Pass | Negligible overhead |
| Breaking Changes | Pass | All fields optional, no regressions |

---

## Recommended Fixes

1. **(warning)** `TELEMETRY.md:32` — Fix example value for `simulation_prediction_accuracy_bucket` to be consistent with `scoreToBucket` boundary semantics (use `"61-80"` with ~75% example, or use input ≥ 81 to justify `"81-100"`).

2. **(info, optional)** Add a JSDoc comment on `simulation_ran` schema field noting that the builder emits `true | undefined`, never `false`.
