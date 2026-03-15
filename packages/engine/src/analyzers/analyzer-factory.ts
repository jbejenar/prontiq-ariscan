import type { PillarId } from "@prontiq/ariscan-schema";
import type { PillarAnalyzer } from "./analyzer.interface.js";
import { ANALYZERS } from "./registry.js";

/**
 * Options for creating an analyzer pipeline.
 */
export interface AnalyzerPipelineOptions {
  /** Include only these pillars (default: all) */
  readonly include?: readonly PillarId[];
  /** Exclude these pillars from the pipeline */
  readonly exclude?: readonly PillarId[];
}

/**
 * Factory function to create a filtered analyzer pipeline.
 *
 * Returns the subset of registered analyzers matching the given options.
 * When both `include` and `exclude` are specified, `include` is applied first,
 * then `exclude` removes from the included set.
 */
export function createAnalyzerPipeline(
  options: AnalyzerPipelineOptions = {},
): readonly PillarAnalyzer[] {
  const { include, exclude } = options;

  let pipeline: readonly PillarAnalyzer[] = ANALYZERS;

  if (include && include.length > 0) {
    const includeSet = new Set<PillarId>(include);
    pipeline = pipeline.filter((a) => includeSet.has(a.pillar));
  }

  if (exclude && exclude.length > 0) {
    const excludeSet = new Set<PillarId>(exclude);
    pipeline = pipeline.filter((a) => !excludeSet.has(a.pillar));
  }

  return pipeline;
}
