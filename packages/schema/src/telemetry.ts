import { z } from "zod";

/**
 * Score bucket for anonymous telemetry — maps to maturity level ranges.
 * No raw scores are transmitted, only the bucket.
 */
export const ScoreBucket = z.enum(["0-25", "26-45", "46-65", "66-80", "81-100"]);
export type ScoreBucket = z.infer<typeof ScoreBucket>;

/** Map a numeric score to its telemetry bucket. */
export function scoreToBucket(score: number): ScoreBucket {
  if (score <= 25) return "0-25";
  if (score <= 45) return "26-45";
  if (score <= 65) return "46-65";
  if (score <= 80) return "66-80";
  return "81-100";
}

/** Per-pillar score bucket entry for telemetry. */
export const PillarScoreBucket = z.object({
  pillar_id: z.string(),
  score_bucket: ScoreBucket,
});
export type PillarScoreBucket = z.infer<typeof PillarScoreBucket>;

/**
 * Anonymous telemetry payload — contains NO PII, no repo name, no file paths.
 * Sent only when the user has explicitly opted in.
 */
export const telemetryPayloadSchema = z.object({
  /** Random UUID per scan — not persisted, not linkable across scans. */
  scan_id: z.string().uuid(),
  /** CLI version string (e.g. "0.1.0"). */
  version: z.string(),
  /** OS platform (e.g. "darwin", "linux", "win32"). */
  platform: z.string(),
  /** Primary detected language (e.g. "typescript", "python"). */
  language: z.string(),
  /** Bucketed score — never the raw numeric score. */
  score_bucket: ScoreBucket,
  /** Scan wall-clock duration in milliseconds. */
  duration_ms: z.number().int().nonnegative(),
  /** Number of pillars that ran. */
  pillar_count: z.number().int().nonnegative(),
  /** Total number of findings. */
  finding_count: z.number().int().nonnegative(),
  /** Per-pillar score buckets — no raw scores, only bucketed. */
  pillar_scores: z.array(PillarScoreBucket).optional(),
  /** Output format used (e.g. "terminal", "json", "markdown", "sarif", "ndjson"). */
  format: z.string().optional(),
  /** Whether a badge was generated. */
  badge_generated: z.boolean().optional(),
  /** Number of detected languages. */
  language_count: z.number().int().nonnegative().optional(),
  /** Number of detected frameworks. */
  framework_count: z.number().int().nonnegative().optional(),

  // --- Extended telemetry fields (P1 telemetry consolidation) ---

  /** Number of agent context files discovered (AGENTS.md, .cursorrules, etc.). */
  context_file_count: z.number().int().nonnegative().optional(),
  /** Number of distinct agent context file types (agents-md, cursorrules, etc.). */
  agent_context_types: z.number().int().nonnegative().optional(),
  /** Whether the security gate was triggered (P8 score < 40). */
  security_gate_triggered: z.boolean().optional(),
  /** Maturity level label (L1–L5). */
  maturity_level: z.string().optional(),
  /** Whether a monorepo was detected. */
  monorepo_detected: z.boolean().optional(),
  /** Primary language detection confidence (0–1). */
  detection_confidence: z.number().min(0).max(1).optional(),
  /** Finding counts grouped by severity. */
  finding_counts_by_severity: z
    .object({
      critical: z.number().int().nonnegative(),
      high: z.number().int().nonnegative(),
      medium: z.number().int().nonnegative(),
      low: z.number().int().nonnegative(),
      info: z.number().int().nonnegative(),
    })
    .optional(),
  /** Finding counts grouped by pillar (anti-pattern category). */
  finding_counts_by_pillar: z.record(z.string(), z.number().int().nonnegative()).optional(),
});
export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;
