import { describe, it, expect } from "vitest";
import type { ScanResult } from "@prontiq/schema";
import { formatJson } from "../output/json.js";
import { formatTerminal } from "../output/terminal.js";

const mockResult: ScanResult = {
  metadata: {
    version: "0.1.0",
    timestamp: "2026-03-08T00:00:00.000Z",
    duration: 1234,
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
  pillars: [
    {
      pillar: "P1",
      name: "Agent Context Quality",
      score: 70,
      weight: 0.15,
      confidence: "high",
      findings: [],
      summary: "Good context quality",
    },
    {
      pillar: "P8",
      name: "Security & Governance",
      score: 50,
      weight: 0.05,
      confidence: "medium",
      findings: [],
      summary: "Adequate security controls",
    },
  ],
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

describe("formatJson", () => {
  it("produces valid JSON", () => {
    const output = formatJson(mockResult);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("includes all required fields", () => {
    const output = formatJson(mockResult);
    const parsed = JSON.parse(output);
    expect(parsed.score).toBe(62);
    expect(parsed.level).toBe("L3");
    expect(parsed.metadata.version).toBe("0.1.0");
    expect(parsed.pillars).toHaveLength(2);
    expect(parsed.findings).toHaveLength(1);
  });
});

describe("formatTerminal", () => {
  it("includes the ARI score", () => {
    const output = formatTerminal(mockResult);
    expect(output).toContain("62");
  });

  it("includes the maturity level", () => {
    const output = formatTerminal(mockResult);
    expect(output).toContain("L3");
    expect(output).toContain("Capable");
  });

  it("includes pillar names", () => {
    const output = formatTerminal(mockResult);
    expect(output).toContain("Agent Context Quality");
    expect(output).toContain("Security & Governance");
  });

  it("includes top findings", () => {
    const output = formatTerminal(mockResult);
    expect(output).toContain("ARI-CTX-001");
    expect(output).toContain("No AGENTS.md found");
  });

  it("shows security gate warning when triggered", () => {
    const gatedResult = { ...mockResult, securityGateTriggered: true };
    const output = formatTerminal(gatedResult);
    expect(output).toContain("Security gate triggered");
  });
});
