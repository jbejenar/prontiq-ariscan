import { describe, it, expect } from "vitest";
import { annotateCompositeDelta } from "../scoring/composite.js";
import type { Finding } from "@prontiq/ariscan-schema";

function makeFinding(code: string, pillar: string, pillarDelta: number): Finding {
  return {
    code,
    severity: "medium",
    pillar: pillar as Finding["pillar"],
    message: `Test finding ${code}`,
    scoreImpact: { pillarDelta, compositeDelta: 0 },
  };
}

function makeFindingNoImpact(code: string, pillar: string): Finding {
  return {
    code,
    severity: "info",
    pillar: pillar as Finding["pillar"],
    message: `Informational finding ${code}`,
  };
}

/** Type-safe array access that narrows away undefined. */
function at<T>(arr: T[], index: number): T {
  const item = arr[index];
  if (item === undefined) throw new Error(`Expected element at index ${index}`);
  return item;
}

/** Helper: extract compositeDelta safely. */
function getCompositeDelta(finding: Finding): number {
  return finding.scoreImpact?.compositeDelta ?? -1;
}

describe("annotateCompositeDelta", () => {
  it("computes compositeDelta from pillarDelta and weights", () => {
    // P3 weight = 0.18, effectiveWeightSum = 1.0
    const findings = [makeFinding("ARI-TST-001", "P3", 10)];
    const result = annotateCompositeDelta(findings, 1.0);
    const f = at(result, 0);

    expect(f.scoreImpact).toBeDefined();
    // 10 * 0.18 / 1.0 = 1.8
    expect(getCompositeDelta(f)).toBe(1.8);
    expect(f.scoreImpact?.pillarDelta).toBe(10);
  });

  it("computes correctly for P8 (low weight)", () => {
    // P8 weight = 0.05, effectiveWeightSum = 1.0
    const findings = [makeFinding("ARI-SEC-003", "P8", 15)];
    const result = annotateCompositeDelta(findings, 1.0);

    // 15 * 0.05 / 1.0 = 0.75, rounded to 0.8
    expect(getCompositeDelta(at(result, 0))).toBe(0.8);
  });

  it("handles insufficient pillars by using reduced effectiveWeightSum", () => {
    const findings = [makeFinding("ARI-CTX-001", "P1", 45)];
    const result = annotateCompositeDelta(findings, 0.82);

    // 45 * 0.15 / 0.82 = 8.2317..., rounded to 8.2
    expect(getCompositeDelta(at(result, 0))).toBe(8.2);
  });

  it("does not modify findings without scoreImpact", () => {
    const findings = [makeFindingNoImpact("ARI-SEC-008", "P8")];
    const result = annotateCompositeDelta(findings, 1.0);

    expect(at(result, 0).scoreImpact).toBeUndefined();
  });

  it("handles zero effectiveWeightSum gracefully", () => {
    const findings = [makeFinding("ARI-TST-001", "P3", 10)];
    const result = annotateCompositeDelta(findings, 0);

    // Should return unchanged when weight sum is 0
    expect(getCompositeDelta(at(result, 0))).toBe(0);
  });

  it("uses absolute value of pillarDelta for compositeDelta", () => {
    // Negative pillarDelta (deduction) should still produce positive compositeDelta
    const findings = [makeFinding("ARI-NAV-001", "P7", -10)];
    const result = annotateCompositeDelta(findings, 1.0);

    // abs(-10) * 0.12 / 1.0 = 1.2
    expect(getCompositeDelta(at(result, 0))).toBe(1.2);
  });

  it("orders P3 high finding above P8 critical finding by impact", () => {
    // P3 weight = 0.18, P8 weight = 0.05
    const p3Finding = makeFinding("ARI-TST-011", "P3", 15);
    const p8Finding: Finding = {
      ...makeFinding("ARI-SEC-003", "P8", 15),
      severity: "critical",
    };

    const result = annotateCompositeDelta([p3Finding, p8Finding], 1.0);

    // P3: 15 * 0.18 = 2.7
    // P8: 15 * 0.05 = 0.75 → 0.8
    const sorted = [...result].sort(
      (a, b) => (b.scoreImpact?.compositeDelta ?? 0) - (a.scoreImpact?.compositeDelta ?? 0),
    );

    expect(at(sorted, 0).code).toBe("ARI-TST-011"); // P3 has more impact
    expect(at(sorted, 1).code).toBe("ARI-SEC-003"); // P8 has less impact despite higher severity
  });

  it("processes multiple findings from different pillars", () => {
    const findings = [
      makeFinding("ARI-CTX-001", "P1", 45), // P1: 45 * 0.15 = 6.75 → 6.8
      makeFinding("ARI-TST-006", "P3", 0), // P3: 0 → 0
      makeFinding("ARI-SEC-003", "P8", 15), // P8: 15 * 0.05 = 0.75 → 0.8
      makeFinding("ARI-NAV-001", "P7", 10), // P7: 10 * 0.12 = 1.2
    ];

    const result = annotateCompositeDelta(findings, 1.0);

    expect(getCompositeDelta(at(result, 0))).toBe(6.8); // P1
    expect(getCompositeDelta(at(result, 1))).toBe(0); // P3 (0 delta)
    expect(getCompositeDelta(at(result, 2))).toBe(0.8); // P8
    expect(getCompositeDelta(at(result, 3))).toBe(1.2); // P7
  });
});
