import { z } from "zod";

/**
 * Schema version following semver:
 *   patch = new optional fields only
 *   minor = new pillar/criterion, new finding codes, new output fields
 *   major = removing/renaming fields, changing score semantics, breaking changes
 *
 * Backwards compatibility is guaranteed within a major version.
 */
export const SCHEMA_VERSION = "1.0.0";

export const PillarId = z.enum(["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]);
export type PillarId = z.infer<typeof PillarId>;

export const PILLAR_NAMES: Record<PillarId, string> = {
  P1: "Agent Context Quality",
  P2: "Feedback Loop Speed",
  P3: "Test Isolation",
  P4: "Dev Environment",
  P5: "Doc Machine-Readability",
  P6: "Build Determinism & Type Safety",
  P7: "Code Navigability",
  P8: "Security & Governance",
};

export const PILLAR_WEIGHTS: Record<PillarId, number> = {
  P1: 0.15,
  P2: 0.15,
  P3: 0.18,
  P4: 0.1,
  P5: 0.1,
  P6: 0.15,
  P7: 0.12,
  P8: 0.05,
};

export const PillarDefinition = z.object({
  id: PillarId,
  name: z.string(),
  weight: z.number().min(0).max(1),
  description: z.string(),
  isGate: z.boolean().default(false),
  gateThreshold: z.number().min(0).max(100).optional(),
  gateCap: z.lazy(() => MaturityLevel).optional(),
});
export type PillarDefinition = z.infer<typeof PillarDefinition>;

export const MaturityLevel = z.enum(["L1", "L2", "L3", "L4", "L5"]);
export type MaturityLevel = z.infer<typeof MaturityLevel>;

export const MATURITY_NAMES: Record<MaturityLevel, string> = {
  L1: "Hostile",
  L2: "Fragile",
  L3: "Capable",
  L4: "Productive",
  L5: "Autonomous",
};

export const MATURITY_THRESHOLDS: Record<MaturityLevel, { min: number; max: number }> = {
  L1: { min: 0, max: 25 },
  L2: { min: 26, max: 45 },
  L3: { min: 46, max: 65 },
  L4: { min: 66, max: 80 },
  L5: { min: 81, max: 100 },
};

export const SECURITY_GATE = {
  pillar: "P8" as const,
  threshold: 40,
  cap: "L2" as const,
} as const;
