import type { PillarAnalyzer } from "./analyzer.interface.js";
import type { PillarId } from "@prontiq/ariscan-schema";
import { contextQualityAnalyzer } from "./context-quality.js";
import { feedbackLoopAnalyzer } from "./feedback-loop.js";
import { testIsolationAnalyzer } from "./test-isolation.js";
import { devEnvironmentAnalyzer } from "./dev-environment.js";
import { docReadabilityAnalyzer } from "./doc-readability.js";
import { buildDeterminismAnalyzer } from "./build-determinism.js";
import { navigabilityAnalyzer } from "./navigability.js";
import { securityGovernanceAnalyzer } from "./security-governance.js";

/**
 * Registry of all built-in pillar analyzers.
 */
export const ANALYZERS: readonly PillarAnalyzer[] = [
  contextQualityAnalyzer,
  feedbackLoopAnalyzer,
  testIsolationAnalyzer,
  devEnvironmentAnalyzer,
  docReadabilityAnalyzer,
  buildDeterminismAnalyzer,
  navigabilityAnalyzer,
  securityGovernanceAnalyzer,
];

/**
 * Get an analyzer by pillar ID.
 */
export function getAnalyzer(pillar: PillarId): PillarAnalyzer | undefined {
  return ANALYZERS.find((a) => a.pillar === pillar);
}
