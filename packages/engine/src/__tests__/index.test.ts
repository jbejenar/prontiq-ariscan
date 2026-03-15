import { describe, it, expect } from "vitest";
import * as engine from "../index.js";

describe("engine barrel exports", () => {
  it("exports scan function", () => {
    expect(typeof engine.scan).toBe("function");
  });

  it("exports createRepoContext function", () => {
    expect(typeof engine.createRepoContext).toBe("function");
  });

  it("exports ANALYZERS registry", () => {
    expect(Array.isArray(engine.ANALYZERS)).toBe(true);
    expect(engine.ANALYZERS.length).toBe(8);
  });

  it("exports getAnalyzer function", () => {
    expect(typeof engine.getAnalyzer).toBe("function");
  });

  it("exports createAnalyzerPipeline function", () => {
    expect(typeof engine.createAnalyzerPipeline).toBe("function");
  });

  it("exports scoring functions", () => {
    expect(typeof engine.calculateCompositeScore).toBe("function");
    expect(typeof engine.classifyMaturityLevel).toBe("function");
    expect(typeof engine.applySecurityGate).toBe("function");
    expect(typeof engine.aggregateResults).toBe("function");
  });

  it("exports detection functions", () => {
    expect(typeof engine.detect).toBe("function");
    expect(typeof engine.detectLanguages).toBe("function");
    expect(typeof engine.detectFrameworks).toBe("function");
    expect(typeof engine.detectMonorepo).toBe("function");
  });

  it("exports budget functions", () => {
    expect(typeof engine.analyzeTokenBudget).toBe("function");
    expect(typeof engine.formatTokenCount).toBe("function");
    expect(typeof engine.classifyFile).toBe("function");
    expect(typeof engine.estimateTokens).toBe("function");
  });

  it("exports fix functions", () => {
    expect(typeof engine.generateFixProposals).toBe("function");
  });

  it("exports agentignore functions", () => {
    expect(typeof engine.parseAgentignore).toBe("function");
    expect(typeof engine.matchesPattern).toBe("function");
    expect(typeof engine.shouldIgnore).toBe("function");
    expect(typeof engine.getDefaultPatterns).toBe("function");
  });

  it("exports telemetry functions", () => {
    expect(typeof engine.getTelemetryConsent).toBe("function");
    expect(typeof engine.setTelemetryConsent).toBe("function");
    expect(typeof engine.buildTelemetryPayload).toBe("function");
    expect(typeof engine.sendTelemetry).toBe("function");
  });
});
