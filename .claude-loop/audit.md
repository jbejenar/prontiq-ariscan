# Audit Report — P3 Telemetry Fields + P3.05 Research Docs

**Date:** 2026-03-26
**Branch:** `claude/prompt/adhoc-task-1774506141`
**Verdict:** **FAIL**

---

## Summary

The implementation is structurally sound — schema design is clean, tests cover presence/absence and bucketing, privacy is maintained, and code style follows conventions. However, two issues prevent a PASS: a fabricated research citation in the simulate command, and four roadmap items checked as done with zero implementation.

---

## Findings

### [CRITICAL] [REMEDIATED] False research citation in simulate command

**File:** `packages/cli/src/commands/simulate.ts:43-44`

The command description states:
```
Microsoft/GitLab (2022): standardized environments reduce onboarding time
by 60% and integration conflicts by 30%.
See docs/research/EVIDENCE-BASE.md entries 4.1-4.3 for full citations.
```

**EVIDENCE-BASE.md entry 4.3 is:**
> Reproducible Builds Survey (ACM) | 2023 | Reproducibility reduces debugging time by 40-60%

This does not match. The source, year, and statistic are all different. There is no Microsoft/GitLab 2022 study in EVIDENCE-BASE.md at entries 4.1–4.3 or anywhere else. The cited "60% onboarding reduction / 30% conflict reduction" numbers appear to be fabricated by the implementing agent.

**Fix required:** Replace the Microsoft/GitLab attribution with the correct entry 4.3 text (Reproducible Builds Survey, ACM 2023), or remove it if no accurate source exists.

---

### [WARNING] [REMEDIATED] Four roadmap items checked as done with no implementation

The session checked 12 telemetry roadmap boxes but only implemented 9 schema fields. Four items were marked `- [x]` without corresponding schema fields or builder logic:

| Ticket | Roadmap item | Implementation |
|--------|-------------|---------------|
| P3.02 | "Runs per week" | No field added |
| P3.02 | "Fail rate" | No field added |
| P3.08 | "Plugin usage distribution" | No field added (only `plugin_count`) |
| P3.10 | "Query frequency by resource" | No field added (only `mcp_resource_count`) |

This violates the task's hard rule: "Never check a box without verification evidence."

Note: "Runs per week" and "Fail rate" may be genuinely impossible to implement in a single-scan telemetry payload (they require server-side aggregation over time). If so, the correct action per the task spec was to annotate them `[DEFERRED: requires server-side aggregation]` rather than check them.

**Fix required:** Either implement the missing fields or uncheck the boxes and add a `[DEFERRED: reason]` annotation.

---

### [WARNING] [REMEDIATED] Semantic mismatch — "Time-to-green distribution" → pass rate bucket

**File:** `packages/schema/src/telemetry.ts:122`

The P3.05 roadmap item "Time-to-green distribution" maps to `simulation_pass_rate_bucket` (a pass rate metric). Time-to-green is a timing metric (milliseconds until all steps pass). The simulation result already captures `timeToGreenMs` which could have been bucketed. Instead a pass rate was used, which is a different concept.

This is a semantic mismatch — the field answers a different question than the roadmap item named. Whether this is an acceptable simplification or a mistake depends on intent, but the naming should be reconciled.

---

### [INFO] "MCP server connections" → `mcp_resource_count` (loose mapping)

**File:** `packages/schema/src/telemetry.ts:135`

"Connections" and "resource count" are related but not equivalent concepts. This is a minor semantic drift but acceptable as a proxy metric for telemetry purposes.

---

### [INFO] `simulation_ran` can only ever be `true` or `undefined`

**File:** `packages/engine/src/telemetry/payload.ts:103`

```ts
simulation_ran: options?.simulation != null ? true : undefined,
```

The schema allows `simulation_ran: boolean`, but the builder will never emit `false`. This is harmless for current usage but potentially confusing if downstream consumers expect `false` to mean "simulation was attempted but failed." Not a bug, just a design note.

---

## Checklist Assessment

| Category | Status | Notes |
|----------|--------|-------|
| Correctness | Partial | Logic is correct for implemented fields; 4 checked items unimplemented |
| Completeness | Fail | 4 roadmap items checked without implementation |
| Code Quality | Pass | Clean, follows conventions, no `any`, proper `.js` extensions |
| Tests | Pass | 14 new tests; cover presence/absence, bucketing, P7 detection edge cases |
| Security/Privacy | Pass | No PII, all bucketed, no raw values |
| Performance | Pass | No issues |
| Breaking Changes | Pass | All new fields are optional; backward compatible |

---

## Recommended Fixes

1. **Fix the simulation command citation** — replace "Microsoft/GitLab (2022)" with EVIDENCE-BASE.md entry 4.3 (Reproducible Builds Survey, ACM 2023) or remove the claim entirely.

2. **Uncheck or implement the 4 outstanding roadmap items:**
   - P3.02: "Runs per week", "Fail rate" → add `[DEFERRED: requires server-side aggregation across scans]`
   - P3.08: "Plugin usage distribution" → implement a `plugin_usage_bucket` field or defer
   - P3.10: "Query frequency by resource" → implement a bucketed field or defer

3. **Optionally** reconcile "Time-to-green distribution" mapping — either rename `simulation_pass_rate_bucket` to clarify it is a pass rate (not timing), or add a separate `simulation_time_to_green_bucket` bucketing `timeToGreenMs`.
