import { describe, it, expect } from "vitest";
import type { ScanResult } from "@prontiq/ariscan-schema";
import type { TokenBudgetResult } from "@prontiq/ariscan-engine";
import {
  extractScore,
  extractPillars,
  extractRecommendations,
  extractContextFiles,
  extractBudget,
} from "../resources/index.js";

/** Minimal mock ScanResult for testing resource extractors. */
function mockScanResult(): ScanResult {
  return {
    metadata: {
      version: "0.2.0",
      timestamp: "2026-03-26T00:00:00.000Z",
      duration: 1234,
      repoPath: "/test/repo",
      rubricVersion: "v1",
    },
    score: 72,
    level: "L4",
    levelMeta: {
      level: "L4",
      name: "Productive",
      description: "Good agent support with minor gaps",
    },
    securityGateTriggered: false,
    pillars: [
      {
        pillar: "P1",
        name: "Agent Context Quality",
        score: 85,
        weight: 0.15,
        confidence: "high",
        summary: "Strong context files",
        status: "excellent",
        findings: [
          {
            code: "ARI-CTX-001",
            severity: "info",
            pillar: "P1",
            message: "AGENTS.md found with good structure",
            confidence: "high",
            scoreImpact: { pillarDelta: 0, compositeDelta: 0 },
          },
          {
            code: "ARI-CTX-005",
            severity: "medium",
            pillar: "P1",
            message: "Missing .agentignore file",
            file: "src/secret.ts",
            confidence: "high",
            remediation: {
              action: "create-file",
              description: "Create .agentignore to exclude sensitive files",
              estimatedImpact: "+3 points composite",
              confidence: "high",
            },
            scoreImpact: { pillarDelta: 5, compositeDelta: 3 },
          },
        ],
      },
      {
        pillar: "P2",
        name: "Feedback Loop Speed",
        score: 60,
        weight: 0.15,
        confidence: "medium",
        summary: "Moderate feedback loops",
        findings: [],
      },
    ],
    findings: [
      {
        code: "ARI-CTX-001",
        severity: "info",
        pillar: "P1",
        message: "AGENTS.md found with good structure",
        confidence: "high",
        scoreImpact: { pillarDelta: 0, compositeDelta: 0 },
      },
      {
        code: "ARI-CTX-005",
        severity: "medium",
        pillar: "P1",
        message: "Missing .agentignore file",
        file: "src/secret.ts",
        confidence: "high",
        remediation: {
          action: "create-file",
          description: "Create .agentignore to exclude sensitive files",
          estimatedImpact: "+3 points composite",
          confidence: "high",
        },
        scoreImpact: { pillarDelta: 5, compositeDelta: 3 },
      },
    ],
    contextFiles: [
      {
        path: "AGENTS.md",
        type: "agents-md",
        size: 4096,
        lineCount: 120,
        lastModified: "2026-03-25T12:00:00.000Z",
        parseStatus: "valid",
      },
      {
        path: "CLAUDE.md",
        type: "claude-md",
        size: 2048,
        lineCount: 60,
        parseStatus: "valid",
      },
    ],
    scoreBreakdown: {
      activePillars: 8,
      insufficientPillars: 0,
      effectiveWeightSum: 1.0,
    },
  };
}

function mockBudgetResult(): TokenBudgetResult {
  return {
    totalFiles: 150,
    totalBytes: 500000,
    totalTokens: 125000,
    byCategory: [
      {
        category: "source",
        fileCount: 80,
        totalBytes: 300000,
        totalTokens: 85000,
        percentage: 68,
      },
      {
        category: "config",
        fileCount: 20,
        totalBytes: 50000,
        totalTokens: 13000,
        percentage: 10.4,
      },
    ],
    hotspots: [
      {
        path: "src/big-file.ts",
        category: "source",
        bytes: 50000,
        estimatedTokens: 14000,
      },
    ],
    recommendations: [
      {
        description: "Split large source file",
        targetFiles: ["src/big-file.ts"],
        estimatedSavingsTokens: 5000,
        priority: "high",
      },
    ],
  };
}

describe("extractScore", () => {
  it("returns composite score, level, and metadata", () => {
    const result = extractScore(mockScanResult());
    expect(result.score).toBe(72);
    expect(result.level).toBe("L4");
    expect(result.levelMeta.name).toBe("Productive");
    expect(result.securityGateTriggered).toBe(false);
    expect(result.metadata.version).toBe("0.2.0");
    expect(result.metadata.repoPath).toBe("/test/repo");
    expect(result.scoreBreakdown?.activePillars).toBe(8);
  });

  it("omits scoreBreakdown when absent", () => {
    const scan = mockScanResult();
    delete (scan as Record<string, unknown>).scoreBreakdown;
    const result = extractScore(scan);
    expect(result.scoreBreakdown).toBeUndefined();
  });
});

describe("extractPillars", () => {
  it("returns per-pillar data with findings stripped of file content", () => {
    const result = extractPillars(mockScanResult());
    expect(result.pillars).toHaveLength(2);

    const p1 = result.pillars[0] as (typeof result.pillars)[0];
    expect(p1.pillar).toBe("P1");
    expect(p1.score).toBe(85);
    expect(p1.status).toBe("excellent");
    expect(p1.findingCount).toBe(2);

    // Findings have code and message but no file content
    const finding = p1.findings[1] as (typeof p1.findings)[0];
    expect(finding.code).toBe("ARI-CTX-005");
    expect(finding.message).toContain(".agentignore");
    expect(finding.scoreImpact?.compositeDelta).toBe(3);
    // Must not expose file content — only code, severity, message
    expect((finding as Record<string, unknown>)["file"]).toBeUndefined();
    expect((finding as Record<string, unknown>)["remediation"]).toBeUndefined();
  });

  it("handles pillars with no findings", () => {
    const result = extractPillars(mockScanResult());
    const p2 = result.pillars[1] as (typeof result.pillars)[0];
    expect(p2.findingCount).toBe(0);
    expect(p2.findings).toHaveLength(0);
  });
});

describe("extractRecommendations", () => {
  it("returns actionable findings sorted by composite delta", () => {
    const result = extractRecommendations(mockScanResult());
    // Only findings with remediation and not suppressed
    expect(result.recommendations.length).toBeGreaterThanOrEqual(1);

    const rec = result.recommendations[0] as (typeof result.recommendations)[0];
    expect(rec.code).toBe("ARI-CTX-005");
    expect(rec.remediation?.action).toBe("create-file");
    expect(rec.remediation?.description).toContain(".agentignore");
    expect(rec.scoreImpact?.compositeDelta).toBe(3);
    // No file path in recommendations
    expect((rec as Record<string, unknown>)["file"]).toBeUndefined();
  });

  it("excludes suppressed findings", () => {
    const scan = mockScanResult();
    scan.findings = scan.findings.map((f) => ({ ...f, suppressed: true }));
    const result = extractRecommendations(scan);
    expect(result.recommendations).toHaveLength(0);
  });
});

describe("extractContextFiles", () => {
  it("returns context file metadata without content", () => {
    const result = extractContextFiles(mockScanResult());
    expect(result.contextFiles).toHaveLength(2);

    const agents = result.contextFiles[0] as (typeof result.contextFiles)[0];
    expect(agents.path).toBe("AGENTS.md");
    expect(agents.type).toBe("agents-md");
    expect(agents.size).toBe(4096);
    expect(agents.lineCount).toBe(120);
    // No content field
    expect((agents as Record<string, unknown>)["content"]).toBeUndefined();
  });

  it("handles missing contextFiles gracefully", () => {
    const scan = mockScanResult();
    delete (scan as Record<string, unknown>).contextFiles;
    const result = extractContextFiles(scan);
    expect(result.contextFiles).toHaveLength(0);
  });
});

describe("extractBudget", () => {
  it("returns token budget categories and hotspots", () => {
    const result = extractBudget(mockBudgetResult());
    expect(result.totalTokens).toBe(125000);
    expect(result.totalFiles).toBe(150);
    expect(result.categories).toHaveLength(2);
    expect(result.hotspots).toHaveLength(1);
    expect((result.hotspots[0] as (typeof result.hotspots)[0]).path).toBe("src/big-file.ts");
    expect(result.recommendations).toHaveLength(1);
    expect((result.recommendations[0] as (typeof result.recommendations)[0]).priority).toBe("high");
  });
});

describe("safety constraints", () => {
  it("no file content is exposed in any resource", () => {
    const scan = mockScanResult();

    // Score resource
    const score = extractScore(scan);
    const scoreJson = JSON.stringify(score);
    expect(scoreJson).not.toContain("secret.ts");

    // Pillars resource — findings should not contain file paths
    const pillars = extractPillars(scan);
    const pillarsJson = JSON.stringify(pillars);
    expect(pillarsJson).not.toContain("src/secret.ts");

    // Recommendations — should not expose file paths
    const recs = extractRecommendations(scan);
    for (const rec of recs.recommendations) {
      expect((rec as Record<string, unknown>)["file"]).toBeUndefined();
    }

    // Context files — paths are metadata, but no content
    const ctx = extractContextFiles(scan);
    for (const cf of ctx.contextFiles) {
      expect((cf as Record<string, unknown>)["content"]).toBeUndefined();
    }
  });
});
