import { randomUUID } from "node:crypto";
import { platform } from "node:os";
import type { ScanResult, TelemetryPayload } from "@prontiq/ariscan-schema";
import { scoreToBucket } from "@prontiq/ariscan-schema";

/**
 * Build an anonymous telemetry payload from a scan result.
 *
 * The payload contains NO PII, no repo name, no file paths, no raw scores.
 * Each scan gets a random UUID that is not persisted or linkable.
 */
export function buildTelemetryPayload(result: ScanResult, durationMs: number): TelemetryPayload {
  const primaryLang = result.detection?.languages.find((l) => l.primary)?.language ?? "unknown";

  return {
    scan_id: randomUUID(),
    version: result.metadata.version,
    platform: platform(),
    language: primaryLang,
    score_bucket: scoreToBucket(result.score),
    duration_ms: Math.round(durationMs),
    pillar_count: result.pillars.length,
    finding_count: result.findings.length,
  };
}
