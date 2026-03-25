export { scan } from "./scan.js";
export type { ScanProgressEvent, OnProgress } from "./scan.js";
export { createRepoContext } from "./context/repo-context.js";
export { ANALYZERS, getAnalyzer } from "./analyzers/registry.js";
export { createAnalyzerPipeline } from "./analyzers/analyzer-factory.js";
export type { AnalyzerPipelineOptions } from "./analyzers/analyzer-factory.js";
export {
  calculateCompositeScore,
  computeScoreBreakdown,
  classifyMaturityLevel,
  applySecurityGate,
  aggregateResults,
  annotateCompositeDelta,
} from "./scoring/composite.js";
export {
  getNotApplicableCodes,
  annotateApplicability,
  adjustPillarResults,
  countNotApplicable,
} from "./scoring/applicability.js";
export { adaptPillarRemediation } from "./scoring/remediation-adapter.js";
export type { PillarAnalyzer, RepoContext } from "./analyzers/analyzer.interface.js";
export {
  detect,
  detectLanguages,
  detectFrameworks,
  detectMonorepo,
  detectBuildSystems,
  classifyProfile,
} from "./detection/index.js";
export {
  analyzeTokenBudget,
  formatTokenCount,
  classifyFile,
  estimateTokens,
} from "./budget/index.js";
export type {
  FileCategory,
  FileTokenEstimate,
  CategoryBudget,
  CompressionRecommendation,
  TokenBudgetResult,
} from "./budget/index.js";
export { generateFixProposals } from "./fix/index.js";
export type { FixProposal, FixConfidence, TemplateMetadata } from "./fix/index.js";
export {
  parseAgentignore,
  matchesPattern,
  shouldIgnore,
  getDefaultPatterns,
} from "./agentignore/index.js";
export type { AgentignoreRule, AgentignoreFile, AgentignoreCategory } from "./agentignore/index.js";
export {
  getTelemetryConsent,
  setTelemetryConsent,
  readConsentFile,
  buildTelemetryPayload,
  sendTelemetry,
} from "./telemetry/index.js";
export { analyzeGaps, generateContextFiles, diffContext } from "./context/index.js";
export type {
  GapAnalysisResult,
  GapItem,
  InfoCategory,
  IndexedDoc,
  GenerateResult,
  GeneratedContextFile,
  DiffResult,
  ContextFileDiff,
  DiffSegment,
  DeduplicationRecommendation,
  SegmentClass,
} from "./context/index.js";
export { auditAgentsMd, auditContextFile, discoverContextFiles } from "./audit/index.js";
export {
  getPillarsByProfile,
  getChangedFiles,
  getChangedFilesFromBase,
  loadBaseline,
  saveBaseline,
  computeDelta,
  getBaselineCacheDir,
  runCheck,
} from "./check/index.js";
export type { PillarDelta, DeltaResult, CheckOptions, CheckResult } from "./check/index.js";
export type { AuditResult, AuditIssue, DimensionScore, IssueSeverity } from "./audit/index.js";
export { LANGUAGE_PROFILES, getLanguageProfile, resolveLanguageProfile } from "./profiles/index.js";
export type { LanguageProfileDef } from "./profiles/index.js";
