import { describe, it, expect } from "vitest";
import { findingsToDiagnostics, groupByFile, mapSeverity, DiagSeverity } from "../diagnostics.js";
import type { Finding } from "../types.js";

describe("mapSeverity", () => {
  it("maps critical to Error", () => {
    expect(mapSeverity("critical")).toBe(DiagSeverity.Error);
  });

  it("maps high to Error", () => {
    expect(mapSeverity("high")).toBe(DiagSeverity.Error);
  });

  it("maps medium to Warning", () => {
    expect(mapSeverity("medium")).toBe(DiagSeverity.Warning);
  });

  it("maps low to Information", () => {
    expect(mapSeverity("low")).toBe(DiagSeverity.Information);
  });

  it("maps info to Hint", () => {
    expect(mapSeverity("info")).toBe(DiagSeverity.Hint);
  });
});

describe("findingsToDiagnostics", () => {
  it("converts findings with file references to diagnostics", () => {
    const findings: Finding[] = [
      {
        code: "ARI-CTX-001",
        severity: "medium",
        pillar: "P1",
        file: "src/index.ts",
        line: 10,
        message: "Missing context",
      },
      {
        code: "ARI-BLD-001",
        severity: "high",
        pillar: "P6",
        file: "tsconfig.json",
        message: "No strict mode",
      },
    ];

    const diags = findingsToDiagnostics(findings);
    expect(diags).toHaveLength(2);
    expect(diags[0]?.file).toBe("src/index.ts");
    expect(diags[0]?.line).toBe(10);
    expect(diags[0]?.severity).toBe(DiagSeverity.Warning);
    expect(diags[1]?.line).toBe(1); // Default line when not specified
  });

  it("excludes findings without file references", () => {
    const findings: Finding[] = [
      { code: "ARI-CTX-001", severity: "medium", pillar: "P1", message: "No file" },
    ];

    expect(findingsToDiagnostics(findings)).toHaveLength(0);
  });

  it("excludes suppressed findings", () => {
    const findings: Finding[] = [
      {
        code: "ARI-CTX-001",
        severity: "medium",
        pillar: "P1",
        file: "src/x.ts",
        message: "Suppressed",
        suppressed: true,
      },
    ];

    expect(findingsToDiagnostics(findings)).toHaveLength(0);
  });

  it("includes remediation description in message", () => {
    const findings: Finding[] = [
      {
        code: "ARI-CTX-001",
        severity: "medium",
        pillar: "P1",
        file: "src/x.ts",
        message: "Missing AGENTS.md",
        remediation: {
          action: "create-file",
          description: "Create an AGENTS.md file",
          confidence: "high",
        },
      },
    ];

    const diags = findingsToDiagnostics(findings);
    expect(diags[0]?.message).toContain("Create an AGENTS.md file");
  });
});

describe("groupByFile", () => {
  it("groups diagnostics by file path", () => {
    const diags = findingsToDiagnostics([
      { code: "ARI-CTX-001", severity: "medium", pillar: "P1", file: "src/a.ts", message: "a" },
      { code: "ARI-CTX-002", severity: "low", pillar: "P1", file: "src/a.ts", message: "b" },
      { code: "ARI-BLD-001", severity: "high", pillar: "P6", file: "src/b.ts", message: "c" },
    ]);

    const grouped = groupByFile(diags);
    expect(grouped.size).toBe(2);
    expect(grouped.get("src/a.ts")).toHaveLength(2);
    expect(grouped.get("src/b.ts")).toHaveLength(1);
  });

  it("returns empty map for empty input", () => {
    expect(groupByFile([]).size).toBe(0);
  });
});
