export { analyzeGaps } from "./gap-analysis.js";
export type { GapAnalysisResult, GapItem, InfoCategory, IndexedDoc } from "./gap-analysis.js";

export { generateContextFiles } from "./generator.js";
export type { GenerateResult, GeneratedContextFile } from "./generator.js";

export {
  computeAdditionality,
  computeFrontLoadScore,
  normalizeForComparison,
  splitSegments,
  jaccardSimilarity,
  hasBuriedCriticalInfo,
} from "./additionality.js";
export type { AdditionalityResult, ReferenceDoc } from "./additionality.js";
