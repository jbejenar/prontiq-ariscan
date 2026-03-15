import { describe, it, expect } from "vitest";
import { ScanConfig, PillarOverride, FileConfig } from "../config.js";

describe("PillarOverride schema", () => {
  it("accepts valid override with all fields", () => {
    const result = PillarOverride.parse({ weight: 0.5, threshold: 80, enabled: true });
    expect(result.weight).toBe(0.5);
    expect(result.threshold).toBe(80);
    expect(result.enabled).toBe(true);
  });

  it("defaults enabled to true", () => {
    const result = PillarOverride.parse({});
    expect(result.enabled).toBe(true);
  });

  it("rejects weight outside 0-1", () => {
    expect(() => PillarOverride.parse({ weight: 1.5 })).toThrow();
    expect(() => PillarOverride.parse({ weight: -0.1 })).toThrow();
  });

  it("rejects threshold outside 0-100", () => {
    expect(() => PillarOverride.parse({ threshold: 101 })).toThrow();
    expect(() => PillarOverride.parse({ threshold: -1 })).toThrow();
  });
});

describe("ScanConfig schema", () => {
  it("provides sensible defaults", () => {
    const result = ScanConfig.parse({});
    expect(result.threshold).toBe(0);
    expect(result.format).toBe("terminal");
    expect(result.verbose).toBe(false);
    expect(result.quiet).toBe(false);
    expect(result.exclude).toEqual([]);
  });

  it("accepts all valid format options", () => {
    for (const format of ["terminal", "json", "sarif", "markdown"]) {
      const result = ScanConfig.parse({ format });
      expect(result.format).toBe(format);
    }
  });

  it("rejects invalid format", () => {
    expect(() => ScanConfig.parse({ format: "xml" })).toThrow();
  });

  it("accepts pillar overrides", () => {
    const result = ScanConfig.parse({
      pillars: {
        P1: { weight: 0.2, enabled: true },
        P3: { enabled: false },
      },
    });
    expect(result.pillars).toBeDefined();
    expect(result.pillars?.["P1"]?.weight).toBe(0.2);
    expect(result.pillars?.["P3"]?.enabled).toBe(false);
  });

  it("accepts targetLevel", () => {
    const result = ScanConfig.parse({ targetLevel: "L3" });
    expect(result.targetLevel).toBe("L3");
  });
});

describe("FileConfig schema", () => {
  it("accepts empty config", () => {
    const result = FileConfig.parse({});
    expect(result).toBeDefined();
  });

  it("accepts threshold and format", () => {
    const result = FileConfig.parse({ threshold: 70, format: "json" });
    expect(result.threshold).toBe(70);
    expect(result.format).toBe("json");
  });

  it("accepts pillar exclusions", () => {
    const result = FileConfig.parse({
      pillars: { exclude: ["P1", "P8"] },
    });
    expect(result.pillars?.exclude).toEqual(["P1", "P8"]);
  });

  it("accepts pillar weight overrides", () => {
    const result = FileConfig.parse({
      pillars: { weights: { P1: 0.2, P3: 0.3 } },
    });
    expect(result.pillars?.weights?.["P1"]).toBe(0.2);
  });
});
