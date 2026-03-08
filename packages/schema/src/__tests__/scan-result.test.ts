import { describe, it, expect } from "vitest";
import { Finding, PillarResult, ScanResult } from "../scan-result.js";

describe("Finding", () => {
  it("validates a valid finding", () => {
    const finding = {
      code: "ARI-CTX-001",
      severity: "high",
      pillar: "P1",
      message: "No AGENTS.md found",
      remediation: {
        action: "create-file" as const,
        path: "AGENTS.md",
        description: "Create an AGENTS.md file",
        confidence: "high" as const,
      },
    };
    expect(() => Finding.parse(finding)).not.toThrow();
  });

  it("rejects invalid ARI code format", () => {
    expect(() => Finding.parse({
      code: "INVALID",
      severity: "high",
      pillar: "P1",
      message: "test",
    })).toThrow();
  });

  it("rejects invalid severity", () => {
    expect(() => Finding.parse({
      code: "ARI-CTX-001",
      severity: "extreme",
      pillar: "P1",
      message: "test",
    })).toThrow();
  });
});

describe("PillarResult", () => {
  it("validates a valid pillar result", () => {
    const result = {
      pillar: "P1",
      name: "Agent Context Quality",
      score: 75,
      weight: 0.15,
      confidence: "high" as const,
      findings: [],
      summary: "Good context quality",
    };
    expect(() => PillarResult.parse(result)).not.toThrow();
  });

  it("rejects score out of range", () => {
    expect(() => PillarResult.parse({
      pillar: "P1",
      name: "Test",
      score: 101,
      weight: 0.15,
      confidence: "high",
      findings: [],
      summary: "test",
    })).toThrow();
  });
});

describe("ScanResult", () => {
  it("validates a complete scan result", () => {
    const result = {
      metadata: {
        version: "0.1.0",
        timestamp: "2026-03-08T00:00:00.000Z",
        duration: 1234,
        repoPath: "/test/repo",
      },
      score: 62,
      level: "L3",
      levelMeta: {
        level: "L3",
        name: "Capable",
        description: "Routine tasks with moderate supervision",
      },
      securityGateTriggered: false,
      pillars: [],
      findings: [],
    };
    expect(() => ScanResult.parse(result)).not.toThrow();
  });
});
