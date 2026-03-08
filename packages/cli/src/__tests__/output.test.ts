import { describe, it, expect } from "vitest";
import type { ScanResult } from "@prontiq/schema";
import { formatJson, formatJsonSchema } from "../output/json.js";
import { formatTerminal } from "../output/terminal.js";
import { formatMarkdown } from "../output/markdown.js";

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

  it("includes $schema and $id fields", () => {
    const output = formatJson(mockResult);
    const parsed = JSON.parse(output);
    expect(parsed.$schema).toBe(
      "https://prontiq.dev/schemas/ari-scan-result/v1.json",
    );
    expect(parsed.$id).toContain("ari-scan-");
    expect(parsed.$id).toContain(mockResult.metadata.timestamp);
  });

  it("includes contextFiles when present", () => {
    const resultWithCtx: ScanResult = {
      ...mockResult,
      contextFiles: [
        { path: "AGENTS.md", type: "agents-md", size: 512, lineCount: 20 },
        { path: ".cursorrules", type: "cursorrules" },
      ],
    };
    const output = formatJson(resultWithCtx);
    const parsed = JSON.parse(output);
    expect(parsed.contextFiles).toHaveLength(2);
    expect(parsed.contextFiles[0].type).toBe("agents-md");
  });

  it("includes pillar status when present", () => {
    const resultWithStatus: ScanResult = {
      ...mockResult,
      pillars: mockResult.pillars.map((p, i) =>
        i === 0 ? { ...p, status: "good" as const } : p,
      ),
    };
    const output = formatJson(resultWithStatus);
    const parsed = JSON.parse(output);
    expect(parsed.pillars[0].status).toBe("good");
  });
});

describe("formatJsonSchema", () => {
  it("produces valid JSON", () => {
    const output = formatJsonSchema();
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("has correct $schema and $id", () => {
    const parsed = JSON.parse(formatJsonSchema());
    expect(parsed.$schema).toBe(
      "https://json-schema.org/draft/2020-12/schema",
    );
    expect(parsed.$id).toBe(
      "https://prontiq.dev/schemas/ari-scan-result/v1.json",
    );
  });

  it("describes required top-level properties", () => {
    const parsed = JSON.parse(formatJsonSchema());
    expect(parsed.required).toContain("metadata");
    expect(parsed.required).toContain("score");
    expect(parsed.required).toContain("pillars");
    expect(parsed.required).toContain("findings");
    expect(parsed.properties.score).toBeDefined();
    expect(parsed.properties.pillars).toBeDefined();
  });

  it("defines finding in $defs", () => {
    const parsed = JSON.parse(formatJsonSchema());
    expect(parsed.$defs.finding).toBeDefined();
    expect(parsed.$defs.finding.properties.code.pattern).toBe(
      "^ARI-[A-Z]{3}-\\d{3}$",
    );
  });

  it("includes contextFiles in properties", () => {
    const parsed = JSON.parse(formatJsonSchema());
    expect(parsed.properties.contextFiles).toBeDefined();
    expect(parsed.properties.contextFiles.type).toBe("array");
  });

  it("includes pillar status enum in pillar items", () => {
    const parsed = JSON.parse(formatJsonSchema());
    const pillarProps = parsed.properties.pillars.items.properties;
    expect(pillarProps.status).toBeDefined();
    expect(pillarProps.status.enum).toContain("excellent");
    expect(pillarProps.status.enum).toContain("poor");
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

describe("formatMarkdown", () => {
  it("generates valid markdown with header", () => {
    const output = formatMarkdown(mockResult);
    expect(output).toContain("# ARI Score: 62/100");
    expect(output).toContain("L3");
    expect(output).toContain("Capable");
  });

  it("includes all required sections", () => {
    const output = formatMarkdown(mockResult);
    expect(output).toContain("# ARI Score:");
    expect(output).toContain("Routine tasks with moderate supervision");
    expect(output).toContain("## Pillar Scores");
    expect(output).toContain("| Pillar | Name | Score | Bar | Weight | Confidence |");
    expect(output).toContain("Agent Context Quality");
    expect(output).toContain("Security & Governance");
    expect(output).toContain("## Top Findings");
    expect(output).toContain("ARI-CTX-001");
    expect(output).toContain("No AGENTS.md found");
    expect(output).toContain("## Suggested Remediations");
    expect(output).toContain("Create an AGENTS.md file");
    expect(output).toContain("1234ms");
    expect(output).toContain("v0.1.0");
  });

  it("includes pillar score bars", () => {
    const output = formatMarkdown(mockResult);
    expect(output).toMatch(/`[█░]+`/);
  });

  it("handles empty findings gracefully", () => {
    const emptyResult: ScanResult = {
      ...mockResult,
      findings: [],
    };
    const output = formatMarkdown(emptyResult);
    expect(output).not.toContain("## Top Findings");
    expect(output).not.toContain("## Suggested Remediations");
    expect(output).toContain("# ARI Score:");
    expect(output).toContain("## Pillar Scores");
    expect(output).toContain("Scanned in");
  });

  it("shows security gate warning when triggered", () => {
    const gatedResult: ScanResult = { ...mockResult, securityGateTriggered: true };
    const output = formatMarkdown(gatedResult);
    expect(output).toContain("Security gate triggered");
    expect(output).toContain("maturity capped at L2");
  });

  it("sorts findings by severity", () => {
    const multiResult: ScanResult = {
      ...mockResult,
      findings: [
        {
          code: "ARI-CTX-002",
          severity: "low",
          pillar: "P1",
          message: "Low severity finding",
        },
        {
          code: "ARI-CTX-003",
          severity: "critical",
          pillar: "P1",
          message: "Critical severity finding",
        },
        {
          code: "ARI-CTX-001",
          severity: "high",
          pillar: "P1",
          message: "High severity finding",
        },
      ],
    };
    const output = formatMarkdown(multiResult);
    const criticalPos = output.indexOf("Critical severity finding");
    const highPos = output.indexOf("High severity finding");
    const lowPos = output.indexOf("Low severity finding");
    expect(criticalPos).toBeLessThan(highPos);
    expect(highPos).toBeLessThan(lowPos);
  });

  it("includes file location in findings when present", () => {
    const resultWithFile: ScanResult = {
      ...mockResult,
      findings: [
        {
          code: "ARI-CTX-001",
          severity: "high",
          pillar: "P1",
          file: "src/index.ts",
          line: 42,
          message: "Issue found",
        },
      ],
    };
    const output = formatMarkdown(resultWithFile);
    expect(output).toContain("`src/index.ts:42`");
  });
});
