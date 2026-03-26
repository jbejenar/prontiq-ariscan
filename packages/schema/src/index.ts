export {
  SCHEMA_VERSION,
  PillarId,
  PillarDefinition,
  MaturityLevel,
  PILLAR_NAMES,
  PILLAR_WEIGHTS,
  MATURITY_NAMES,
  MATURITY_THRESHOLDS,
  SECURITY_GATE,
} from "./pillar.js";

export {
  Severity,
  Confidence,
  EstimatedImpact,
  Remediation,
  Evidence,
  Finding,
  PillarStatus,
  scoreToStatus,
  PillarResult,
  ScanMetadata,
  LevelMeta,
  ContextFileType,
  ParseStatus,
  ContextFileInfo,
  DataStatus,
  ScoreBreakdown,
  Archetype,
  FindingApplicability,
  ScoreImpact,
  RepoProfile,
  ScanResult,
  DetectedLanguage,
  DetectedFramework,
  DetectedMonorepo,
  BuildSystem,
  DetectionResult,
} from "./scan-result.js";

export {
  PillarOverride,
  ScanConfig,
  FileConfig,
  EnforcementMode,
  Suppression,
  PillarThresholds,
  PolicyProfile,
  PathRule,
  CheckProfile,
  SupportedLanguage,
} from "./config.js";

export {
  ScoreBucket,
  scoreToBucket,
  RepoSizeBucket,
  fileCountToBucket,
  PillarScoreBucket,
  telemetryPayloadSchema,
} from "./telemetry.js";
export type { TelemetryPayload } from "./telemetry.js";

export {
  PLUGIN_API_VERSION,
  PluginManifest,
  PluginFinding,
  PluginAnalysisResult,
  PluginConfig,
} from "./plugin.js";

export {
  SimulationStepId,
  SimulationStepStatus,
  SimulationStepResult,
  PredictionComparison,
  IsolationMode,
  SimulationResult,
  SimulationProfile,
  DEFAULT_SIMULATION_PROFILE,
} from "./simulate.js";
