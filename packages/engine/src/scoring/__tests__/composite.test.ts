import { describe, it, expect } from "vitest";
import type { PillarResult } from "@prontiq/ariscan-schema";
import {
  calculateCompositeScore,
  classifyMaturityLevel,
  applySecurityGate,
  applyCrossPillarTypeBonus,
  aggregateResults,
} from "../composite.js";

function makePillarResult(pillar: string, score: number): PillarResult {
  return {
    pillar: pillar as PillarResult["pillar"],
    name: "Test Pillar",
    score,
    weight: 0.125,
    confidence: "high",
    findings: [],
    summary: `Score: ${score}`,
  };
}

describe("calculateCompositeScore", () => {
  it("calculates weighted average of pillar scores", () => {
    const pillars: PillarResult[] = [
      makePillarResult("P1", 80),
      makePillarResult("P2", 60),
      makePillarResult("P3", 70),
      makePillarResult("P4", 50),
      makePillarResult("P5", 40),
      makePillarResult("P6", 90),
      makePillarResult("P7", 55),
      makePillarResult("P8", 30),
    ];
    const score = calculateCompositeScore(pillars);
    // Weighted: 80*0.15 + 60*0.15 + 70*0.18 + 50*0.10 + 40*0.10 + 90*0.15 + 55*0.12 + 30*0.05
    // = 12 + 9 + 12.6 + 5 + 4 + 13.5 + 6.6 + 1.5 = 64.2
    expect(score).toBe(64);
  });

  it("returns 0 for empty pillars", () => {
    expect(calculateCompositeScore([])).toBe(0);
  });
});

describe("classifyMaturityLevel", () => {
  it("classifies L1 (0-25)", () => {
    expect(classifyMaturityLevel(0)).toBe("L1");
    expect(classifyMaturityLevel(15)).toBe("L1");
    expect(classifyMaturityLevel(25)).toBe("L1");
  });

  it("classifies L2 (26-45)", () => {
    expect(classifyMaturityLevel(26)).toBe("L2");
    expect(classifyMaturityLevel(35)).toBe("L2");
    expect(classifyMaturityLevel(45)).toBe("L2");
  });

  it("classifies L3 (46-65)", () => {
    expect(classifyMaturityLevel(46)).toBe("L3");
    expect(classifyMaturityLevel(55)).toBe("L3");
    expect(classifyMaturityLevel(65)).toBe("L3");
  });

  it("classifies L4 (66-80)", () => {
    expect(classifyMaturityLevel(66)).toBe("L4");
    expect(classifyMaturityLevel(73)).toBe("L4");
    expect(classifyMaturityLevel(80)).toBe("L4");
  });

  it("classifies L5 (81-100)", () => {
    expect(classifyMaturityLevel(81)).toBe("L5");
    expect(classifyMaturityLevel(90)).toBe("L5");
    expect(classifyMaturityLevel(100)).toBe("L5");
  });
});

describe("applySecurityGate", () => {
  it("caps at L2 when P8 < 40", () => {
    const pillars = [makePillarResult("P8", 30)];
    const { level, gateTriggered } = applySecurityGate(pillars, "L4");
    expect(level).toBe("L2");
    expect(gateTriggered).toBe(true);
  });

  it("does not cap when P8 >= 40", () => {
    const pillars = [makePillarResult("P8", 50)];
    const { level, gateTriggered } = applySecurityGate(pillars, "L4");
    expect(level).toBe("L4");
    expect(gateTriggered).toBe(false);
  });

  it("does not trigger if already at or below L2", () => {
    const pillars = [makePillarResult("P8", 20)];
    const { level, gateTriggered } = applySecurityGate(pillars, "L1");
    expect(level).toBe("L1");
    expect(gateTriggered).toBe(false);
  });

  it("does not trigger if P8 is missing", () => {
    const { level, gateTriggered } = applySecurityGate([], "L4");
    expect(level).toBe("L4");
    expect(gateTriggered).toBe(false);
  });
});

describe("applyCrossPillarTypeBonus", () => {
  it("adds +5 to P2 and P7 when P6 >= 70", () => {
    const pillars = [
      makePillarResult("P2", 60),
      makePillarResult("P6", 80),
      makePillarResult("P7", 50),
    ];
    const adjusted = applyCrossPillarTypeBonus(pillars);
    const p2 = adjusted.find((p) => p.pillar === "P2");
    const p7 = adjusted.find((p) => p.pillar === "P7");
    expect(p2?.score).toBe(65);
    expect(p7?.score).toBe(55);
  });

  it("does not apply bonus when P6 < 70", () => {
    const pillars = [
      makePillarResult("P2", 60),
      makePillarResult("P6", 50),
      makePillarResult("P7", 50),
    ];
    const adjusted = applyCrossPillarTypeBonus(pillars);
    const p2 = adjusted.find((p) => p.pillar === "P2");
    const p7 = adjusted.find((p) => p.pillar === "P7");
    expect(p2?.score).toBe(60);
    expect(p7?.score).toBe(50);
  });

  it("clamps P2/P7 at 100", () => {
    const pillars = [
      makePillarResult("P2", 98),
      makePillarResult("P6", 90),
      makePillarResult("P7", 100),
    ];
    const adjusted = applyCrossPillarTypeBonus(pillars);
    const p2 = adjusted.find((p) => p.pillar === "P2");
    const p7 = adjusted.find((p) => p.pillar === "P7");
    expect(p2?.score).toBe(100);
    expect(p7?.score).toBe(100);
  });

  it("does not modify other pillars", () => {
    const pillars = [makePillarResult("P1", 60), makePillarResult("P6", 80)];
    const adjusted = applyCrossPillarTypeBonus(pillars);
    expect(adjusted.find((p) => p.pillar === "P1")?.score).toBe(60);
    expect(adjusted.find((p) => p.pillar === "P6")?.score).toBe(80);
  });
});

describe("aggregateResults", () => {
  it("produces a valid ScanResult", () => {
    const pillars = [
      makePillarResult("P1", 50),
      makePillarResult("P2", 50),
      makePillarResult("P3", 50),
      makePillarResult("P4", 50),
      makePillarResult("P5", 50),
      makePillarResult("P6", 50),
      makePillarResult("P7", 50),
      makePillarResult("P8", 50),
    ];
    const result = aggregateResults(pillars, {
      version: "0.1.0",
      repoPath: "/test",
      duration: 100,
    });
    expect(result.score).toBe(50);
    expect(result.level).toBe("L3");
    expect(result.securityGateTriggered).toBe(false);
    expect(result.pillars).toHaveLength(8);
    expect(result.metadata.version).toBe("0.1.0");
  });
});
