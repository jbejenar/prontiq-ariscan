import type { ScanResult, ScanConfig } from "@prontiq/schema";
import { ANALYZERS } from "./analyzers/registry.js";
import { createRepoContext } from "./context/repo-context.js";
import { aggregateResults } from "./scoring/composite.js";
import { detect } from "./detection/index.js";

const VERSION = "0.1.0";

/**
 * Pure function: scan a repository and produce an ARI score.
 * This is the core entry point for the scanning engine.
 */
export async function scan(
  repoPath: string,
  config: Partial<ScanConfig> = {},
): Promise<ScanResult> {
  const startTime = performance.now();

  const context = await createRepoContext(repoPath);

  // Run detection BEFORE analyzers so results are available
  const detection = await detect(context);

  // Filter analyzers by pillar config (only run enabled pillars)
  let activeAnalyzers = ANALYZERS;
  if (config.pillars) {
    const pillarConfig = config.pillars;
    activeAnalyzers = ANALYZERS.filter((analyzer) => {
      const override = pillarConfig[analyzer.pillar];
      // If pillar is explicitly configured, respect its enabled flag
      if (override && override.enabled === false) return false;
      return true;
    });
  }

  // Run analyzers in parallel (RFC-0003)
  const supportChecks = await Promise.all(
    activeAnalyzers.map(async (analyzer) => ({
      analyzer,
      supported: await analyzer.supports(context),
    })),
  );

  const pillarResults = await Promise.all(
    supportChecks
      .filter(({ supported }) => supported)
      .map(({ analyzer }) => analyzer.analyze(context)),
  );

  const duration = Math.round(performance.now() - startTime);

  const result = aggregateResults(pillarResults, {
    version: VERSION,
    repoPath,
    duration,
  });

  return { ...result, detection };
}
