/** Tests for enforcement logic — warn/fail/block modes with composite + per-pillar thresholds. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { applyEnforcement } from "../enforcement.js";
import type { ScanResult } from "@prontiq/ariscan-schema";
import type { ResolvedPolicyMeta } from "../config-loader.js";

/** Build a minimal ScanResult for testing enforcement. */
function makeScanResult(
  score: number,
  pillars: Array<{ pillar: string; score: number }>,
): ScanResult {
  return {
    score,
    level: "L4",
    levelMeta: { level: "L4", name: "Productive", description: "test" },
    securityGateTriggered: false,
    findings: [],
    pillars: pillars.map((p) => ({
      pillar: p.pillar,
      name: `Pillar ${p.pillar}`,
      score: p.score,
      weight: 0.125,
      confidence: "high",
      findings: [],
      summary: "test",
    })),
    metadata: {
      version: "0.1.0",
      repoPath: "/test",
      timestamp: new Date().toISOString(),
      rubricVersion: "v1",
      duration: 100,
    },
  } as ScanResult;
}

describe("applyEnforcement", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when score exceeds threshold", () => {
    const result = makeScanResult(80, [{ pillar: "P1", score: 70 }]);
    applyEnforcement(result, 70, {});
    expect(exitSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("exits 1 when composite score is below threshold in fail mode", () => {
    const result = makeScanResult(60, []);
    applyEnforcement(result, 70, { enforcement: "fail" });
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Error"));
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("below threshold 70"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 when composite score is below threshold in block mode", () => {
    const result = makeScanResult(60, []);
    applyEnforcement(result, 70, { enforcement: "block" });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("prints warning but does not exit in warn mode", () => {
    const result = makeScanResult(60, []);
    applyEnforcement(result, 70, { enforcement: "warn" });
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Warning"));
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("defaults to fail enforcement when not specified", () => {
    const result = makeScanResult(60, []);
    applyEnforcement(result, 70, {});
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("checks per-pillar thresholds", () => {
    const result = makeScanResult(80, [
      { pillar: "P1", score: 50 },
      { pillar: "P8", score: 30 },
    ]);
    const meta: ResolvedPolicyMeta = {
      enforcement: "fail",
      pillarThresholds: { P1: 60, P8: 40 },
    };
    applyEnforcement(result, 0, meta);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("P1"));
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("P8"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("passes when all pillar scores meet thresholds", () => {
    const result = makeScanResult(80, [
      { pillar: "P1", score: 70 },
      { pillar: "P8", score: 50 },
    ]);
    const meta: ResolvedPolicyMeta = {
      enforcement: "fail",
      pillarThresholds: { P1: 60, P8: 40 },
    };
    applyEnforcement(result, 0, meta);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("ignores pillar thresholds for pillars not in result", () => {
    const result = makeScanResult(80, [{ pillar: "P1", score: 70 }]);
    const meta: ResolvedPolicyMeta = {
      enforcement: "fail",
      pillarThresholds: { P1: 60, P5: 80 },
    };
    applyEnforcement(result, 0, meta);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("reports both composite and pillar violations together", () => {
    const result = makeScanResult(60, [{ pillar: "P1", score: 40 }]);
    const meta: ResolvedPolicyMeta = {
      enforcement: "fail",
      pillarThresholds: { P1: 60 },
    };
    applyEnforcement(result, 70, meta);
    // Should report both violations
    expect(stderrSpy).toHaveBeenCalledTimes(2);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("skips composite check when threshold is 0", () => {
    const result = makeScanResult(10, []);
    applyEnforcement(result, 0, { enforcement: "fail" });
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
