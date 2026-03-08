import {
  type PillarResult,
  type ScanResult,
  type MaturityLevel,
  type LevelMeta,
  PILLAR_WEIGHTS,
  MATURITY_THRESHOLDS,
  MATURITY_NAMES,
  SECURITY_GATE,
} from "@prontiq/schema";

/**
 * Calculate the composite ARI score from pillar results.
 */
export function calculateCompositeScore(pillars: PillarResult[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const pillar of pillars) {
    const weight = PILLAR_WEIGHTS[pillar.pillar];
    weightedSum += pillar.score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

/**
 * Classify a composite score into a maturity level.
 */
export function classifyMaturityLevel(score: number): MaturityLevel {
  for (const [level, { min, max }] of Object.entries(MATURITY_THRESHOLDS) as [
    MaturityLevel,
    { min: number; max: number },
  ][]) {
    if (score >= min && score <= max) {
      return level;
    }
  }
  return "L1";
}

/**
 * Check if the security gate is triggered and return the effective maturity level.
 */
export function applySecurityGate(
  pillars: PillarResult[],
  computedLevel: MaturityLevel,
): { level: MaturityLevel; gateTriggered: boolean } {
  const securityPillar = pillars.find((p) => p.pillar === SECURITY_GATE.pillar);
  if (!securityPillar) {
    return { level: computedLevel, gateTriggered: false };
  }

  if (securityPillar.score < SECURITY_GATE.threshold) {
    const capLevel = SECURITY_GATE.cap;
    const levelOrder: MaturityLevel[] = ["L1", "L2", "L3", "L4", "L5"];
    const computedIdx = levelOrder.indexOf(computedLevel);
    const capIdx = levelOrder.indexOf(capLevel);

    if (computedIdx > capIdx) {
      return { level: capLevel, gateTriggered: true };
    }
  }

  return { level: computedLevel, gateTriggered: false };
}

/**
 * Build LevelMeta for a given maturity level.
 */
export function buildLevelMeta(level: MaturityLevel): LevelMeta {
  const descriptions: Record<MaturityLevel, string> = {
    L1: "Agents thrash, hallucinate, waste tokens",
    L2: "Simple single-file edits with heavy supervision",
    L3: "Routine tasks with moderate supervision",
    L4: "Multi-file features and refactoring with light supervision",
    L5: "Complex cross-service tasks, agent self-verifies",
  };

  return {
    level,
    name: MATURITY_NAMES[level],
    description: descriptions[level],
  };
}

/**
 * Apply cross-pillar type bonus: strict TypeScript repos receive a bonus on
 * P2 (Feedback Loop) and P7 (Navigability). Types catch errors (P6), provide
 * faster feedback (P2), and improve navigability through explicit contracts (P7).
 *
 * Returns a new array of pillar results with adjusted scores.
 */
export function applyCrossPillarTypeBonus(pillars: PillarResult[]): PillarResult[] {
  const p6 = pillars.find((p) => p.pillar === "P6");
  if (!p6 || p6.score < 70) return pillars;

  const TYPE_BONUS = 5;

  return pillars.map((p) => {
    if (p.pillar === "P2" || p.pillar === "P7") {
      const boosted = Math.min(100, p.score + TYPE_BONUS);
      if (boosted === p.score) return p;
      return { ...p, score: boosted };
    }
    return p;
  });
}

/**
 * Aggregate all pillar results into a final ScanResult.
 */
export function aggregateResults(
  pillars: PillarResult[],
  metadata: { version: string; repoPath: string; duration: number },
): ScanResult {
  const adjustedPillars = applyCrossPillarTypeBonus(pillars);
  const score = calculateCompositeScore(adjustedPillars);
  const rawLevel = classifyMaturityLevel(score);
  const { level, gateTriggered } = applySecurityGate(adjustedPillars, rawLevel);
  const allFindings = adjustedPillars.flatMap((p) => p.findings);

  return {
    metadata: {
      version: metadata.version,
      timestamp: new Date().toISOString(),
      duration: metadata.duration,
      repoPath: metadata.repoPath,
      rubricVersion: "v1",
    },
    score,
    level,
    levelMeta: buildLevelMeta(level),
    securityGateTriggered: gateTriggered,
    pillars: adjustedPillars,
    findings: allFindings,
  };
}
