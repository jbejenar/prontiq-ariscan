import { describe, it, expect } from "vitest";
import type { ScanResult } from "@prontiq/ariscan-schema";
import { formatSarif } from "../output/sarif.js";

const mockResult: ScanResult = {
  metadata: {
    version: "0.2.0",
    timestamp: "2026-03-08T00:00:00.000Z",
    duration: 500,
    repoPath: "/test/repo",
    rubricVersion: "v1",
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
  findings: [
    {
      code: "ARI-CTX-001",
      severity: "high",
      pillar: "P1",
      message: "No AGENTS.md found",
      remediation: {
        action: "create-file",
        path: "AGENTS.md",
        description: "Create an AGENTS.md file",
        confidence: "high",
      },
    },
  ],
};

describe("formatSarif additional coverage", () => {
  it("includes rubricVersion in tool properties", () => {
    const parsed = JSON.parse(formatSarif(mockResult));
    expect(parsed.runs[0].tool.driver.properties.rubricVersion).toBe("v1");
  });

  it("includes helpUri with finding code in rules", () => {
    const parsed = JSON.parse(formatSarif(mockResult));
    const rule = parsed.runs[0].tool.driver.rules[0];
    expect(rule.helpUri).toContain("ARI-CTX-001");
  });

  it("includes fix description when remediation present", () => {
    const parsed = JSON.parse(formatSarif(mockResult));
    const result = parsed.runs[0].results[0];
    expect(result.fixes).toBeDefined();
    expect(result.fixes[0].description.text).toContain("Create an AGENTS.md file");
  });

  it("includes evidence in rule properties when present", () => {
    const resultWithEvidence: ScanResult = {
      ...mockResult,
      findings: [
        {
          code: "ARI-TST-001",
          severity: "high",
          pillar: "P3",
          message: "Cloud SDK in test",
          evidence: {
            paper: "Berndt et al., 2026",
            finding: "63% flaky tests",
            confidence: "high",
          },
        },
      ],
    };
    const parsed = JSON.parse(formatSarif(resultWithEvidence));
    const rule = parsed.runs[0].tool.driver.rules[0];
    expect(rule.properties.evidence.paper).toBe("Berndt et al., 2026");
  });

  it("handles findings without file location", () => {
    const parsed = JSON.parse(formatSarif(mockResult));
    const result = parsed.runs[0].results[0];
    expect(result.locations).toBeUndefined();
  });

  it("handles findings without remediation", () => {
    const resultNoRemediation: ScanResult = {
      ...mockResult,
      findings: [
        {
          code: "ARI-CTX-002",
          severity: "medium",
          pillar: "P1",
          message: "Info only",
        },
      ],
    };
    const parsed = JSON.parse(formatSarif(resultNoRemediation));
    const rule = parsed.runs[0].tool.driver.rules[0];
    expect(rule.fullDescription).toBeUndefined();
  });

  it("handles empty findings array", () => {
    const emptyResult: ScanResult = { ...mockResult, findings: [] };
    const parsed = JSON.parse(formatSarif(emptyResult));
    expect(parsed.runs[0].results).toHaveLength(0);
    expect(parsed.runs[0].tool.driver.rules).toHaveLength(0);
  });
});
