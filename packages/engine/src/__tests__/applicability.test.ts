import { describe, it, expect } from "vitest";
import {
  getNotApplicableCodes,
  annotateApplicability,
  adjustPillarResults,
  countNotApplicable,
} from "../scoring/applicability.js";
import type { Finding, PillarResult } from "@prontiq/ariscan-schema";

function makeFinding(code: string, pillar: string = "P8"): Finding {
  return {
    code,
    severity: "medium",
    pillar: pillar as Finding["pillar"],
    message: `Test finding ${code}`,
  };
}

function makePillarResult(pillar: string, score: number, findings: Finding[]): PillarResult {
  return {
    pillar: pillar as PillarResult["pillar"],
    name: `Test ${pillar}`,
    score,
    weight: 0.15,
    confidence: "high",
    findings,
    summary: `Score ${score}`,
  };
}

describe("applicability map", () => {
  describe("getNotApplicableCodes", () => {
    it("returns codes for solo-hobby", () => {
      const codes = getNotApplicableCodes("solo-hobby");
      expect(codes.has("ARI-SEC-001")).toBe(true); // CODEOWNERS
      expect(codes.has("ARI-SEC-002")).toBe(true); // SECURITY.md
      expect(codes.has("ARI-SEC-009")).toBe(true); // Branch protection
      expect(codes.has("ARI-SEC-010")).toBe(true); // SAST
      expect(codes.has("ARI-FBK-006")).toBe(true); // Commitlint
    });

    it("returns empty set for monorepo-enterprise", () => {
      const codes = getNotApplicableCodes("monorepo-enterprise");
      expect(codes.size).toBe(0);
    });

    it("returns limited codes for small-team", () => {
      const codes = getNotApplicableCodes("small-team");
      expect(codes.has("ARI-SEC-007")).toBe(true);
      expect(codes.size).toBe(1);
    });
  });

  describe("annotateApplicability", () => {
    it("marks excluded findings as not-applicable", () => {
      const findings = [makeFinding("ARI-SEC-001"), makeFinding("ARI-SEC-003")];
      const result = annotateApplicability(findings, "solo-hobby");
      expect(result[0]?.applicability).toBe("not-applicable");
      expect(result[1]?.applicability).toBe("applicable"); // SEC-003 not excluded for solo-hobby
    });

    it("returns original array for monorepo-enterprise (no exclusions)", () => {
      const findings = [makeFinding("ARI-SEC-001")];
      const result = annotateApplicability(findings, "monorepo-enterprise");
      expect(result).toBe(findings); // same reference — no changes
    });
  });

  describe("adjustPillarResults", () => {
    it("increases P8 score for solo-hobby excluding enterprise findings", () => {
      const findings = [
        makeFinding("ARI-SEC-001"), // +15 points
        makeFinding("ARI-SEC-002"), // +10 points
        makeFinding("ARI-SEC-003"), // not excluded, stays
      ];
      const pillars = [makePillarResult("P8", 30, findings)];

      const adjusted = adjustPillarResults(pillars, "solo-hobby");
      // 30 + 15 (SEC-001) + 10 (SEC-002) = 55
      expect(adjusted[0]?.score).toBe(55);
      // SEC-001 and SEC-002 marked not-applicable
      expect(adjusted[0]?.findings[0]?.applicability).toBe("not-applicable");
      expect(adjusted[0]?.findings[1]?.applicability).toBe("not-applicable");
      expect(adjusted[0]?.findings[2]?.applicability).toBe("applicable");
    });

    it("clamps adjusted score to 100", () => {
      const findings = [
        makeFinding("ARI-SEC-001"), // +15
        makeFinding("ARI-SEC-004"), // +15
        makeFinding("ARI-SEC-009"), // +15
        makeFinding("ARI-SEC-010"), // +15
      ];
      const pillars = [makePillarResult("P8", 60, findings)];

      const adjusted = adjustPillarResults(pillars, "solo-hobby");
      // 60 + 15 + 15 + 15 + 15 = 120 → clamped to 100
      expect(adjusted[0]?.score).toBe(100);
    });

    it("does not adjust monorepo-enterprise scores", () => {
      const findings = [makeFinding("ARI-SEC-001")];
      const pillars = [makePillarResult("P8", 30, findings)];

      const adjusted = adjustPillarResults(pillars, "monorepo-enterprise");
      expect(adjusted).toBe(pillars); // same reference
      expect(adjusted[0]?.score).toBe(30);
    });

    it("adjusts P2 score for solo-hobby excluding FBK-006", () => {
      const findings = [
        makeFinding("ARI-FBK-006", "P2"), // +5 points
        makeFinding("ARI-FBK-001", "P2"), // not excluded
      ];
      const pillars = [makePillarResult("P2", 50, findings)];

      const adjusted = adjustPillarResults(pillars, "solo-hobby");
      expect(adjusted[0]?.score).toBe(55);
    });
  });

  describe("countNotApplicable", () => {
    it("counts excluded findings for solo-hobby", () => {
      const findings = [
        makeFinding("ARI-SEC-001"),
        makeFinding("ARI-SEC-003"),
        makeFinding("ARI-SEC-009"),
      ];
      expect(countNotApplicable(findings, "solo-hobby")).toBe(2);
    });

    it("returns 0 for monorepo-enterprise", () => {
      const findings = [makeFinding("ARI-SEC-001")];
      expect(countNotApplicable(findings, "monorepo-enterprise")).toBe(0);
    });
  });
});
