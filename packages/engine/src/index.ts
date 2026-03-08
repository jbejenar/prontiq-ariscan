export { scan } from "./scan.js";
export { createRepoContext } from "./context/repo-context.js";
export { ANALYZERS, getAnalyzer } from "./analyzers/registry.js";
export {
  calculateCompositeScore,
  classifyMaturityLevel,
  applySecurityGate,
  aggregateResults,
} from "./scoring/composite.js";
export type { PillarAnalyzer, RepoContext } from "./analyzers/analyzer.interface.js";
export { detect, detectLanguages, detectFrameworks, detectMonorepo } from "./detection/index.js";
