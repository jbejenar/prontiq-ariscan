import { describe, it, expect } from "vitest";
import {
  calculateCompositeScore,
  computeScoreBreakdown,
  aggregateResults,
  annotateCompositeDelta,
} from "../../scoring/composite.js";
import { LANGUAGE_PROFILES } from "../../profiles/index.js";
import type { LanguageProfileDef } from "../../profiles/index.js";
import type { PillarResult, PillarId } from "@prontiq/ariscan-schema";

// Pre-resolve profiles to avoid undefined checks in every test
const GO_PROFILE = LANGUAGE_PROFILES["go"] as LanguageProfileDef;
const RUST_PROFILE = LANGUAGE_PROFILES["rust"] as LanguageProfileDef;
const TS_PROFILE = LANGUAGE_PROFILES["typescript"] as LanguageProfileDef;
const PYTHON_PROFILE = LANGUAGE_PROFILES["python"] as LanguageProfileDef;

/** Create a minimal pillar result for testing. */
function makePillarResult(pillar: PillarId, score: number): PillarResult {
  return {
    pillar,
    name: pillar,
    score,
    weight: 0,
    confidence: "high",
    findings: [],
    summary: `${pillar} summary`,
    dataStatus: "sufficient",
  };
}

/** Create a full set of 8 pillar results. */
function makeAllPillars(scores: Record<PillarId, number>): PillarResult[] {
  return (Object.entries(scores) as [PillarId, number][]).map(([pillar, score]) =>
    makePillarResult(pillar, score),
  );
}

describe("scoring with language profiles", () => {
  const baseScores: Record<PillarId, number> = {
    P1: 70,
    P2: 60,
    P3: 80,
    P4: 50,
    P5: 65,
    P6: 40,
    P7: 75,
    P8: 55,
  };

  describe("calculateCompositeScore with custom weights", () => {
    it("produces different score with Go profile vs default", () => {
      const pillars = makeAllPillars(baseScores);
      const defaultScore = calculateCompositeScore(pillars);
      const goScore = calculateCompositeScore(pillars, GO_PROFILE.weights);

      // Go reduces P6 weight (which is low at 40) and increases P7 weight (which is high at 75)
      // So Go profile should produce a higher score
      expect(goScore).not.toBe(defaultScore);
      expect(goScore).toBeGreaterThan(defaultScore);
    });

    it("produces different score with Rust profile vs default", () => {
      const pillars = makeAllPillars(baseScores);
      const defaultScore = calculateCompositeScore(pillars);
      const rustScore = calculateCompositeScore(pillars, RUST_PROFILE.weights);

      // Rust also reduces P6 weight for low P6 score, should score higher
      expect(rustScore).not.toBe(defaultScore);
    });

    it("TypeScript profile produces same score as default", () => {
      const pillars = makeAllPillars(baseScores);
      const defaultScore = calculateCompositeScore(pillars);
      const tsScore = calculateCompositeScore(pillars, TS_PROFILE.weights);
      expect(tsScore).toBe(defaultScore);
    });

    it("user weights override language profile weights", () => {
      const pillars = makeAllPillars(baseScores);

      // Start with Go profile weights
      const goWeights = { ...GO_PROFILE.weights };

      // User overrides P6 back to 0.15 (same as default)
      const userOverridden = { ...goWeights, P6: 0.15 as number };
      const goScore = calculateCompositeScore(pillars, goWeights);
      const overriddenScore = calculateCompositeScore(pillars, userOverridden);

      expect(overriddenScore).not.toBe(goScore);
    });
  });

  describe("computeScoreBreakdown with custom weights", () => {
    it("uses custom weights for effective weight sum", () => {
      const pillars = makeAllPillars(baseScores);
      const defaultBreakdown = computeScoreBreakdown(pillars);
      const goBreakdown = computeScoreBreakdown(pillars, GO_PROFILE.weights);

      // Both should have 8 active pillars
      expect(goBreakdown.activePillars).toBe(8);
      // Weight sums should be approximately equal (both sum to 1.0)
      expect(goBreakdown.effectiveWeightSum).toBeCloseTo(defaultBreakdown.effectiveWeightSum, 2);
    });

    it("handles insufficient pillars with custom weights", () => {
      const pillars = makeAllPillars(baseScores);
      const first = pillars[0];
      if (!first) throw new Error("Expected pillar at index 0");
      pillars[0] = { ...first, dataStatus: "insufficient" };

      const breakdown = computeScoreBreakdown(pillars, GO_PROFILE.weights);
      expect(breakdown.activePillars).toBe(7);
      expect(breakdown.insufficientPillars).toBe(1);
      // Weight sum should be less than 1.0 (missing P1's weight)
      expect(breakdown.effectiveWeightSum).toBeLessThan(1.0);
    });
  });

  describe("annotateCompositeDelta with custom weights", () => {
    it("uses custom weights for delta calculation", () => {
      const findings = [
        {
          code: "ARI-BLD-001",
          pillar: "P6" as PillarId,
          severity: "high" as const,
          message: "Test finding",
          remediation: {
            action: "modify-config" as const,
            description: "Fix it",
            confidence: "high" as const,
          },
          scoreImpact: { pillarDelta: 10, compositeDelta: 0 },
        },
      ];

      const defaultAnnotated = annotateCompositeDelta(findings, 1.0);
      const goAnnotated = annotateCompositeDelta(findings, 1.0, GO_PROFILE.weights);

      // Go has lower P6 weight, so compositeDelta should be smaller
      const goFirst = goAnnotated[0];
      const defaultFirst = defaultAnnotated[0];
      if (!goFirst || !defaultFirst) throw new Error("Expected annotated findings");
      const goCD = goFirst.scoreImpact?.compositeDelta ?? 0;
      const defaultCD = defaultFirst.scoreImpact?.compositeDelta ?? 0;
      expect(goCD).toBeLessThan(defaultCD);
    });
  });

  describe("aggregateResults with custom weights", () => {
    it("accepts custom weights and produces valid ScanResult", () => {
      const pillars = makeAllPillars(baseScores);
      const result = aggregateResults(
        pillars,
        { version: "0.2.0", repoPath: "/test", duration: 100 },
        PYTHON_PROFILE.weights,
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.level).toBeDefined();
      expect(result.pillars).toHaveLength(8);
    });

    it("custom weights change the composite score", () => {
      const pillars = makeAllPillars(baseScores);
      const meta = { version: "0.2.0", repoPath: "/test", duration: 100 };

      const defaultResult = aggregateResults(pillars, meta);
      const rustResult = aggregateResults(pillars, meta, RUST_PROFILE.weights);

      // With Rust's lower P6 weight for a low P6 score, composite should differ
      expect(rustResult.score).not.toBe(defaultResult.score);
    });
  });
});
