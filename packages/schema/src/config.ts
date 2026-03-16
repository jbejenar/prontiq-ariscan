import { z } from "zod";
import { PillarId, MaturityLevel } from "./pillar.js";

export const PillarOverride = z.object({
  weight: z.number().min(0).max(1).optional(),
  threshold: z.number().min(0).max(100).optional(),
  enabled: z.boolean().default(true),
});
export type PillarOverride = z.infer<typeof PillarOverride>;

export const ScanConfig = z.object({
  threshold: z.number().min(0).max(100).default(0),
  targetLevel: MaturityLevel.optional(),
  format: z.enum(["terminal", "json", "ndjson", "sarif", "markdown"]).default("terminal"),
  output: z.string().optional(),
  verbose: z.boolean().default(false),
  quiet: z.boolean().default(false),
  pillars: z.record(z.string(), PillarOverride).optional(),
  exclude: z.array(z.string()).default([]),
  include: z.array(z.string()).optional(),
  suppressions: z.array(z.lazy(() => Suppression)).optional(),
});
export type ScanConfig = z.infer<typeof ScanConfig>;

/* ─── Policy config types (P3.01) ─── */

export const EnforcementMode = z.enum(["warn", "fail", "block"]);
export type EnforcementMode = z.infer<typeof EnforcementMode>;

export const Suppression = z.object({
  code: z.string().regex(/^ARI-[A-Z]{3}-\d{3}$/),
  reason: z.string().min(1),
  expiry: z.union([z.string().date(), z.literal("no-expiry")]),
  approver: z.string().optional(),
});
export type Suppression = z.infer<typeof Suppression>;

export const PillarThresholds = z.object({
  composite: z.number().min(0).max(100).optional(),
  pillars: z.record(z.string(), z.number().min(0).max(100)).optional(),
});
export type PillarThresholds = z.infer<typeof PillarThresholds>;

export const PolicyProfile = z.object({
  name: z.string().min(1),
  thresholds: PillarThresholds.optional(),
  weights: z.record(z.string(), z.number().min(0).max(1)).optional(),
});
export type PolicyProfile = z.infer<typeof PolicyProfile>;

export const PathRule = z.object({
  pattern: z.string().min(1),
  thresholds: PillarThresholds.optional(),
  enforcement: EnforcementMode.optional(),
});
export type PathRule = z.infer<typeof PathRule>;

/**
 * Schema for `.ariscan.yml` policy config file.
 * Backward-compatible: `threshold` (flat number) still works as shorthand
 * for `thresholds.composite`.
 */
export const FileConfig = z.object({
  version: z.string().optional(),
  extends: z.string().optional(),
  enforcement: EnforcementMode.optional(),
  threshold: z.number().min(0).max(100).optional(),
  thresholds: PillarThresholds.optional(),
  format: z.enum(["terminal", "json", "ndjson", "sarif", "markdown"]).optional(),
  pillars: z
    .object({
      exclude: z.array(PillarId).optional(),
      weights: z.record(z.string(), z.number().min(0).max(1)).optional(),
    })
    .optional(),
  suppressions: z.array(Suppression).optional(),
  profiles: z.record(z.string(), PolicyProfile).optional(),
  activeProfile: z.string().optional(),
  paths: z.array(PathRule).optional(),
});
export type FileConfig = z.infer<typeof FileConfig>;
