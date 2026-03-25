import { describe, it, expect } from "vitest";
import type { ScanResult, SimulationStepResult, PillarResult } from "@prontiq/ariscan-schema";
import { compareStaticVsSimulation, predictionAccuracy } from "../../simulate/comparison.js";

/** Build a minimal ScanResult with specified pillar scores. */
function buildScanResult(pillarScores: Record<string, number>): ScanResult {
  const pillars: PillarResult[] = Object.entries(pillarScores).map(([pillar, score]) => ({
    pillar: pillar as PillarResult["pillar"],
    name: pillar,
    weight: 0.125,
    score,
    confidence: "high" as const,
    findings: [],
    summary: `${pillar} summary`,
  }));

  return {
    score: 50,
    level: "L3",
    levelMeta: { level: "L3", name: "L3 Capable", description: "Capable" },
    securityGateTriggered: false,
    pillars,
    metadata: {
      version: "0.2.0",
      timestamp: "2026-03-26T00:00:00Z",
      repoPath: "/mock/repo",
      duration: 100,
      rubricVersion: "v1",
    },
    contextFiles: [],
    detection: {
      languages: [],
      frameworks: [],
      monorepo: null,
    },
    findings: [],
  };
}

function buildStepResult(
  step: SimulationStepResult["step"],
  status: SimulationStepResult["status"],
  durationMs = 1000,
): SimulationStepResult {
  return {
    step,
    status,
    durationMs,
    command: "test-cmd",
    exitCode: status === "pass" ? 0 : status === "fail" ? 1 : null,
    stdout: "",
    stderr: "",
  };
}

describe("compareStaticVsSimulation", () => {
  it("generates comparison entries for bootstrap, typecheck, test, and feedback loop", () => {
    const scan = buildScanResult({ P2: 70, P3: 70, P4: 70, P6: 70 });
    const steps = [
      buildStepResult("bootstrap", "pass"),
      buildStepResult("typecheck", "pass"),
      buildStepResult("test", "pass"),
    ];

    const comparisons = compareStaticVsSimulation(scan, steps);
    expect(comparisons).toHaveLength(4);

    const pillars = comparisons.map((c) => c.pillar);
    expect(pillars).toContain("P4");
    expect(pillars).toContain("P6");
    expect(pillars).toContain("P3");
    expect(pillars).toContain("P2");
  });

  it("marks prediction as accurate when high score and step passes", () => {
    const scan = buildScanResult({ P4: 80 });
    const steps = [buildStepResult("bootstrap", "pass")];

    const comparisons = compareStaticVsSimulation(scan, steps);
    const p4 = comparisons.find((c) => c.pillar === "P4");
    expect(p4?.accurate).toBe(true);
    expect(p4?.prediction).toContain("likely to succeed");
    expect(p4?.reality).toContain("succeeded");
  });

  it("marks prediction as inaccurate when high score but step fails", () => {
    const scan = buildScanResult({ P4: 80 });
    const steps = [buildStepResult("bootstrap", "fail")];

    const comparisons = compareStaticVsSimulation(scan, steps);
    const p4 = comparisons.find((c) => c.pillar === "P4");
    expect(p4?.accurate).toBe(false);
  });

  it("marks prediction as accurate when low score and step fails", () => {
    const scan = buildScanResult({ P6: 30 });
    const steps = [buildStepResult("typecheck", "fail")];

    const comparisons = compareStaticVsSimulation(scan, steps);
    const p6 = comparisons.find((c) => c.pillar === "P6");
    expect(p6?.accurate).toBe(true);
    expect(p6?.prediction).toContain("may have issues");
  });

  it("handles skipped steps", () => {
    const scan = buildScanResult({ P3: 70 });
    const steps = [buildStepResult("test", "skip")];

    const comparisons = compareStaticVsSimulation(scan, steps);
    const p3 = comparisons.find((c) => c.pillar === "P3");
    expect(p3).toBeDefined();
    expect(p3?.reality).toContain("skipped");
  });
});

describe("predictionAccuracy", () => {
  it("returns 100 when all predictions are accurate", () => {
    const comparisons = [
      { prediction: "a", reality: "b", accurate: true, pillar: "P1" },
      { prediction: "c", reality: "d", accurate: true, pillar: "P2" },
    ];
    expect(predictionAccuracy(comparisons)).toBe(100);
  });

  it("returns 0 when no predictions are accurate", () => {
    const comparisons = [{ prediction: "a", reality: "b", accurate: false, pillar: "P1" }];
    expect(predictionAccuracy(comparisons)).toBe(0);
  });

  it("returns 50 for mixed accuracy", () => {
    const comparisons = [
      { prediction: "a", reality: "b", accurate: true, pillar: "P1" },
      { prediction: "c", reality: "d", accurate: false, pillar: "P2" },
    ];
    expect(predictionAccuracy(comparisons)).toBe(50);
  });

  it("returns 0 for empty comparisons", () => {
    expect(predictionAccuracy([])).toBe(0);
  });
});
