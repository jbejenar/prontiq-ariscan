import { describe, it, expect } from "vitest";
import type { ScanResult } from "@prontiq/ariscan-schema";
import { formatMarkdown } from "../output/markdown.js";

const mockResult: ScanResult = {
  metadata: {
    version: "0.2.0",
    timestamp: "2026-03-08T00:00:00.000Z",
    duration: 500,
    repoPath: "/test/repo",
    rubricVersion: "v1",
  },
  score: 75,
  level: "L4",
  levelMeta: {
    level: "L4",
    name: "Productive",
    description: "Multi-file features and refactoring with light supervision",
  },
  securityGateTriggered: false,
  pillars: [
    {
      pillar: "P1",
      name: "Agent Context Quality",
      score: 90,
      weight: 0.15,
      confidence: "high",
      findings: [],
      summary: "Good",
    },
  ],
  findings: [],
};

describe("formatMarkdown edge cases", () => {
  it("truncates findings list beyond 10", () => {
    const manyFindings = Array.from({ length: 15 }, (_, i) => ({
      code: `ARI-CTX-${String(i + 1).padStart(3, "0")}`,
      severity: "medium" as const,
      pillar: "P1" as const,
      message: `Finding ${i + 1}`,
    }));
    const result: ScanResult = { ...mockResult, findings: manyFindings };
    const output = formatMarkdown(result);
    expect(output).toContain("and 5 more findings");
  });

  it("includes footer with scan metadata", () => {
    const output = formatMarkdown(mockResult);
    expect(output).toContain("500ms");
    expect(output).toContain("v0.2.0");
    expect(output).toContain("Rubric v1");
  });

  it("includes level badge in blockquote", () => {
    const output = formatMarkdown(mockResult);
    expect(output).toContain("> **L4** · 75/100");
  });

  it("renders pillar weight as percentage", () => {
    const output = formatMarkdown(mockResult);
    expect(output).toContain("15%");
  });

  it("includes estimated impact when remediation has it", () => {
    const resultWithImpact: ScanResult = {
      ...mockResult,
      findings: [
        {
          code: "ARI-CTX-001",
          severity: "high",
          pillar: "P1",
          message: "Missing file",
          remediation: {
            action: "create-file",
            description: "Create AGENTS.md",
            confidence: "high",
            estimatedImpact: "+12 points composite",
          },
        },
      ],
    };
    const output = formatMarkdown(resultWithImpact);
    expect(output).toContain("+12 points composite");
  });
});
