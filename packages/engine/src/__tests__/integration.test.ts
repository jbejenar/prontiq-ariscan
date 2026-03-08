import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { scan } from "../scan.js";

// Path to test fixtures
const FIXTURES = resolve(import.meta.dirname, "../../../../packages/testing/fixtures");

describe("integration: scan", () => {
  it("scans a hostile repo and returns L1 score", async () => {
    const result = await scan(resolve(FIXTURES, "hostile-repo"));
    expect(result.score).toBeLessThanOrEqual(25);
    expect(result.level).toBe("L1");
    expect(result.pillars).toHaveLength(8);
    expect(result.metadata.rubricVersion).toBe("v1");
  }, 30000);

  it("scans a capable repo and returns L2-L3 score", async () => {
    const result = await scan(resolve(FIXTURES, "capable-repo"));
    expect(result.score).toBeGreaterThanOrEqual(26);
    expect(result.score).toBeLessThanOrEqual(65);
    expect(["L2", "L3"]).toContain(result.level);
  }, 30000);

  it("returns all 8 pillar results", async () => {
    const result = await scan(resolve(FIXTURES, "capable-repo"));
    const pillarIds = result.pillars.map((p) => p.pillar).sort();
    expect(pillarIds).toEqual(["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]);
  }, 30000);

  it("applies correct weights", async () => {
    const result = await scan(resolve(FIXTURES, "capable-repo"));
    for (const pillar of result.pillars) {
      expect(pillar.weight).toBeGreaterThan(0);
      expect(pillar.weight).toBeLessThanOrEqual(1);
    }
    const totalWeight = result.pillars.reduce((sum, p) => sum + p.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 2);
  }, 30000);

  it("includes findings with valid ARI codes", async () => {
    const result = await scan(resolve(FIXTURES, "hostile-repo"));
    expect(result.findings.length).toBeGreaterThan(0);
    for (const finding of result.findings) {
      expect(finding.code).toMatch(/^ARI-[A-Z]{3}-\d{3}$/);
    }
  }, 30000);

  it("security gate caps maturity when P8 < 40", async () => {
    // hostile-repo has no security controls, P8 should be < 40
    const result = await scan(resolve(FIXTURES, "hostile-repo"));
    const p8 = result.pillars.find((p) => p.pillar === "P8");
    if (p8 && p8.score < 40) {
      expect(["L1", "L2"]).toContain(result.level);
    }
  }, 30000);

  it("self-scan produces a reasonable score", async () => {
    const result = await scan(resolve(import.meta.dirname, "../../../.."));
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.pillars).toHaveLength(8);
    expect(result.metadata.duration).toBeLessThan(60000);
  }, 60000);
});
