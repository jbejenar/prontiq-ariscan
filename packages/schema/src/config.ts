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
  format: z.enum(["terminal", "json", "sarif", "markdown"]).default("terminal"),
  output: z.string().optional(),
  verbose: z.boolean().default(false),
  quiet: z.boolean().default(false),
  pillars: z.record(PillarId, PillarOverride).optional(),
  exclude: z.array(z.string()).default([]),
  include: z.array(z.string()).optional(),
});
export type ScanConfig = z.infer<typeof ScanConfig>;
