import type { ScanResult } from "@prontiq/ariscan-schema";

/** Extract composite score, maturity level, and metadata from a scan result. */
export function extractScore(result: ScanResult): {
  score: number;
  level: string;
  levelMeta: { level: string; name: string; description: string };
  securityGateTriggered: boolean;
  metadata: {
    version: string;
    timestamp: string;
    duration: number;
    repoPath: string;
  };
  scoreBreakdown?: {
    activePillars: number;
    insufficientPillars: number;
    effectiveWeightSum: number;
  };
} {
  return {
    score: result.score,
    level: result.level,
    levelMeta: result.levelMeta,
    securityGateTriggered: result.securityGateTriggered,
    metadata: {
      version: result.metadata.version,
      timestamp: result.metadata.timestamp,
      duration: result.metadata.duration,
      repoPath: result.metadata.repoPath,
    },
    ...(result.scoreBreakdown ? { scoreBreakdown: result.scoreBreakdown } : {}),
  };
}
