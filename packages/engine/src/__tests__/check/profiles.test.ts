import { describe, it, expect } from "vitest";
import { getPillarsByProfile } from "../../check/profiles.js";

describe("getPillarsByProfile", () => {
  it("fast profile includes P1, P4, P8 only", () => {
    const pillars = getPillarsByProfile("fast");
    expect(pillars).toEqual(["P1", "P4", "P8"]);
  });

  it("standard profile includes fast pillars plus P3, P6, P7", () => {
    const pillars = getPillarsByProfile("standard");
    expect(pillars).toEqual(["P1", "P3", "P4", "P6", "P7", "P8"]);
  });

  it("thorough profile includes all 8 pillars", () => {
    const pillars = getPillarsByProfile("thorough");
    expect(pillars).toHaveLength(8);
    expect(pillars).toContain("P1");
    expect(pillars).toContain("P2");
    expect(pillars).toContain("P3");
    expect(pillars).toContain("P4");
    expect(pillars).toContain("P5");
    expect(pillars).toContain("P6");
    expect(pillars).toContain("P7");
    expect(pillars).toContain("P8");
  });

  it("fast profile is a subset of standard", () => {
    const fast = getPillarsByProfile("fast");
    const standard = getPillarsByProfile("standard");
    for (const pillar of fast) {
      expect(standard).toContain(pillar);
    }
  });

  it("standard profile is a subset of thorough", () => {
    const standard = getPillarsByProfile("standard");
    const thorough = getPillarsByProfile("thorough");
    for (const pillar of standard) {
      expect(thorough).toContain(pillar);
    }
  });
});
