/**
 * Shared policy enforcement logic — used by both the root CLI scan path
 * and the exported scan subcommand so that enforcement behavior is identical
 * regardless of how a scan is invoked.
 */
import { PILLAR_NAMES } from "@prontiq/ariscan-schema";
import type { ScanResult } from "@prontiq/ariscan-schema";
import type { ResolvedPolicyMeta } from "./config-loader.js";

/**
 * Apply enforcement mode: check composite + per-pillar thresholds and exit accordingly.
 * - warn: print warnings, exit 0
 * - fail/block: print warnings, exit 1 if any violation
 */
export function applyEnforcement(
  result: ScanResult,
  compositeThreshold: number,
  policyMeta: ResolvedPolicyMeta,
): void {
  const enforcement = policyMeta.enforcement ?? "fail";
  const violations: string[] = [];

  // Check composite threshold
  if (compositeThreshold > 0 && result.score < compositeThreshold) {
    violations.push(`Composite score ${result.score} is below threshold ${compositeThreshold}`);
  }

  // Check per-pillar thresholds
  if (policyMeta.pillarThresholds) {
    for (const [pillarId, threshold] of Object.entries(policyMeta.pillarThresholds)) {
      const pillarResult = result.pillars.find((p) => p.pillar === pillarId);
      if (pillarResult && pillarResult.score < threshold) {
        const name = PILLAR_NAMES[pillarResult.pillar] ?? pillarId;
        violations.push(
          `${pillarId} (${name}) score ${pillarResult.score} is below threshold ${threshold}`,
        );
      }
    }
  }

  if (violations.length === 0) return;

  for (const v of violations) {
    process.stderr.write(`${enforcement === "warn" ? "Warning" : "Error"}: ${v}\n`);
  }

  if (enforcement === "fail" || enforcement === "block") {
    process.exit(1);
  }
}
