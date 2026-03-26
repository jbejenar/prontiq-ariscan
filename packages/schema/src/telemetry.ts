import { z } from "zod";

/**
 * Score bucket for anonymous telemetry — 5-band bucketing per P2.13 spec.
 * No raw scores are transmitted, only the bucket.
 */
export const ScoreBucket = z.enum(["0-20", "21-40", "41-60", "61-80", "81-100"]);
export type ScoreBucket = z.infer<typeof ScoreBucket>;

/** Map a numeric score to its telemetry bucket (P2.13 spec bands). */
export function scoreToBucket(score: number): ScoreBucket {
  if (score <= 20) return "0-20";
  if (score <= 40) return "21-40";
  if (score <= 60) return "41-60";
  if (score <= 80) return "61-80";
  return "81-100";
}

/** Repo size bucket — bucketed file count, never exact. */
export const RepoSizeBucket = z.enum(["small", "medium", "large", "xlarge"]);
export type RepoSizeBucket = z.infer<typeof RepoSizeBucket>;

/** Map a file count to a size bucket (P2.13 spec). */
export function fileCountToBucket(count: number): RepoSizeBucket {
  if (count <= 50) return "small";
  if (count <= 500) return "medium";
  if (count <= 5000) return "large";
  return "xlarge";
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
  /** Primary detected framework (e.g. "react", "express"). */
  framework: z.string(),
  /** Repo size bucket — file count bucketed as small/medium/large/xlarge, never exact. */
  repo_size_bucket: RepoSizeBucket,
  /** ISO 8601 date at day precision only — no time, no timezone (e.g. "2026-03-26"). */
  timestamp: z.string(),
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
  /** Whether the user ran with --fix. */
  fix_applied: z.boolean().optional(),
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

  // --- Round 2 telemetry fields ---

  /** Whether a devcontainer configuration was detected. */
  devcontainer_detected: z.boolean().optional(),
  /** Number of test files flagged as high flakiness-transfer risk. */
  high_risk_test_count: z.number().int().nonnegative().optional(),

  // --- Round 3 telemetry fields (P3 telemetry consolidation) ---

  /** P3.02 — Whether the scan was triggered from a GitHub Action. */
  action_used: z.boolean().optional(),

  /** P3.05 — Whether the simulate subcommand was executed. */
  simulation_ran: z.boolean().optional(),
  /** P3.05 — Number of simulation steps executed. */
  simulation_step_count: z.number().int().nonnegative().optional(),
  /** P3.05 — Bucketed simulation pass rate (steps passed / steps run). */
  simulation_pass_rate_bucket: ScoreBucket.optional(),
  /** P3.05 — Bucketed prediction accuracy (static vs simulation agreement). */
  simulation_prediction_accuracy_bucket: ScoreBucket.optional(),

  /** P3.07 — Whether circular dependencies were detected by graph analysis. */
  circular_dependency_detected: z.boolean().optional(),
  /** P3.07 — Bucketed module cohesion score from P7 navigability analysis. */
  module_cohesion_bucket: ScoreBucket.optional(),

  /** P3.08 — Number of plugins loaded (0 if none). */
  plugin_count: z.number().int().nonnegative().optional(),

  /** P3.10 — Number of MCP resources registered. */
  mcp_resource_count: z.number().int().nonnegative().optional(),
});
export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;
