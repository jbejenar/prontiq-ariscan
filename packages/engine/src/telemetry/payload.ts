import { randomUUID } from "node:crypto";
import { platform } from "node:os";
import type { ScanResult, TelemetryPayload } from "@prontiq/ariscan-schema";
import { scoreToBucket, fileCountToBucket } from "@prontiq/ariscan-schema";

export interface SimulationTelemetry {
  /** Number of simulation steps executed. */
  stepCount: number;
  /** Pass rate as percentage (0-100). */
  passRate: number;
  /** Prediction accuracy as percentage (0-100). */
  predictionAccuracy: number;
}

export interface TelemetryOptions {
  /** Output format used (e.g. "terminal", "json"). */
  format?: string;
  /** Whether a badge was generated. */
  badgeGenerated?: boolean;
  /** Whether the user ran with --fix. */
  fixApplied?: boolean;
  /** Whether the scan was triggered from a GitHub Action (P3.02). */
  actionUsed?: boolean;
  /** Simulation telemetry data (P3.05). */
  simulation?: SimulationTelemetry;
  /** Number of plugins loaded (P3.08). */
  pluginCount?: number;
  /** Number of MCP resources registered (P3.10). */
  mcpResourceCount?: number;
}

/**
 * Build an anonymous telemetry payload from a scan result.
 *
 * The payload contains NO PII, no repo name, no file paths, no raw scores.
 * Each scan gets a random UUID that is not persisted or linkable.
 */
export function buildTelemetryPayload(
  result: ScanResult,
  durationMs: number,
  options?: TelemetryOptions,
): TelemetryPayload {
  const primaryLangEntry = result.detection?.languages.find((l) => l.primary);
  const primaryLang = primaryLangEntry?.language ?? "unknown";
  const primaryFramework = result.detection?.frameworks[0]?.framework ?? "none";
  const fileCount = result.repoProfile?.fileCount ?? 0;

  // Aggregate finding counts by severity
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of result.findings) {
    if (f.severity in severityCounts) {
      severityCounts[f.severity as keyof typeof severityCounts]++;
    }
  }

  // Aggregate finding counts by pillar (anti-pattern category)
  const pillarCounts: Record<string, number> = {};
  for (const f of result.findings) {
    pillarCounts[f.pillar] = (pillarCounts[f.pillar] ?? 0) + 1;
  }

  // Count distinct agent context file types
  const contextFileTypes = result.contextFiles
    ? new Set(result.contextFiles.map((cf) => cf.type)).size
    : undefined;

  return {
    scan_id: randomUUID(),
    version: result.metadata.version,
    platform: platform(),
    language: primaryLang,
    framework: primaryFramework,
    repo_size_bucket: fileCountToBucket(fileCount),
    timestamp: new Date().toISOString().slice(0, 10),
    score_bucket: scoreToBucket(result.score),
    duration_ms: Math.round(durationMs),
    pillar_count: result.pillars.length,
    finding_count: result.findings.length,
    pillar_scores: result.pillars.map((p) => ({
      pillar_id: p.pillar,
      score_bucket: scoreToBucket(p.score),
    })),
    format: options?.format,
    badge_generated: options?.badgeGenerated,
    fix_applied: options?.fixApplied,
    language_count: result.detection?.languages.length,
    framework_count: result.detection?.frameworks.length,
    context_file_count: result.contextFiles?.length,
    agent_context_types: contextFileTypes,
    security_gate_triggered: result.securityGateTriggered,
    maturity_level: result.level,
    monorepo_detected: result.detection?.monorepo != null,
    detection_confidence: primaryLangEntry?.confidence,
    finding_counts_by_severity: severityCounts,
    finding_counts_by_pillar: Object.keys(pillarCounts).length > 0 ? pillarCounts : undefined,

    // Round 2 fields
    devcontainer_detected: result.devcontainerDetected,
    high_risk_test_count: result.findings.filter((f) => f.code === "ARI-TST-015").length,

    // Round 3 fields (P3 telemetry consolidation)
    action_used: options?.actionUsed,
    simulation_ran: options?.simulation != null ? true : undefined,
    simulation_step_count: options?.simulation?.stepCount,
    simulation_pass_rate_bucket: options?.simulation
      ? scoreToBucket(options.simulation.passRate)
      : undefined,
    simulation_prediction_accuracy_bucket: options?.simulation
      ? scoreToBucket(options.simulation.predictionAccuracy)
      : undefined,
    circular_dependency_detected: hasCircularDependencies(result),
    module_cohesion_bucket: moduleCohesionBucket(result),
    plugin_count: options?.pluginCount,
    mcp_resource_count: options?.mcpResourceCount,
  };
}

/** Check if any circular dependency findings exist (ARI-NAV-010). */
function hasCircularDependencies(result: ScanResult): boolean | undefined {
  const p7 = result.pillars.find((p) => p.pillar === "P7");
  if (!p7) return undefined;
  return result.findings.some((f) => f.code === "ARI-NAV-010");
}

/** Bucket the P7 navigability score as a module cohesion proxy. */
function moduleCohesionBucket(result: ScanResult): ReturnType<typeof scoreToBucket> | undefined {
  const p7 = result.pillars.find((p) => p.pillar === "P7");
  if (!p7) return undefined;
  return scoreToBucket(p7.score);
}
