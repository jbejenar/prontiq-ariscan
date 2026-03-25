import { describe, it, expect } from "vitest";
import { navigabilityAnalyzer } from "../analyzers/navigability.js";
import { testIsolationAnalyzer } from "../analyzers/test-isolation.js";
import { buildDeterminismAnalyzer } from "../analyzers/build-determinism.js";
import { docReadabilityAnalyzer } from "../analyzers/doc-readability.js";
import { calculateCompositeScore, computeScoreBreakdown } from "../scoring/composite.js";
import { createMockContext } from "./helpers.js";
import type { PillarResult } from "@prontiq/ariscan-schema";

describe("insufficient data handling", () => {
  describe("P7 Navigability — no source files", () => {
    it("returns dataStatus insufficient with score 0", async () => {
      const ctx = createMockContext({ "README.md": "# Hello" });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.dataStatus).toBe("insufficient");
      expect(result.score).toBe(0);
      expect(result.summary).toContain("Insufficient data");
    });

    it("emits ARI-NAV-100 info finding", async () => {
      const ctx = createMockContext({ "README.md": "# Hello" });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]?.code).toBe("ARI-NAV-100");
      expect(result.findings[0]?.severity).toBe("info");
    });

    it("returns sufficient when source files exist", async () => {
      const ctx = createMockContext({ "src/app.ts": "export const x = 1;" });
      const result = await navigabilityAnalyzer.analyze(ctx);
      expect(result.dataStatus).not.toBe("insufficient");
    });
  });

  describe("P3 Test Isolation — no test files", () => {
    it("returns dataStatus insufficient with score 0", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const x = 1;",
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.dataStatus).toBe("insufficient");
      expect(result.score).toBe(0);
      expect(result.summary).toContain("Insufficient data");
    });

    it("returns sufficient when test files exist", async () => {
      const ctx = createMockContext({
        "src/app.ts": "export const x = 1;",
        "src/app.test.ts": 'import { test } from "vitest"; test("x", () => {});',
      });
      const result = await testIsolationAnalyzer.analyze(ctx);
      expect(result.dataStatus).not.toBe("insufficient");
    });
  });

  describe("P6 Build Determinism — no build config", () => {
    it("returns dataStatus insufficient with score 0", async () => {
      const ctx = createMockContext({ "README.md": "# Hello" });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.dataStatus).toBe("insufficient");
      expect(result.score).toBe(0);
      expect(result.summary).toContain("Insufficient data");
    });

    it("emits ARI-BLD-100 info finding", async () => {
      const ctx = createMockContext({ "README.md": "# Hello" });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]?.code).toBe("ARI-BLD-100");
      expect(result.findings[0]?.severity).toBe("info");
    });

    it("returns sufficient when package.json exists", async () => {
      const ctx = createMockContext({
        "package.json": JSON.stringify({ name: "test", dependencies: {} }),
      });
      const result = await buildDeterminismAnalyzer.analyze(ctx);
      expect(result.dataStatus).not.toBe("insufficient");
    });
  });

  describe("P5 Doc Readability — partial data", () => {
    it("returns dataStatus partial when only README exists", async () => {
      const ctx = createMockContext({
        "README.md": "# Hello\n\n## Getting Started\n\nRun `npm start`\n",
      });
      const result = await docReadabilityAnalyzer.analyze(ctx);
      expect(result.dataStatus).toBe("partial");
    });

    it("returns insufficient when no docs at all", async () => {
      const ctx = createMockContext({ "src/app.ts": "export const x = 1;" });
      const result = await docReadabilityAnalyzer.analyze(ctx);
      expect(result.dataStatus).toBe("insufficient");
    });

    it("returns no dataStatus when structured docs exist", async () => {
      const ctx = createMockContext({
        "README.md": "# Hello\n",
        "openapi.json": '{"openapi":"3.0.0","info":{"title":"API","version":"1.0.0"},"paths":{}}',
      });
      const result = await docReadabilityAnalyzer.analyze(ctx);
      expect(result.dataStatus).toBeUndefined();
    });
  });

  describe("composite scoring — excludes insufficient pillars", () => {
    function makePillar(
      pillar: string,
      score: number,
      weight: number,
      dataStatus?: "sufficient" | "insufficient" | "partial",
    ): PillarResult {
      return {
        pillar: pillar as PillarResult["pillar"],
        name: `Pillar ${pillar}`,
        score,
        weight,
        confidence: "high",
        findings: [],
        summary: "test",
        ...(dataStatus ? { dataStatus } : {}),
      };
    }

    it("excludes insufficient pillars from composite", () => {
      const pillars: PillarResult[] = [
        makePillar("P1", 80, 0.15),
        makePillar("P2", 60, 0.15),
        makePillar("P3", 0, 0.18, "insufficient"),
        makePillar("P4", 70, 0.1),
        makePillar("P5", 50, 0.1),
        makePillar("P6", 0, 0.15, "insufficient"),
        makePillar("P7", 90, 0.12),
        makePillar("P8", 40, 0.05),
      ];

      const score = calculateCompositeScore(pillars);
      // Only P1, P2, P4, P5, P7, P8 contribute
      // Effective weight = 0.15 + 0.15 + 0.1 + 0.1 + 0.12 + 0.05 = 0.67
      // Weighted sum = 80*0.15 + 60*0.15 + 70*0.1 + 50*0.1 + 90*0.12 + 40*0.05
      //             = 12 + 9 + 7 + 5 + 10.8 + 2 = 45.8
      // Composite = 45.8 / 0.67 ≈ 68.36 → 68
      expect(score).toBe(68);
    });

    it("includes partial-data pillars in composite", () => {
      const pillars: PillarResult[] = [
        makePillar("P1", 80, 0.5),
        makePillar("P2", 40, 0.5, "partial"),
      ];

      const score = calculateCompositeScore(pillars);
      // Both contribute: (80*0.5 + 40*0.5) / 1.0 = 60
      expect(score).toBe(60);
    });

    it("returns 0 when all pillars are insufficient", () => {
      const pillars: PillarResult[] = [
        makePillar("P1", 0, 0.5, "insufficient"),
        makePillar("P2", 0, 0.5, "insufficient"),
      ];

      expect(calculateCompositeScore(pillars)).toBe(0);
    });
  });

  describe("computeScoreBreakdown", () => {
    function makePillar(
      pillar: string,
      weight: number,
      dataStatus?: "sufficient" | "insufficient" | "partial",
    ): PillarResult {
      return {
        pillar: pillar as PillarResult["pillar"],
        name: `Pillar ${pillar}`,
        score: 50,
        weight,
        confidence: "high",
        findings: [],
        summary: "test",
        ...(dataStatus ? { dataStatus } : {}),
      };
    }

    it("counts active vs insufficient pillars", () => {
      const pillars = [
        makePillar("P1", 0.15),
        makePillar("P2", 0.15),
        makePillar("P3", 0.18, "insufficient"),
        makePillar("P4", 0.1),
        makePillar("P5", 0.1, "partial"),
        makePillar("P6", 0.15, "insufficient"),
        makePillar("P7", 0.12),
        makePillar("P8", 0.05),
      ];

      const breakdown = computeScoreBreakdown(pillars);
      expect(breakdown.activePillars).toBe(6);
      expect(breakdown.insufficientPillars).toBe(2);
      // Effective weight = 0.15 + 0.15 + 0.1 + 0.1 + 0.12 + 0.05 = 0.67
      expect(breakdown.effectiveWeightSum).toBe(0.67);
    });

    it("reports all active when no insufficient pillars", () => {
      const pillars = [makePillar("P1", 0.15), makePillar("P2", 0.15)];

      const breakdown = computeScoreBreakdown(pillars);
      expect(breakdown.activePillars).toBe(2);
      expect(breakdown.insufficientPillars).toBe(0);
      // P1 + P2 canonical weights = 0.15 + 0.15 = 0.3
      expect(breakdown.effectiveWeightSum).toBe(0.3);
    });
  });
});
