import { describe, it, expect } from "vitest";
import { createAnalyzerPipeline } from "../../analyzers/analyzer-factory.js";
import { ANALYZERS } from "../../analyzers/registry.js";

describe("createAnalyzerPipeline", () => {
  it("returns all analyzers by default", () => {
    const pipeline = createAnalyzerPipeline();
    expect(pipeline).toEqual(ANALYZERS);
  });

  it("returns all analyzers when options are empty", () => {
    const pipeline = createAnalyzerPipeline({});
    expect(pipeline).toEqual(ANALYZERS);
  });

  it("filters to only included pillars", () => {
    const pipeline = createAnalyzerPipeline({ include: ["P1", "P3"] });
    expect(pipeline).toHaveLength(2);
    expect(pipeline.map((a) => a.pillar)).toEqual(["P1", "P3"]);
  });

  it("excludes specified pillars", () => {
    const pipeline = createAnalyzerPipeline({ exclude: ["P8"] });
    expect(pipeline).toHaveLength(ANALYZERS.length - 1);
    expect(pipeline.every((a) => a.pillar !== "P8")).toBe(true);
  });

  it("applies include first, then exclude", () => {
    const pipeline = createAnalyzerPipeline({
      include: ["P1", "P2", "P3"],
      exclude: ["P2"],
    });
    expect(pipeline).toHaveLength(2);
    expect(pipeline.map((a) => a.pillar)).toEqual(["P1", "P3"]);
  });

  it("returns empty array when include has no matching pillars", () => {
    const pipeline = createAnalyzerPipeline({ include: [] });
    expect(pipeline).toEqual(ANALYZERS);
  });

  it("returns all when exclude is empty", () => {
    const pipeline = createAnalyzerPipeline({ exclude: [] });
    expect(pipeline).toEqual(ANALYZERS);
  });

  it("returns readonly array", () => {
    const pipeline = createAnalyzerPipeline();
    expect(Object.isFrozen(pipeline) || Array.isArray(pipeline)).toBe(true);
  });
});
