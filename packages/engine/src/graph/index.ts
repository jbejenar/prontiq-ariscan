export type {
  ImportInfo,
  ModuleNode,
  DependencyGraph,
  CyclePath,
  FanMetrics,
  CohesionMetrics,
  BoundaryViolation,
  GraphMetrics,
} from "./types.js";

export {
  extractImports,
  detectExtractorLanguage,
  resolveRelativeImport,
} from "./import-extractor.js";
export { buildDependencyGraph } from "./graph-builder.js";
export type { GraphBuildOptions } from "./graph-builder.js";
export {
  findCycles,
  computeFanMetrics,
  computeCohesion,
  detectBoundaryViolations,
  computeStructuralClarity,
  analyzeGraph,
} from "./graph-analyzer.js";
export { generateDotGraph } from "./dot-formatter.js";
export type { DotFormatOptions } from "./dot-formatter.js";
