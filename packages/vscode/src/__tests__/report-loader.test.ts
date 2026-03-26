import { describe, it, expect } from "vitest";
import { parseReport, findingsForFile, fileSummary } from "../report-loader.js";
import type { ScanResult } from "../types.js";

function makeReport(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    metadata: {
      version: "0.2.0",
      timestamp: "2026-03-26T00:00:00.000Z",
      duration: 500,
      repoPath: "/repo",
    },
    score: 72,
    level: "L4",
    levelMeta: { level: "L4", name: "Productive", description: "" },
    securityGateTriggered: false,
    pillars: [],
    findings: [],
    ...overrides,
  };
}

describe("parseReport", () => {
  it("parses valid JSON report", () => {
    const report = makeReport();
    const result = parseReport(JSON.stringify(report));
    expect(result).not.toBeNull();
    expect(result?.score).toBe(72);
    expect(result?.level).toBe("L4");
  });

  it("returns null for invalid JSON", () => {
    expect(parseReport("{broken")).toBeNull();
  });

  it("returns null for valid JSON that is not a report", () => {
    expect(parseReport('{"name": "not a report"}')).toBeNull();
  });

  it("returns null for non-object JSON", () => {
    expect(parseReport("42")).toBeNull();
    expect(parseReport('"string"')).toBeNull();
    expect(parseReport("null")).toBeNull();
  });
});

describe("findingsForFile", () => {
  it("returns findings matching the file path", () => {
    const report = makeReport({
      findings: [
        {
          code: "ARI-CTX-001",
          severity: "medium",
          pillar: "P1",
          file: "src/index.ts",
          message: "Missing AGENTS.md",
        },
        {
          code: "ARI-TST-001",
          severity: "low",
          pillar: "P3",
          file: "tests/main.test.ts",
          message: "No isolation",
        },
        { code: "ARI-BLD-001", severity: "high", pillar: "P6", message: "No strict mode" },
      ],
    });

    const result = findingsForFile(report, "src/index.ts");
    expect(result).toHaveLength(1);
    expect(result[0]?.code).toBe("ARI-CTX-001");
  });

  it("returns empty array for files with no findings", () => {
    const report = makeReport({
      findings: [
        {
          code: "ARI-CTX-001",
          severity: "medium",
          pillar: "P1",
          file: "other.ts",
          message: "test",
        },
      ],
    });

    expect(findingsForFile(report, "src/index.ts")).toHaveLength(0);
  });

  it("handles backslash normalization", () => {
    const report = makeReport({
      findings: [
        {
          code: "ARI-CTX-001",
          severity: "medium",
          pillar: "P1",
          file: "src\\index.ts",
          message: "test",
        },
      ],
    });

    expect(findingsForFile(report, "src/index.ts")).toHaveLength(1);
  });
});

describe("fileSummary", () => {
  it("returns empty string for files with no findings", () => {
    const report = makeReport({ findings: [] });
    expect(fileSummary(report, "src/index.ts")).toBe("");
  });

  it("returns severity summary for files with findings", () => {
    const report = makeReport({
      findings: [
        { code: "ARI-CTX-001", severity: "high", pillar: "P1", file: "src/index.ts", message: "a" },
        {
          code: "ARI-CTX-002",
          severity: "medium",
          pillar: "P1",
          file: "src/index.ts",
          message: "b",
        },
        {
          code: "ARI-CTX-003",
          severity: "medium",
          pillar: "P1",
          file: "src/index.ts",
          message: "c",
        },
      ],
    });

    const result = fileSummary(report, "src/index.ts");
    expect(result).toContain("1 high");
    expect(result).toContain("2 medium");
  });

  it("excludes suppressed findings", () => {
    const report = makeReport({
      findings: [
        {
          code: "ARI-CTX-001",
          severity: "high",
          pillar: "P1",
          file: "src/index.ts",
          message: "a",
          suppressed: true,
        },
      ],
    });

    expect(fileSummary(report, "src/index.ts")).toBe("");
  });
});
