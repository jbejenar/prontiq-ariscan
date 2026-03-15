import { describe, it, expect } from "vitest";
import {
  PillarId,
  PILLAR_WEIGHTS,
  MATURITY_THRESHOLDS,
  MaturityLevel,
  SECURITY_GATE,
} from "../pillar.js";

describe("PillarId", () => {
  it("validates all 8 pillar IDs", () => {
    const pillars = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
    for (const p of pillars) {
      expect(PillarId.parse(p)).toBe(p);
    }
  });

  it("rejects invalid pillar IDs", () => {
    expect(() => PillarId.parse("P9")).toThrow();
    expect(() => PillarId.parse("X1")).toThrow();
  });
});

describe("PILLAR_WEIGHTS", () => {
  it("weights sum to 1.0", () => {
    const sum = Object.values(PILLAR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it("P3 has the highest weight at 0.18", () => {
    expect(PILLAR_WEIGHTS.P3).toBe(0.18);
  });

  it("P8 has the lowest weight at 0.05", () => {
    expect(PILLAR_WEIGHTS.P8).toBe(0.05);
  });
});

describe("MaturityLevel", () => {
  it("validates all 5 levels", () => {
    const levels = ["L1", "L2", "L3", "L4", "L5"];
    for (const l of levels) {
      expect(MaturityLevel.parse(l)).toBe(l);
    }
  });

  it("thresholds cover 0-100 without gaps", () => {
    expect(MATURITY_THRESHOLDS.L1.min).toBe(0);
    expect(MATURITY_THRESHOLDS.L5.max).toBe(100);
    expect(MATURITY_THRESHOLDS.L1.max + 1).toBe(MATURITY_THRESHOLDS.L2.min);
    expect(MATURITY_THRESHOLDS.L2.max + 1).toBe(MATURITY_THRESHOLDS.L3.min);
    expect(MATURITY_THRESHOLDS.L3.max + 1).toBe(MATURITY_THRESHOLDS.L4.min);
    expect(MATURITY_THRESHOLDS.L4.max + 1).toBe(MATURITY_THRESHOLDS.L5.min);
  });
});

describe("SECURITY_GATE", () => {
  it("gates on P8 at threshold 40, caps at L2", () => {
    expect(SECURITY_GATE.pillar).toBe("P8");
    expect(SECURITY_GATE.threshold).toBe(40);
    expect(SECURITY_GATE.cap).toBe("L2");
  });
});
