import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPillarsByProfile } from "../check/profiles.js";
import {
  loadBaseline,
  saveBaseline,
  computeDelta,
  getBaselineCacheDir,
} from "../check/baseline.js";
import type {
  ScanResult,
  Finding,
  PillarId,
  Confidence,
  PillarResult,
} from "@prontiq/ariscan-schema";

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

describe("getPillarsByProfile", () => {
  it("fast profile includes P1, P4, P8 only", () => {
    const pillars = getPillarsByProfile("fast");
    expect(pillars).toEqual(["P1", "P4", "P8"]);
  });

  it("standard profile includes 6 pillars", () => {
    const pillars = getPillarsByProfile("standard");
    expect(pillars).toEqual(["P1", "P3", "P4", "P6", "P7", "P8"]);
  });

  it("thorough profile includes all 8 pillars", () => {
    const pillars = getPillarsByProfile("thorough");
    expect(pillars).toHaveLength(8);
    expect(pillars).toContain("P1");
    expect(pillars).toContain("P2");
    expect(pillars).toContain("P5");
  });
});

// ---------------------------------------------------------------------------
// Baseline helpers
// ---------------------------------------------------------------------------

function makePillarResult(overrides: Partial<PillarResult> = {}): PillarResult {
  return {
    pillar: "P1" as PillarId,
    name: "Agent Context Quality",
    score: 70,
    weight: 0.15,
    confidence: "high" as Confidence,
    findings: [],
    summary: "Good",
    ...overrides,
  };
}

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    metadata: {
      version: "0.1.0",
      rubricVersion: "v1",
      timestamp: new Date().toISOString(),
      duration: 100,
      repoPath: "/tmp/test",
    },
    score: 60,
    level: "L3" as const,
    levelMeta: {
      level: "L3" as const,
      name: "Capable",
      description: "Repo supports AI agents with moderate friction",
    },
    securityGateTriggered: false,
    pillars: [
      makePillarResult({ pillar: "P1" as PillarId, score: 70 }),
      makePillarResult({
        pillar: "P2" as PillarId,
        name: "Feedback Loop Speed",
        score: 50,
        summary: "OK",
      }),
    ],
    findings: [],
    ...overrides,
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    code: "ARI-CTX-001",
    severity: "medium" as const,
    pillar: "P1" as PillarId,
    message: "Test finding",
    remediation: {
      action: "create-file" as const,
      description: "Do the thing",
      confidence: "high" as const,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Baseline I/O
// ---------------------------------------------------------------------------

describe("baseline save/load", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "ariscan-baseline-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when no baseline exists", async () => {
    const result = await loadBaseline(tmpDir);
    expect(result).toBeNull();
  });

  it("round-trips a scan result", async () => {
    const original = makeScanResult();
    await saveBaseline(tmpDir, original);
    const loaded = await loadBaseline(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.score).toBe(original.score);
    expect(loaded?.pillars).toHaveLength(original.pillars.length);
  });

  it("returns null for corrupted baseline", async () => {
    const cacheDir = join(tmpDir, ".ariscan-cache");
    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, "baseline.json"), "not valid json{{{", "utf-8");
    const result = await loadBaseline(tmpDir);
    expect(result).toBeNull();
  });

  it("returns null for invalid schema in baseline", async () => {
    const cacheDir = join(tmpDir, ".ariscan-cache");
    await mkdir(cacheDir, { recursive: true });
    await writeFile(join(cacheDir, "baseline.json"), JSON.stringify({ invalid: true }), "utf-8");
    const result = await loadBaseline(tmpDir);
    expect(result).toBeNull();
  });

  it("getBaselineCacheDir returns .ariscan-cache", () => {
    expect(getBaselineCacheDir()).toBe(".ariscan-cache");
  });
});

// ---------------------------------------------------------------------------
// Delta computation
// ---------------------------------------------------------------------------

describe("computeDelta", () => {
  it("detects no regressions when scores improve", () => {
    const baseline = makeScanResult({ score: 50 });
    const current = makeScanResult({ score: 60 });
    const delta = computeDelta(current, baseline);
    expect(delta.hasRegressions).toBe(false);
    expect(delta.compositeDelta).toBe(10);
  });

  it("detects regression when composite score drops", () => {
    const baseline = makeScanResult({
      score: 70,
      pillars: [makePillarResult({ score: 80, summary: "Great" })],
    });
    const current = makeScanResult({
      score: 50,
      pillars: [makePillarResult({ score: 60, summary: "OK" })],
    });
    const delta = computeDelta(current, baseline);
    expect(delta.hasRegressions).toBe(true);
    expect(delta.compositeDelta).toBe(-20);
    const p1Delta = delta.pillars[0];
    expect(p1Delta).toBeDefined();
    if (p1Delta) {
      expect(p1Delta.delta).toBe(-20);
    }
  });

  it("detects new findings as regressions", () => {
    const finding = makeFinding({ code: "ARI-CTX-002", file: "README.md" });
    const baseline = makeScanResult({
      pillars: [makePillarResult({ score: 70 })],
    });
    const current = makeScanResult({
      pillars: [makePillarResult({ score: 70, findings: [finding] })],
    });
    const delta = computeDelta(current, baseline);
    expect(delta.hasRegressions).toBe(true);
    const p1Delta = delta.pillars[0];
    expect(p1Delta).toBeDefined();
    if (p1Delta) {
      expect(p1Delta.newFindings).toHaveLength(1);
      expect(p1Delta.newFindings[0]?.code).toBe("ARI-CTX-002");
    }
  });

  it("tracks resolved findings", () => {
    const finding = makeFinding({ code: "ARI-CTX-001", file: "old.ts" });
    const baseline = makeScanResult({
      pillars: [makePillarResult({ score: 60, findings: [finding], summary: "OK" })],
    });
    const current = makeScanResult({
      pillars: [makePillarResult({ score: 70, summary: "Better" })],
    });
    const delta = computeDelta(current, baseline);
    const p1Delta = delta.pillars[0];
    expect(p1Delta).toBeDefined();
    if (p1Delta) {
      expect(p1Delta.resolvedFindings).toHaveLength(1);
      expect(p1Delta.resolvedFindings[0]?.code).toBe("ARI-CTX-001");
    }
  });

  it("handles pillars missing from current scan", () => {
    const baseline = makeScanResult({
      pillars: [
        makePillarResult({ pillar: "P1" as PillarId, score: 70 }),
        makePillarResult({
          pillar: "P2" as PillarId,
          name: "Feedback Loop Speed",
          score: 60,
          summary: "OK",
        }),
      ],
    });
    const current = makeScanResult({
      pillars: [makePillarResult({ pillar: "P1" as PillarId, score: 70 })],
    });
    const delta = computeDelta(current, baseline);
    expect(delta.hasRegressions).toBe(true);
    const p2Delta = delta.pillars.find((p) => p.pillar === "P2");
    expect(p2Delta).toBeDefined();
    if (p2Delta) {
      expect(p2Delta.scoreAfter).toBe(0);
      expect(p2Delta.delta).toBe(-60);
    }
  });

  it("handles pillars in current but not in baseline", () => {
    const baseline = makeScanResult({
      pillars: [makePillarResult({ pillar: "P1" as PillarId, score: 70 })],
    });
    const current = makeScanResult({
      pillars: [
        makePillarResult({ pillar: "P1" as PillarId, score: 70 }),
        makePillarResult({
          pillar: "P2" as PillarId,
          name: "Feedback Loop Speed",
          score: 60,
          summary: "New",
        }),
      ],
    });
    const delta = computeDelta(current, baseline);
    const p2Delta = delta.pillars.find((p) => p.pillar === "P2");
    expect(p2Delta).toBeDefined();
    if (p2Delta) {
      expect(p2Delta.scoreBefore).toBe(0);
      expect(p2Delta.scoreAfter).toBe(60);
    }
  });
});
