import { randomUUID } from "node:crypto";
import { platform } from "node:os";
import type { ScanResult, TelemetryPayload } from "@prontiq/ariscan-schema";
import { scoreToBucket } from "@prontiq/ariscan-schema";

export interface TelemetryOptions {
  /** Output format used (e.g. "terminal", "json"). */
  format?: string;
  /** Whether a badge was generated. */
  badgeGenerated?: boolean;
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

  // Aggregate finding counts by severity
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of result.findings) {
    if (f.severity in severityCounts) {
      severityCounts[f.severity as keyof typeof severityCounts]++;
    }
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
    language_count: result.detection?.languages.length,
    framework_count: result.detection?.frameworks.length,
    context_file_count: result.contextFiles?.length,
    agent_context_types: contextFileTypes,
    security_gate_triggered: result.securityGateTriggered,
    maturity_level: result.level,
    monorepo_detected: result.detection?.monorepo != null,
    detection_confidence: primaryLangEntry?.confidence,
    finding_counts_by_severity: severityCounts,
  };
}
