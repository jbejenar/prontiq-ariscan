import { describe, it, expect } from "vitest";
import { computeDelta } from "../../check/baseline.js";
import type { ScanResult, PillarResult, Finding } from "@prontiq/ariscan-schema";

function makeFinding(code: string, file?: string): Finding {
  return {
    code,
    severity: "medium",
    pillar: "P1",
    message: `Finding ${code}`,
    confidence: "high",
    ...(file ? { file } : {}),
  };
}

function makePillarResult(pillar: string, score: number, findings: Finding[] = []): PillarResult {
  return {
    pillar: pillar as PillarResult["pillar"],
    name: `Pillar ${pillar}`,
    weight: 0.15,
    score,
    status: score >= 80 ? "excellent" : score >= 60 ? "good" : "needs-improvement",
    summary: `Score: ${score}`,
    confidence: "high",
    findings,
  };
}

function makeScanResult(score: number, pillars: PillarResult[]): ScanResult {
  const allFindings = pillars.flatMap((p) => p.findings);
  return {
    score,
    level: score >= 81 ? "L5" : score >= 66 ? "L4" : "L3",
    pillars,
    findings: allFindings,
    securityGateTriggered: false,
    metadata: {
      version: "0.2.0",
      repoPath: "/mock",
      duration: 100,
      timestamp: new Date().toISOString(),
      rubricVersion: "v1",
    },
    levelMeta: {
      level: "L4",
      name: "Productive",
      description: "Production-ready for AI coding agents",
    },
  };
}

/** Get a pillar delta by index, throwing if missing (for test clarity). */
function pillarAt(delta: ReturnType<typeof computeDelta>, index: number) {
  const p = delta.pillars[index];
  if (!p) throw new Error(`No pillar at index ${index}`);
  return p;
}

describe("computeDelta", () => {
  it("detects no regressions when score improves", () => {
    const baseline = makeScanResult(70, [makePillarResult("P1", 70, [makeFinding("ARI-CTX-001")])]);
    const current = makeScanResult(75, [makePillarResult("P1", 75)]);

    const delta = computeDelta(current, baseline);
    const p1 = pillarAt(delta, 0);

    expect(delta.hasRegressions).toBe(false);
    expect(delta.compositeDelta).toBe(5);
    expect(p1.delta).toBe(5);
    expect(p1.resolvedFindings).toHaveLength(1);
    expect(p1.newFindings).toHaveLength(0);
  });

  it("detects regressions when score drops", () => {
    const baseline = makeScanResult(75, [makePillarResult("P1", 75)]);
    const current = makeScanResult(70, [makePillarResult("P1", 70, [makeFinding("ARI-CTX-001")])]);

    const delta = computeDelta(current, baseline);
    const p1 = pillarAt(delta, 0);

    expect(delta.hasRegressions).toBe(true);
    expect(delta.compositeDelta).toBe(-5);
    expect(p1.newFindings).toHaveLength(1);
  });

  it("detects new findings as regressions even if score stays same", () => {
    const baseline = makeScanResult(70, [makePillarResult("P1", 70)]);
    const current = makeScanResult(70, [
      makePillarResult("P1", 70, [makeFinding("ARI-CTX-002", "src/foo.ts")]),
    ]);

    const delta = computeDelta(current, baseline);
    const p1 = pillarAt(delta, 0);

    expect(delta.hasRegressions).toBe(true);
    expect(p1.newFindings).toHaveLength(1);
    const firstFinding = p1.newFindings[0];
    expect(firstFinding).toBeDefined();
    if (firstFinding) expect(firstFinding.code).toBe("ARI-CTX-002");
  });

  it("handles missing pillar in baseline", () => {
    const baseline = makeScanResult(70, []);
    const current = makeScanResult(70, [makePillarResult("P1", 70)]);

    const delta = computeDelta(current, baseline);
    const p1 = pillarAt(delta, 0);

    expect(p1.scoreBefore).toBe(0);
    expect(p1.scoreAfter).toBe(70);
    expect(p1.delta).toBe(70);
  });

  it("detects regressions when baseline pillar is absent from current scan", () => {
    const baseline = makeScanResult(70, [
      makePillarResult("P1", 80, [makeFinding("ARI-CTX-001")]),
      makePillarResult("P2", 60, [makeFinding("ARI-SEC-001")]),
    ]);
    const current = makeScanResult(65, [makePillarResult("P1", 80)]);

    const delta = computeDelta(current, baseline);

    expect(delta.hasRegressions).toBe(true);
    expect(delta.pillars).toHaveLength(2);
    const p2 = delta.pillars.find((p) => p.pillar === "P2");
    expect(p2).toBeDefined();
    if (p2) {
      expect(p2.scoreBefore).toBe(60);
      expect(p2.scoreAfter).toBe(0);
      expect(p2.delta).toBe(-60);
      expect(p2.resolvedFindings).toHaveLength(1);
      expect(p2.newFindings).toHaveLength(0);
    }
  });

  it("distinguishes findings by file path", () => {
    const baseline = makeScanResult(70, [
      makePillarResult("P1", 70, [makeFinding("ARI-CTX-001", "src/a.ts")]),
    ]);
    const current = makeScanResult(70, [
      makePillarResult("P1", 70, [makeFinding("ARI-CTX-001", "src/b.ts")]),
    ]);

    const delta = computeDelta(current, baseline);
    const p1 = pillarAt(delta, 0);

    expect(p1.newFindings).toHaveLength(1);
    expect(p1.resolvedFindings).toHaveLength(1);
  });
});
