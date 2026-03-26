import { describe, it, expect } from "vitest";
import * as schema from "../index.js";

describe("schema barrel exports", () => {
  it("exports PillarId type guard", () => {
    expect(schema.PillarId).toBeDefined();
  });

  it("exports PILLAR_NAMES mapping", () => {
    expect(schema.PILLAR_NAMES).toBeDefined();
    expect(schema.PILLAR_NAMES.P1).toBe("Agent Context Quality");
  });

  it("exports PILLAR_WEIGHTS mapping", () => {
    expect(schema.PILLAR_WEIGHTS).toBeDefined();
    const totalWeight = Object.values(schema.PILLAR_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(Math.abs(totalWeight - 1.0)).toBeLessThan(0.001);
  });

  it("exports MATURITY_THRESHOLDS", () => {
    expect(schema.MATURITY_THRESHOLDS).toBeDefined();
  });

  it("exports scoreToStatus function", () => {
    expect(typeof schema.scoreToStatus).toBe("function");
  });

  it("exports scoreToBucket function", () => {
    expect(typeof schema.scoreToBucket).toBe("function");
  });

  it("exports fileCountToBucket function", () => {
    expect(typeof schema.fileCountToBucket).toBe("function");
  });

  it("exports RepoSizeBucket schema", () => {
    expect(schema.RepoSizeBucket).toBeDefined();
  });

  it("exports Severity Zod schema", () => {
    expect(schema.Severity).toBeDefined();
  });

  it("exports Finding Zod schema", () => {
    expect(schema.Finding).toBeDefined();
  });

  it("exports ScanResult Zod schema", () => {
    expect(schema.ScanResult).toBeDefined();
  });

  it("exports ScanConfig Zod schema", () => {
    expect(schema.ScanConfig).toBeDefined();
  });

  it("exports telemetryPayloadSchema", () => {
    expect(schema.telemetryPayloadSchema).toBeDefined();
  });
});
