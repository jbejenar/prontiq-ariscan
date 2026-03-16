import { describe, it, expect } from "vitest";
import type { ScanResult } from "@prontiq/ariscan-schema";
import { formatJson, formatJsonSchema, getJsonSchemaObject } from "../output/json.js";
import { formatTerminal } from "../output/terminal.js";
import { formatMarkdown } from "../output/markdown.js";
import { formatSarif } from "../output/sarif.js";
import { generateBadgeSvg, generateBadgeSnippets } from "../output/badge.js";

const mockResult: ScanResult = {
  metadata: {
    version: "0.2.0",
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
    expect(parsed.metadata.version).toBe("0.2.0");
    expect(parsed.pillars).toHaveLength(2);
    expect(parsed.findings).toHaveLength(1);
  });

  it("includes $schema and $id fields", () => {
    const output = formatJson(mockResult);
    const parsed = JSON.parse(output);
    expect(parsed.$schema).toBe("https://prontiq.dev/schemas/ari-scan-result/v1.json");
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
      pillars: mockResult.pillars.map((p, i) => (i === 0 ? { ...p, status: "good" as const } : p)),
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
    expect(parsed.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(parsed.$id).toBe("https://prontiq.dev/schemas/ari-scan-result/v1.json");
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
    expect(parsed.$defs.finding.properties.code.pattern).toBe("^ARI-[A-Z]{3}-\\d{3}$");
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

describe("getJsonSchemaObject", () => {
  it("returns the same object that formatJsonSchema serializes", () => {
    const obj = getJsonSchemaObject();
    const fromFormat = JSON.parse(formatJsonSchema());
    expect(obj).toEqual(fromFormat);
  });
});

describe("JSON output validates against schema", () => {
  it("JSON output contains all schema-required fields", () => {
    const schema = getJsonSchemaObject() as Record<string, unknown>;
    const output = JSON.parse(formatJson(mockResult));
    const required = schema["required"] as string[];
    for (const field of required) {
      expect(output).toHaveProperty(field);
    }
  });

  it("finding codes match the schema pattern", () => {
    const pattern = /^ARI-[A-Z]{3}-\d{3}$/;
    for (const finding of mockResult.findings) {
      expect(finding.code).toMatch(pattern);
    }
  });

  it("pillar scores are within 0-100", () => {
    for (const pillar of mockResult.pillars) {
      expect(pillar.score).toBeGreaterThanOrEqual(0);
      expect(pillar.score).toBeLessThanOrEqual(100);
    }
  });

  it("composite score is within 0-100", () => {
    const output = JSON.parse(formatJson(mockResult));
    expect(output.score).toBeGreaterThanOrEqual(0);
    expect(output.score).toBeLessThanOrEqual(100);
  });

  it("level is a valid maturity level", () => {
    const output = JSON.parse(formatJson(mockResult));
    expect(["L1", "L2", "L3", "L4", "L5"]).toContain(output.level);
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

  it("quiet mode outputs single-line summary", () => {
    const output = formatTerminal(mockResult, { quiet: true });
    expect(output).toBe("ARI 62/100 L3 (Capable)\n");
  });

  it("quiet mode includes security gate flag when triggered", () => {
    const gatedResult = { ...mockResult, securityGateTriggered: true };
    const output = formatTerminal(gatedResult, { quiet: true });
    expect(output).toContain("[SECURITY GATE]");
  });

  it("verbose mode shows pillar details section", () => {
    const output = formatTerminal(mockResult, { verbose: true });
    expect(output).toContain("Pillar Details");
    expect(output).toContain("confidence:");
    expect(output).toContain("summary:");
  });

  it("verbose mode shows detection info when present", () => {
    const resultWithDetection: ScanResult = {
      ...mockResult,
      detection: {
        languages: [{ language: "TypeScript", confidence: 0.95, primary: true }],
        frameworks: [{ framework: "React", confidence: 0.8 }],
        monorepo: null,
      },
    };
    const output = formatTerminal(resultWithDetection, { verbose: true });
    expect(output).toContain("Detection");
    expect(output).toContain("TypeScript");
    expect(output).toContain("React");
  });

  it("verbose mode shows context files when present", () => {
    const resultWithCtx: ScanResult = {
      ...mockResult,
      contextFiles: [{ path: "AGENTS.md", type: "agents-md", size: 512, parseStatus: "valid" }],
    };
    const output = formatTerminal(resultWithCtx, { verbose: true });
    expect(output).toContain("Context Files");
    expect(output).toContain("AGENTS.md");
    expect(output).toContain("[valid]");
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
    expect(output).toContain("v0.2.0");
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

  it("includes Quick Start section with top 3 actions", () => {
    const resultWithRemediations: ScanResult = {
      ...mockResult,
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
        {
          code: "ARI-BLD-001",
          severity: "high",
          pillar: "P6",
          message: "TypeScript strict mode not enabled",
          remediation: {
            action: "modify-config",
            description: "Enable strict: true",
            confidence: "high",
          },
        },
        {
          code: "ARI-ENV-001",
          severity: "medium",
          pillar: "P4",
          message: "No devcontainer",
          remediation: {
            action: "create-file",
            description: "Add devcontainer config",
            confidence: "medium",
          },
        },
      ],
    };
    const output = formatMarkdown(resultWithRemediations);
    expect(output).toContain("## Quick Start: Top 3 Actions");
    expect(output).toContain("1.");
    expect(output).toContain("2.");
    expect(output).toContain("3.");
  });

  it("orders remediations by impact × ease", () => {
    const resultWithMixed: ScanResult = {
      ...mockResult,
      findings: [
        {
          code: "ARI-CTX-002",
          severity: "low",
          pillar: "P1",
          message: "Low with low confidence",
          remediation: {
            action: "refactor",
            description: "Low impact action",
            confidence: "low",
          },
        },
        {
          code: "ARI-CTX-001",
          severity: "high",
          pillar: "P1",
          message: "High with high confidence",
          remediation: {
            action: "create-file",
            description: "High impact action",
            confidence: "high",
          },
        },
      ],
    };
    const output = formatMarkdown(resultWithMixed);
    const highPos = output.indexOf("High impact action");
    const lowPos = output.indexOf("Low impact action");
    expect(highPos).toBeLessThan(lowPos);
  });

  it("excludes info-severity findings from Quick Start", () => {
    const resultWithInfo: ScanResult = {
      ...mockResult,
      findings: [
        {
          code: "ARI-ENV-005",
          severity: "info",
          pillar: "P4",
          message: "Devcontainer: pass",
          remediation: {
            action: "create-file",
            description: "Informational only",
            confidence: "high",
          },
        },
      ],
    };
    const output = formatMarkdown(resultWithInfo);
    expect(output).not.toContain("## Quick Start: Top 3 Actions");
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

describe("formatSarif", () => {
  it("produces valid JSON", () => {
    const output = formatSarif(mockResult);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("follows SARIF 2.1.0 structure", () => {
    const parsed = JSON.parse(formatSarif(mockResult));
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.$schema).toContain("sarif-schema-2.1.0");
    expect(parsed.runs).toHaveLength(1);
  });

  it("includes tool driver info", () => {
    const parsed = JSON.parse(formatSarif(mockResult));
    const driver = parsed.runs[0].tool.driver;
    expect(driver.name).toBe("ariscan");
    expect(driver.version).toBe("0.2.0");
  });

  it("maps findings to SARIF results", () => {
    const parsed = JSON.parse(formatSarif(mockResult));
    expect(parsed.runs[0].results).toHaveLength(1);
    expect(parsed.runs[0].results[0].ruleId).toBe("ARI-CTX-001");
    expect(parsed.runs[0].results[0].level).toBe("error");
  });

  it("deduplicates rules", () => {
    const resultWithDupes: ScanResult = {
      ...mockResult,
      findings: [
        { code: "ARI-CTX-001", severity: "high", pillar: "P1", message: "Finding 1" },
        { code: "ARI-CTX-001", severity: "high", pillar: "P1", message: "Finding 2" },
      ],
    };
    const parsed = JSON.parse(formatSarif(resultWithDupes));
    expect(parsed.runs[0].results).toHaveLength(2);
    expect(parsed.runs[0].tool.driver.rules).toHaveLength(1);
  });

  it("includes file locations when present", () => {
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
    const parsed = JSON.parse(formatSarif(resultWithFile));
    const location = parsed.runs[0].results[0].locations[0].physicalLocation;
    expect(location.artifactLocation.uri).toBe("src/index.ts");
    expect(location.region.startLine).toBe(42);
  });

  it("includes invocation with score metadata", () => {
    const parsed = JSON.parse(formatSarif(mockResult));
    const invocation = parsed.runs[0].invocations[0];
    expect(invocation.executionSuccessful).toBe(true);
    expect(invocation.properties.score).toBe(62);
    expect(invocation.properties.level).toBe("L3");
  });

  it("maps severity to correct SARIF levels", () => {
    const multiSev: ScanResult = {
      ...mockResult,
      findings: [
        { code: "ARI-CTX-001", severity: "critical", pillar: "P1", message: "crit" },
        { code: "ARI-CTX-002", severity: "medium", pillar: "P1", message: "med" },
        { code: "ARI-CTX-003", severity: "info", pillar: "P1", message: "info" },
      ],
    };
    const parsed = JSON.parse(formatSarif(multiSev));
    expect(parsed.runs[0].results[0].level).toBe("error");
    expect(parsed.runs[0].results[1].level).toBe("warning");
    expect(parsed.runs[0].results[2].level).toBe("note");
  });
});

describe("generateBadgeSvg", () => {
  it("produces valid SVG", () => {
    const svg = generateBadgeSvg(mockResult);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("includes score and level", () => {
    const svg = generateBadgeSvg(mockResult);
    expect(svg).toContain("Agent-Ready");
    expect(svg).toContain("L3 (62/100)");
  });

  it("uses correct color for level", () => {
    const l1Result = { ...mockResult, level: "L1" as const };
    const l5Result = { ...mockResult, level: "L5" as const };
    const l1Svg = generateBadgeSvg(l1Result);
    const l5Svg = generateBadgeSvg(l5Result);
    expect(l1Svg).toContain("#e05d44"); // red
    expect(l5Svg).toContain("#44cc11"); // bright green
  });

  it("has accessible attributes", () => {
    const svg = generateBadgeSvg(mockResult);
    expect(svg).toContain('role="img"');
    expect(svg).toContain("aria-label");
  });
});

describe("generateBadgeSnippets", () => {
  it("includes markdown snippet", () => {
    const snippets = generateBadgeSnippets("badge.svg");
    expect(snippets).toContain("![Agent-Ready](badge.svg)");
  });

  it("includes HTML snippet", () => {
    const snippets = generateBadgeSnippets("badge.svg");
    expect(snippets).toContain('<img src="badge.svg"');
  });

  it("includes reStructuredText snippet", () => {
    const snippets = generateBadgeSnippets("badge.svg");
    expect(snippets).toContain(".. image:: badge.svg");
  });
});
