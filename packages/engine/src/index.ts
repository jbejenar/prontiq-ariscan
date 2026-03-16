export { scan } from "./scan.js";
export type { ScanProgressEvent, OnProgress } from "./scan.js";
export { createRepoContext } from "./context/repo-context.js";
export { ANALYZERS, getAnalyzer } from "./analyzers/registry.js";
export { createAnalyzerPipeline } from "./analyzers/analyzer-factory.js";
export type { AnalyzerPipelineOptions } from "./analyzers/analyzer-factory.js";
export {
  calculateCompositeScore,
  classifyMaturityLevel,
  applySecurityGate,
  aggregateResults,
} from "./scoring/composite.js";
export type { PillarAnalyzer, RepoContext } from "./analyzers/analyzer.interface.js";
export { detect, detectLanguages, detectFrameworks, detectMonorepo } from "./detection/index.js";
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
