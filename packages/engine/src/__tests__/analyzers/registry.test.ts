import { describe, it, expect } from "vitest";
import { ANALYZERS, getAnalyzer } from "../../analyzers/registry.js";

describe("ANALYZERS registry", () => {
  it("contains exactly 8 analyzers", () => {
    expect(ANALYZERS).toHaveLength(8);
  });

  it("has unique pillar IDs", () => {
    const pillars = ANALYZERS.map((a) => a.pillar);
    const uniqueCount = new Set(pillars).size;
    expect(uniqueCount).toBe(pillars.length);
  });

  it("covers all 8 pillars P1-P8", () => {
    const pillars = new Set(ANALYZERS.map((a) => a.pillar));
    for (let i = 1; i <= 8; i++) {
      expect(pillars.has(`P${i}` as never)).toBe(true);
    }
  });

  it("all analyzers have required fields", () => {
    for (const analyzer of ANALYZERS) {
      expect(analyzer.pillar).toBeDefined();
      expect(analyzer.name).toBeDefined();
      expect(analyzer.version).toBeDefined();
      expect(typeof analyzer.supports).toBe("function");
      expect(typeof analyzer.analyze).toBe("function");
    }
  });
});

describe("getAnalyzer", () => {
  it("returns the correct analyzer for each pillar", () => {
    for (const analyzer of ANALYZERS) {
      const found = getAnalyzer(analyzer.pillar);
      expect(found).toBe(analyzer);
    }
  });

  it("returns undefined for unknown pillar", () => {
    const found = getAnalyzer("P99" as never);
    expect(found).toBeUndefined();
  });
});
