import { z } from "zod";
import { PillarId, MaturityLevel } from "./pillar.js";

export const Severity = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof Severity>;

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

export const EstimatedImpact = z.enum(["high", "medium", "low"]);
export type EstimatedImpact = z.infer<typeof EstimatedImpact>;

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
  /** File path relevant to this remediation (e.g. file to create or modify). */
  path: z.string().optional(),
  description: z.string(),
  /**
   * Expected impact on the ARI score if remediation is applied.
   * Free-form string, conventionally formatted as "+N points composite"
   * or "+N points <pillar>".
   */
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

export const FindingApplicability = z.enum(["applicable", "not-applicable"]);
export type FindingApplicability = z.infer<typeof FindingApplicability>;

export const ScoreImpact = z.object({
  /** Points this finding costs the pillar score (positive = points recoverable by fixing). */
  pillarDelta: z.number(),
  /** Estimated composite score improvement if fixed: pillarDelta × pillarWeight / effectiveWeightSum. */
  compositeDelta: z.number(),
});
export type ScoreImpact = z.infer<typeof ScoreImpact>;

export const Finding = z.object({
  code: z.string().regex(/^ARI-[A-Z]{3}-\d{3}$/),
  severity: Severity,
  pillar: PillarId,
  file: z.string().optional(),
  line: z.number().optional(),
  message: z.string(),
  /**
   * How confident we are in this finding.
   * - high: binary detection from config files (strict mode on/off, file presence).
   * - medium: heuristic analysis with known accuracy bounds (naming, patterns).
   * - low: inference from indirect signals (script names, import patterns).
   */
  confidence: Confidence.optional(),
  remediation: Remediation.optional(),
  evidence: Evidence.optional(),
  /** When true, the finding was matched by a policy suppression and excluded from scoring. */
  suppressed: z.boolean().optional(),
  /** Whether this finding is applicable to the repo's archetype profile. */
  applicability: FindingApplicability.optional(),
  /** Quantified score impact: how many points fixing this finding would recover. */
  scoreImpact: ScoreImpact.optional(),
});
export type Finding = z.infer<typeof Finding>;

/** A finding attributed to a plugin source. */
export const PluginFinding = Finding.extend({
  /** Source attribution: "plugin:<name>". */
  source: z.string(),
});
export type PluginFinding = z.infer<typeof PluginFinding>;

export const PillarStatus = z.enum(["excellent", "good", "needs-improvement", "poor"]);
export type PillarStatus = z.infer<typeof PillarStatus>;

export const DataStatus = z.enum(["sufficient", "insufficient", "partial"]);
export type DataStatus = z.infer<typeof DataStatus>;

/**
 * Derive a status label from a numeric score.
 *   >= 80 → "excellent"
 *   >= 60 → "good"
 *   >= 40 → "needs-improvement"
 *   <  40 → "poor"
 */
export function scoreToStatus(score: number): PillarStatus {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "needs-improvement";
  return "poor";
}

export const PillarResult = z.object({
  pillar: PillarId,
  name: z.string(),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  confidence: Confidence,
  findings: z.array(Finding),
  summary: z.string(),
  status: PillarStatus.optional(),
  /** Research papers/sources that justify this pillar's weighting and scoring criteria. */
  researchBasis: z.array(z.string()).optional(),
  /**
   * Whether the analyzer had sufficient input data to produce a meaningful score.
   * - "sufficient": normal scoring (default when omitted).
   * - "insufficient": minimum input threshold not met; pillar excluded from composite.
   * - "partial": some data available but below ideal; pillar still scored.
   */
  dataStatus: DataStatus.optional(),
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

export const ContextFileType = z.enum([
  "agents-md",
  "claude-md",
  "cursorrules",
  "copilot-instructions",
  "aider-config",
  "agentignore",
  "mcp-config",
  "other",
]);
export type ContextFileType = z.infer<typeof ContextFileType>;

/** Metadata about a discovered context file in the target repository. */
export const ParseStatus = z.enum(["valid", "warning", "error"]);
export type ParseStatus = z.infer<typeof ParseStatus>;

export const ContextFileInfo = z.object({
  /** Relative path within the repo. */
  path: z.string(),
  /** Classified type of the context file. */
  type: ContextFileType,
  /** File size in bytes. */
  size: z.number().optional(),
  /** Number of lines in the file. */
  lineCount: z.number().optional(),
  /** ISO 8601 timestamp of last modification. */
  lastModified: z.string().datetime().optional(),
  /** Whether the file content parsed without issues. */
  parseStatus: ParseStatus.optional(),
});
export type ContextFileInfo = z.infer<typeof ContextFileInfo>;

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

export const BuildSystem = z.enum([
  "npm",
  "pnpm",
  "yarn",
  "make",
  "docker-compose",
  "poetry",
  "cargo",
  "go",
  "maven",
  "gradle",
]);
export type BuildSystem = z.infer<typeof BuildSystem>;

export const DetectionResult = z.object({
  languages: z.array(DetectedLanguage),
  frameworks: z.array(DetectedFramework),
  monorepo: DetectedMonorepo.nullable(),
  buildSystems: z.array(BuildSystem).optional(),
});
export type DetectionResult = z.infer<typeof DetectionResult>;

export const Archetype = z.enum([
  "solo-hobby",
  "small-team",
  "library",
  "api-service",
  "cli-tool",
  "monorepo-enterprise",
]);
export type Archetype = z.infer<typeof Archetype>;

export const RepoProfile = z.object({
  /** Classified archetype of the repository. */
  archetype: Archetype,
  /** Confidence in the classification. */
  confidence: Confidence,
  /** Detection signals that contributed to the classification. */
  signals: z.array(z.string()),
  /** Total number of files in the repository. */
  fileCount: z.number(),
  /** Number of source code files (known extensions). */
  sourceFileCount: z.number(),
  /** Whether CI configuration was detected. */
  hasCI: z.boolean(),
});
export type RepoProfile = z.infer<typeof RepoProfile>;

export const ScoreBreakdown = z.object({
  /** Number of pillars with sufficient or partial data (included in composite). */
  activePillars: z.number(),
  /** Number of pillars with insufficient data (excluded from composite). */
  insufficientPillars: z.number(),
  /** Sum of weights of active pillars (used as denominator for composite). */
  effectiveWeightSum: z.number(),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdown>;

export const ScanResult = z.object({
  metadata: ScanMetadata,
  score: z.number().min(0).max(100),
  level: MaturityLevel,
  levelMeta: LevelMeta,
  securityGateTriggered: z.boolean(),
  pillars: z.array(PillarResult),
  findings: z.array(Finding),
  detection: DetectionResult.optional(),
  /** Discovered context files in the scanned repository. */
  contextFiles: z.array(ContextFileInfo).optional(),
  /** Whether a devcontainer configuration was detected in the repository. */
  devcontainerDetected: z.boolean().optional(),
  /** Breakdown of active vs insufficient pillars and effective weight sum. */
  scoreBreakdown: ScoreBreakdown.optional(),
  /** Classified repository profile (archetype, confidence, signals). */
  repoProfile: RepoProfile.optional(),
  /** Language profile applied for weight adjustment (P3.06). */
  languageProfile: z.string().optional(),
  /** Calibration offset applied for cross-language score comparability (P3.06). */
  calibrationOffset: z.number().optional(),
  /** Findings from plugins, attributed separately from core findings (P3.08). */
  pluginFindings: z.array(PluginFinding).optional(),
  /** Errors from plugin loading/execution, surfaced for observability (P3.08). */
  pluginErrors: z.array(z.object({ pluginName: z.string(), error: z.string() })).optional(),
});
export type ScanResult = z.infer<typeof ScanResult>;
