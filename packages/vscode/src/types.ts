/**
 * Minimal type definitions for ARI scan results.
 *
 * These mirror the Zod schemas in @prontiq/ariscan-schema but are
 * plain interfaces — the extension loads JSON reports without Zod
 * validation to avoid bundling the schema package.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type PillarId = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8";

export type MaturityLevel = "L1" | "L2" | "L3" | "L4" | "L5";

export interface Finding {
  code: string;
  severity: Severity;
  pillar: PillarId;
  file?: string;
  line?: number;
  message: string;
  confidence?: "high" | "medium" | "low";
  remediation?: {
    action: string;
    path?: string;
    description: string;
    estimatedImpact?: string;
    confidence: "high" | "medium" | "low";
  };
  suppressed?: boolean;
  scoreImpact?: {
    pillarDelta: number;
    compositeDelta: number;
  };
}

export interface PillarResult {
  pillar: PillarId;
  name: string;
  score: number;
  weight: number;
  confidence: "high" | "medium" | "low";
  findings: Finding[];
  summary: string;
  status?: "excellent" | "good" | "needs-improvement" | "poor";
}

export interface LevelMeta {
  level: MaturityLevel;
  name: string;
  description: string;
}

export interface ScanResult {
  metadata: {
    version: string;
    timestamp: string;
    duration: number;
    repoPath: string;
  };
  score: number;
  level: MaturityLevel;
  levelMeta: LevelMeta;
  securityGateTriggered: boolean;
  pillars: PillarResult[];
  findings: Finding[];
  languageProfile?: string;
}
