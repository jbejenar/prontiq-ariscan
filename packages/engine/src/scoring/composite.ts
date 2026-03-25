import {
  type PillarResult,
  type Finding,
  type ScanResult,
  type ScoreBreakdown,
  type MaturityLevel,
  type LevelMeta,
  type PillarId,
  PILLAR_WEIGHTS,
  MATURITY_THRESHOLDS,
  MATURITY_NAMES,
  SECURITY_GATE,
} from "@prontiq/ariscan-schema";

/** Check if a pillar has sufficient data for scoring (not "insufficient"). */
function isActivePillar(pillar: PillarResult): boolean {
  return pillar.dataStatus !== "insufficient";
}

/**
 * Calculate the composite ARI score from pillar results.
 * Pillars with dataStatus "insufficient" are excluded; their weight is
 * redistributed proportionally among the remaining active pillars.
 */
export function calculateCompositeScore(pillars: PillarResult[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const pillar of pillars) {
    if (!isActivePillar(pillar)) continue;
    const weight = PILLAR_WEIGHTS[pillar.pillar];
    weightedSum += pillar.score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

/**
 * Compute the score breakdown showing active vs insufficient pillars.
 */
export function computeScoreBreakdown(pillars: PillarResult[]): ScoreBreakdown {
  const active = pillars.filter(isActivePillar);
  const insufficient = pillars.filter((p) => !isActivePillar(p));
  const effectiveWeightSum = active.reduce((sum, p) => sum + PILLAR_WEIGHTS[p.pillar], 0);

  return {
    activePillars: active.length,
    insufficientPillars: insufficient.length,
    effectiveWeightSum: Math.round(effectiveWeightSum * 1000) / 1000,
  };
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
 * Annotate compositeDelta on all findings that have a scoreImpact.
 * compositeDelta = abs(pillarDelta) × pillarWeight / effectiveWeightSum
 * Rounded to 1 decimal place.
 */
export function annotateCompositeDelta(findings: Finding[], effectiveWeightSum: number): Finding[] {
  if (effectiveWeightSum === 0) return findings;

  return findings.map((f) => {
    if (!f.scoreImpact) return f;
    const weight = PILLAR_WEIGHTS[f.pillar as PillarId] ?? 0;
    const compositeDelta =
      Math.round((Math.abs(f.scoreImpact.pillarDelta) * weight * 10) / effectiveWeightSum) / 10;
    return {
      ...f,
      scoreImpact: { ...f.scoreImpact, compositeDelta },
    };
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
  const scoreBreakdown = computeScoreBreakdown(adjustedPillars);
  const rawFindings = adjustedPillars.flatMap((p) => p.findings);
  const allFindings = annotateCompositeDelta(rawFindings, scoreBreakdown.effectiveWeightSum);

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
    scoreBreakdown,
  };
}
