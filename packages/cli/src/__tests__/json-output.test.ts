/** Tests for JSON output formatting, NDJSON streaming, and JSON Schema generation. */
import { describe, it, expect } from "vitest";
import type { ScanResult } from "@prontiq/ariscan-schema";
import { formatJson, formatNdjson, getJsonSchemaObject } from "../output/json.js";

const mockResult: ScanResult = {
  metadata: {
    version: "0.1.0",
    timestamp: "2026-03-08T00:00:00.000Z",
    duration: 500,
    repoPath: "/test/repo",
    rubricVersion: "v1",
  },
  score: 55,
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

describe("formatJson additional coverage", () => {
  it("ends with newline", () => {
    const output = formatJson(mockResult);
    expect(output.endsWith("\n")).toBe(true);
  });

  it("is pretty-printed with 2-space indent", () => {
    const output = formatJson(mockResult);
    expect(output).toContain("  ");
    const lines = output.split("\n").filter((l) => l.trim());
    expect(lines.length).toBeGreaterThan(1);
  });

  it("includes detection data when present", () => {
    const resultWithDetection: ScanResult = {
      ...mockResult,
      detection: {
        languages: [{ language: "TypeScript", confidence: 0.95, primary: true }],
        frameworks: [],
        monorepo: null,
      },
    };
    const parsed = JSON.parse(formatJson(resultWithDetection));
    expect(parsed.detection).toBeDefined();
    expect(parsed.detection.languages[0].language).toBe("TypeScript");
  });

  it("includes securityGateTriggered flag", () => {
    const gatedResult: ScanResult = { ...mockResult, securityGateTriggered: true };
    const parsed = JSON.parse(formatJson(gatedResult));
    expect(parsed.securityGateTriggered).toBe(true);
  });
});

describe("getJsonSchemaObject additional coverage", () => {
  it("defines detection as optional", () => {
    const schema = getJsonSchemaObject();
    const required = schema["required"] as string[];
    expect(required).not.toContain("detection");
  });

  it("defines severity enum in finding", () => {
    const schema = getJsonSchemaObject();
    const defs = schema["$defs"] as Record<string, Record<string, unknown>>;
    const findingDef = defs?.["finding"];
    expect(findingDef).toBeDefined();
    if (!findingDef) return;
    const props = findingDef["properties"] as Record<string, Record<string, unknown>>;
    const severity = props?.["severity"];
    expect(severity).toBeDefined();
    if (!severity) return;
    const severityEnum = severity["enum"] as string[];
    expect(severityEnum).toContain("critical");
    expect(severityEnum).toContain("info");
  });

  it("defines remediation action enum", () => {
    const schema = getJsonSchemaObject();
    const defs = schema["$defs"] as Record<string, Record<string, unknown>>;
    const findingDef = defs?.["finding"];
    expect(findingDef).toBeDefined();
    if (!findingDef) return;
    const props = findingDef["properties"] as Record<string, Record<string, unknown>>;
    const remediation = props?.["remediation"] as Record<string, unknown> | undefined;
    expect(remediation).toBeDefined();
    if (!remediation) return;
    const remProps = remediation["properties"] as Record<string, Record<string, unknown>>;
    const actionEnum = remProps?.["action"]?.["enum"] as string[];
    expect(actionEnum).toContain("create-file");
    expect(actionEnum).toContain("refactor");
  });
});

const ndjsonResult: ScanResult = {
  ...mockResult,
  pillars: [
    {
      pillar: "P1",
      name: "Agent Context Quality",
      score: 70,
      weight: 0.15,
      confidence: "high",
      findings: [],
      summary: "Good context",
    },
    {
      pillar: "P6",
      name: "Build Determinism & Type Safety",
      score: 85,
      weight: 0.15,
      confidence: "high",
      findings: [],
      summary: "Strong build",
    },
  ],
};

describe("formatNdjson", () => {
  it("produces one JSON object per line", () => {
    const output = formatNdjson(ndjsonResult);
    const lines = output.trim().split("\n");
    // metadata + 2 pillars + summary = 4 lines
    expect(lines).toHaveLength(4);
  });

  it("each line is independently parseable JSON", () => {
    const output = formatNdjson(ndjsonResult);
    const lines = output.trim().split("\n");
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("first line has type metadata", () => {
    const output = formatNdjson(ndjsonResult);
    const lines = output.trim().split("\n");
    const first = JSON.parse(lines[0] ?? "");
    expect(first.type).toBe("metadata");
    expect(first.version).toBe("0.1.0");
    expect(first.timestamp).toBeDefined();
  });

  it("middle lines have type pillar", () => {
    const output = formatNdjson(ndjsonResult);
    const lines = output.trim().split("\n");
    const pillarLines = lines.slice(1, -1);
    for (const line of pillarLines) {
      const parsed = JSON.parse(line);
      expect(parsed.type).toBe("pillar");
      expect(parsed.pillar).toBeDefined();
      expect(parsed.score).toBeDefined();
    }
  });

  it("last line has type summary with score and level", () => {
    const output = formatNdjson(ndjsonResult);
    const lines = output.trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1] ?? "");
    expect(last.type).toBe("summary");
    expect(last.score).toBe(55);
    expect(last.level).toBe("L3");
    expect(last.securityGateTriggered).toBe(false);
  });

  it("ends with a newline", () => {
    const output = formatNdjson(ndjsonResult);
    expect(output.endsWith("\n")).toBe(true);
  });

  it("includes detection in summary when present", () => {
    const resultWithDetection: ScanResult = {
      ...ndjsonResult,
      detection: {
        languages: [{ language: "TypeScript", confidence: 0.95, primary: true }],
        frameworks: [],
        monorepo: null,
      },
    };
    const output = formatNdjson(resultWithDetection);
    const lines = output.trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1] ?? "");
    expect(last.detection).toBeDefined();
    expect(last.detection.languages[0].language).toBe("TypeScript");
  });

  it("handles empty pillars array", () => {
    const output = formatNdjson(mockResult);
    const lines = output.trim().split("\n");
    // metadata + summary = 2 lines (no pillar lines)
    expect(lines).toHaveLength(2);
  });
});
