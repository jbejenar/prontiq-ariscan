import { describe, it, expect } from "vitest";
import type { ScanResult } from "@prontiq/ariscan-schema";
import { formatTerminal } from "../output/terminal.js";

const mockResult: ScanResult = {
  metadata: {
    version: "0.1.0",
    timestamp: "2026-03-08T00:00:00.000Z",
    duration: 800,
    repoPath: "/test/repo",
    rubricVersion: "v1",
  },
  score: 50,
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
  ],
  findings: [
    {
      code: "ARI-CTX-001",
      severity: "critical",
      pillar: "P1",
      message: "No AGENTS.md found",
      confidence: "high",
      remediation: {
        action: "create-file",
        path: "AGENTS.md",
        description: "Create an AGENTS.md file",
        confidence: "high",
      },
    },
  ],
};

describe("formatTerminal additional coverage", () => {
  it("includes duration in footer", () => {
    const output = formatTerminal(mockResult);
    expect(output).toContain("800ms");
  });

  it("includes rubric version in footer", () => {
    const output = formatTerminal(mockResult);
    expect(output).toContain("Rubric v1");
  });

  it("renders score bar with appropriate characters", () => {
    const output = formatTerminal(mockResult);
    // Score bars use unicode block characters
    expect(output).toContain("█");
    expect(output).toContain("░");
  });

  it("formats findings with file and line when present", () => {
    const resultWithFile: ScanResult = {
      ...mockResult,
      findings: [
        {
          code: "ARI-NAV-001",
          severity: "high",
          pillar: "P7",
          file: "src/utils.ts",
          line: 42,
          message: "High complexity function",
        },
      ],
    };
    const output = formatTerminal(resultWithFile);
    expect(output).toContain("src/utils.ts:42");
  });

  it("verbose mode shows remaining non-critical findings", () => {
    const resultWithMixed: ScanResult = {
      ...mockResult,
      findings: [
        { code: "ARI-CTX-001", severity: "high", pillar: "P1", message: "High sev" },
        { code: "ARI-CTX-002", severity: "medium", pillar: "P1", message: "Medium finding here" },
        { code: "ARI-CTX-003", severity: "low", pillar: "P1", message: "Low sev finding" },
      ],
    };
    const output = formatTerminal(resultWithMixed, { verbose: true });
    expect(output).toContain("All Findings");
    expect(output).toContain("Medium finding here");
  });

  it("verbose mode shows monorepo detection", () => {
    const resultWithMonorepo: ScanResult = {
      ...mockResult,
      detection: {
        languages: [{ language: "TypeScript", confidence: 0.9, primary: true }],
        frameworks: [],
        monorepo: { tool: "pnpm", workspaceRoot: ".", packages: ["packages/*"] },
      },
    };
    const output = formatTerminal(resultWithMonorepo, { verbose: true });
    expect(output).toContain("Monorepo:");
    expect(output).toContain("pnpm");
  });
});
