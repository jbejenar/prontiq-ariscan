import { z } from "zod";
import { PillarId, MaturityLevel } from "./pillar.js";

export const Severity = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof Severity>;

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

export const Remediation = z.object({
  action: z.enum([
    "create-file",
    "modify-config",
    "add-dependency",
    "remove-dependency",
    "refactor",
    "add-script",
    "configure-tool",
  ]),
  path: z.string().optional(),
  description: z.string(),
  estimatedImpact: z.string().optional(),
  confidence: Confidence,
});
export type Remediation = z.infer<typeof Remediation>;

export const Evidence = z.object({
  paper: z.string(),
  finding: z.string(),
  confidence: Confidence,
});
export type Evidence = z.infer<typeof Evidence>;

export const Finding = z.object({
  code: z.string().regex(/^ARI-[A-Z]{3}-\d{3}$/),
  severity: Severity,
  pillar: PillarId,
  file: z.string().optional(),
  line: z.number().optional(),
  message: z.string(),
  remediation: Remediation.optional(),
  evidence: Evidence.optional(),
});
export type Finding = z.infer<typeof Finding>;

export const PillarResult = z.object({
  pillar: PillarId,
  name: z.string(),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  confidence: Confidence,
  findings: z.array(Finding),
  summary: z.string(),
});
export type PillarResult = z.infer<typeof PillarResult>;

export const ScanMetadata = z.object({
  version: z.string(),
  timestamp: z.string().datetime(),
  duration: z.number(),
  repoPath: z.string(),
  rubricVersion: z.string().default("v1"),
});
export type ScanMetadata = z.infer<typeof ScanMetadata>;

export const LevelMeta = z.object({
  level: MaturityLevel,
  name: z.string(),
  description: z.string(),
});
export type LevelMeta = z.infer<typeof LevelMeta>;

export const DetectedLanguage = z.object({
  language: z.string(),
  confidence: z.number().min(0).max(1),
  primary: z.boolean(),
});
export type DetectedLanguage = z.infer<typeof DetectedLanguage>;

export const DetectedFramework = z.object({
  framework: z.string(),
  confidence: z.number().min(0).max(1),
});
export type DetectedFramework = z.infer<typeof DetectedFramework>;

export const DetectedMonorepo = z.object({
  tool: z.string(),
  workspaceRoot: z.string(),
  packages: z.array(z.string()),
});
export type DetectedMonorepo = z.infer<typeof DetectedMonorepo>;

export const DetectionResult = z.object({
  languages: z.array(DetectedLanguage),
  frameworks: z.array(DetectedFramework),
  monorepo: DetectedMonorepo.nullable(),
});
export type DetectionResult = z.infer<typeof DetectionResult>;

export const ScanResult = z.object({
  metadata: ScanMetadata,
  score: z.number().min(0).max(100),
  level: MaturityLevel,
  levelMeta: LevelMeta,
  securityGateTriggered: z.boolean(),
  pillars: z.array(PillarResult),
  findings: z.array(Finding),
  detection: DetectionResult.optional(),
});
export type ScanResult = z.infer<typeof ScanResult>;
