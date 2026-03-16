import { describe, it, expect } from "vitest";
import { buildTelemetryPayload } from "../../telemetry/payload.js";
import { scoreToBucket } from "@prontiq/ariscan-schema";
import type { ScanResult } from "@prontiq/ariscan-schema";

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    metadata: {
      version: "0.2.0",
      timestamp: "2026-01-01T00:00:00Z",
      duration: 500,
      repoPath: "/some/repo",
      rubricVersion: "v1",
    },
    score: 72,
    level: "L4",
    levelMeta: {
      level: "L4",
      name: "Productive",
      description: "Ready for productive AI-assisted development",
    },
    securityGateTriggered: false,
    pillars: [
      {
        pillar: "P1",
        name: "Agent Context Quality",
        score: 80,
        weight: 0.15,
        confidence: "high",
        findings: [],
        summary: "Good",
      },
    ],
    findings: [
      {
        code: "ARI-CTX-001",
        severity: "medium",
        pillar: "P1",
        message: "Missing AGENTS.md",
      },
      {
        code: "ARI-CTX-002",
        severity: "low",
        pillar: "P1",
        message: "Short context",
      },
    ],
    detection: {
      languages: [{ language: "typescript", confidence: 0.9, primary: true }],
      frameworks: [],
      monorepo: null,
    },
    ...overrides,
  };
}

describe("buildTelemetryPayload", () => {
  it("builds payload with correct fields", () => {
    const result = makeScanResult();
    const payload = buildTelemetryPayload(result, 1234);

    expect(payload.scan_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(payload.version).toBe("0.2.0");
    expect(payload.platform).toBeTruthy();
    expect(payload.language).toBe("typescript");
    expect(payload.score_bucket).toBe("66-80");
    expect(payload.duration_ms).toBe(1234);
    expect(payload.pillar_count).toBe(1);
    expect(payload.finding_count).toBe(2);
  });

  it("includes per-pillar score buckets", () => {
    const result = makeScanResult();
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.pillar_scores).toBeDefined();
    expect(payload.pillar_scores).toHaveLength(1);
    expect(payload.pillar_scores?.[0]).toEqual({
      pillar_id: "P1",
      score_bucket: "66-80",
    });
  });

  it("includes detection counts", () => {
    const result = makeScanResult();
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.language_count).toBe(1);
    expect(payload.framework_count).toBe(0);
  });

  it("includes format and badge options when provided", () => {
    const result = makeScanResult();
    const payload = buildTelemetryPayload(result, 100, {
      format: "json",
      badgeGenerated: true,
    });
    expect(payload.format).toBe("json");
    expect(payload.badge_generated).toBe(true);
  });

  it("omits optional fields when not provided", () => {
    const result = makeScanResult();
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.format).toBeUndefined();
    expect(payload.badge_generated).toBeUndefined();
  });

  it("generates unique scan_id per call", () => {
    const result = makeScanResult();
    const p1 = buildTelemetryPayload(result, 100);
    const p2 = buildTelemetryPayload(result, 100);
    expect(p1.scan_id).not.toBe(p2.scan_id);
  });

  it("uses 'unknown' when no detection languages", () => {
    const result = makeScanResult({ detection: undefined });
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.language).toBe("unknown");
  });

  it("rounds duration_ms", () => {
    const result = makeScanResult();
    const payload = buildTelemetryPayload(result, 1234.567);
    expect(payload.duration_ms).toBe(1235);
  });

  it("does not include repo path or file paths", () => {
    const result = makeScanResult();
    const payload = buildTelemetryPayload(result, 100);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("/some/repo");
    expect(serialized).not.toContain("repoPath");
  });

  it("includes context file count when contextFiles present", () => {
    const result = makeScanResult({
      contextFiles: [
        { path: "AGENTS.md", type: "agents-md" },
        { path: ".cursorrules", type: "cursorrules" },
      ],
    });
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.context_file_count).toBe(2);
    expect(payload.agent_context_types).toBe(2);
  });

  it("includes security gate triggered flag", () => {
    const result = makeScanResult({ securityGateTriggered: true });
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.security_gate_triggered).toBe(true);
  });

  it("includes maturity level", () => {
    const result = makeScanResult();
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.maturity_level).toBe("L4");
  });

  it("includes monorepo detection", () => {
    const result = makeScanResult({
      detection: {
        languages: [{ language: "typescript", confidence: 0.9, primary: true }],
        frameworks: [],
        monorepo: { tool: "pnpm", workspaceRoot: ".", packages: ["a", "b"] },
      },
    });
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.monorepo_detected).toBe(true);
  });

  it("sets monorepo_detected to false when no monorepo", () => {
    const result = makeScanResult();
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.monorepo_detected).toBe(false);
  });

  it("includes detection confidence", () => {
    const result = makeScanResult();
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.detection_confidence).toBe(0.9);
  });

  it("includes finding counts by severity", () => {
    const result = makeScanResult();
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.finding_counts_by_severity).toEqual({
      critical: 0,
      high: 0,
      medium: 1,
      low: 1,
      info: 0,
    });
  });

  it("reports devcontainer_detected true when ScanResult has devcontainerDetected", () => {
    const result = makeScanResult({ devcontainerDetected: true });
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.devcontainer_detected).toBe(true);
  });

  it("reports devcontainer_detected false when ScanResult has devcontainerDetected false", () => {
    const result = makeScanResult({ devcontainerDetected: false });
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.devcontainer_detected).toBe(false);
  });

  it("reports devcontainer_detected undefined when field is absent", () => {
    const result = makeScanResult();
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.devcontainer_detected).toBeUndefined();
  });

  it("reports high_risk_test_count as 0 when no ARI-TST-015 findings", () => {
    const result = makeScanResult();
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.high_risk_test_count).toBe(0);
  });

  it("reports high_risk_test_count > 0 when ARI-TST-015 findings exist", () => {
    const result = makeScanResult({
      findings: [
        { code: "ARI-TST-015", severity: "medium", pillar: "P5", message: "High-risk test file" },
        {
          code: "ARI-TST-015",
          severity: "medium",
          pillar: "P5",
          message: "Another high-risk test",
        },
        { code: "ARI-CTX-001", severity: "low", pillar: "P1", message: "Other finding" },
      ],
    });
    const payload = buildTelemetryPayload(result, 100);
    expect(payload.high_risk_test_count).toBe(2);
  });
});

describe("scoreToBucket", () => {
  it("maps score 0 to 0-25", () => expect(scoreToBucket(0)).toBe("0-25"));
  it("maps score 25 to 0-25", () => expect(scoreToBucket(25)).toBe("0-25"));
  it("maps score 26 to 26-45", () => expect(scoreToBucket(26)).toBe("26-45"));
  it("maps score 45 to 26-45", () => expect(scoreToBucket(45)).toBe("26-45"));
  it("maps score 46 to 46-65", () => expect(scoreToBucket(46)).toBe("46-65"));
  it("maps score 65 to 46-65", () => expect(scoreToBucket(65)).toBe("46-65"));
  it("maps score 66 to 66-80", () => expect(scoreToBucket(66)).toBe("66-80"));
  it("maps score 80 to 66-80", () => expect(scoreToBucket(80)).toBe("66-80"));
  it("maps score 81 to 81-100", () => expect(scoreToBucket(81)).toBe("81-100"));
  it("maps score 100 to 81-100", () => expect(scoreToBucket(100)).toBe("81-100"));
});
