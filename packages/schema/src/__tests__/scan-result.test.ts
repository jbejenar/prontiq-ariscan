import { describe, it, expect } from "vitest";
import {
  Finding,
  PillarResult,
  ScanResult,
  ContextFileInfo,
  scoreToStatus,
} from "../scan-result.js";

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
    expect(() =>
      Finding.parse({
        code: "INVALID",
        severity: "high",
        pillar: "P1",
        message: "test",
      }),
    ).toThrow();
  });

  it("rejects invalid severity", () => {
    expect(() =>
      Finding.parse({
        code: "ARI-CTX-001",
        severity: "extreme",
        pillar: "P1",
        message: "test",
      }),
    ).toThrow();
  });

  it("accepts a finding with evidence (research citation)", () => {
    const finding = {
      code: "ARI-CTX-001",
      severity: "medium",
      pillar: "P1",
      message: "Test finding",
      evidence: {
        paper: "Doe et al. 2025",
        finding: "Context files improve agent accuracy by 30%",
        confidence: "high" as const,
      },
    };
    const parsed = Finding.parse(finding);
    expect(parsed.evidence).toBeDefined();
    expect(parsed.evidence?.paper).toBe("Doe et al. 2025");
  });

  it("accepts remediation with estimatedImpact string", () => {
    const finding = {
      code: "ARI-CTX-001",
      severity: "high",
      pillar: "P1",
      message: "Missing file",
      remediation: {
        action: "create-file" as const,
        path: "AGENTS.md",
        description: "Create an AGENTS.md file",
        estimatedImpact: "+12 points composite",
        confidence: "high" as const,
      },
    };
    const parsed = Finding.parse(finding);
    expect(parsed.remediation?.estimatedImpact).toBe("+12 points composite");
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
    expect(() =>
      PillarResult.parse({
        pillar: "P1",
        name: "Test",
        score: 101,
        weight: 0.15,
        confidence: "high",
        findings: [],
        summary: "test",
      }),
    ).toThrow();
  });

  it("accepts an optional status field", () => {
    const result = {
      pillar: "P1",
      name: "Agent Context Quality",
      score: 85,
      weight: 0.15,
      confidence: "high" as const,
      findings: [],
      summary: "Excellent context quality",
      status: "excellent" as const,
    };
    const parsed = PillarResult.parse(result);
    expect(parsed.status).toBe("excellent");
  });

  it("rejects invalid status value", () => {
    expect(() => PillarResult.parse({
      pillar: "P1",
      name: "Test",
      score: 50,
      weight: 0.15,
      confidence: "high",
      findings: [],
      summary: "test",
      status: "amazing",
    })).toThrow();
  });
});

describe("scoreToStatus", () => {
  it("returns excellent for scores >= 80", () => {
    expect(scoreToStatus(80)).toBe("excellent");
    expect(scoreToStatus(100)).toBe("excellent");
  });

  it("returns good for scores >= 60 and < 80", () => {
    expect(scoreToStatus(60)).toBe("good");
    expect(scoreToStatus(79)).toBe("good");
  });

  it("returns needs-improvement for scores >= 40 and < 60", () => {
    expect(scoreToStatus(40)).toBe("needs-improvement");
    expect(scoreToStatus(59)).toBe("needs-improvement");
  });

  it("returns poor for scores < 40", () => {
    expect(scoreToStatus(0)).toBe("poor");
    expect(scoreToStatus(39)).toBe("poor");
  });
});

describe("ContextFileInfo", () => {
  it("validates a minimal context file entry", () => {
    const entry = { path: "AGENTS.md", type: "agents-md" as const };
    expect(() => ContextFileInfo.parse(entry)).not.toThrow();
  });

  it("validates a full context file entry with size and lineCount", () => {
    const entry = {
      path: ".cursorrules",
      type: "cursorrules" as const,
      size: 2048,
      lineCount: 45,
    };
    const parsed = ContextFileInfo.parse(entry);
    expect(parsed.size).toBe(2048);
    expect(parsed.lineCount).toBe(45);
  });

  it("rejects unknown context file type", () => {
    expect(() => ContextFileInfo.parse({
      path: "foo.txt",
      type: "unknown-type",
    })).toThrow();
  });

  it("accepts the other type for unclassified files", () => {
    const entry = { path: ".custom-agent-config", type: "other" as const };
    expect(() => ContextFileInfo.parse(entry)).not.toThrow();
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

  it("accepts optional contextFiles array", () => {
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
      contextFiles: [
        { path: "AGENTS.md", type: "agents-md", size: 1024, lineCount: 30 },
        { path: ".cursorrules", type: "cursorrules" },
      ],
    };
    const parsed = ScanResult.parse(result);
    expect(parsed.contextFiles).toHaveLength(2);
    expect(parsed.contextFiles?.[0]?.type).toBe("agents-md");
  });

  it("accepts optional detection field", () => {
    const result = {
      metadata: {
        version: "0.1.0",
        timestamp: "2026-03-08T00:00:00.000Z",
        duration: 500,
        repoPath: "/test/repo",
      },
      score: 50,
      level: "L2",
      levelMeta: {
        level: "L2",
        name: "Basic",
        description: "Simple tasks with heavy supervision",
      },
      securityGateTriggered: false,
      pillars: [],
      findings: [],
      detection: {
        languages: [{ language: "TypeScript", confidence: 0.95, primary: true }],
        frameworks: [{ framework: "React", confidence: 0.8 }],
        monorepo: null,
      },
    };
    const parsed = ScanResult.parse(result);
    expect(parsed.detection?.languages).toHaveLength(1);
  });
});
