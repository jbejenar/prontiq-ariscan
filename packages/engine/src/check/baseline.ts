/**
 * Baseline caching and delta computation for check mode (P3.04).
 *
 * Stores a scan result as a baseline and compares subsequent scans
 * to show only regressions (new findings, score drops).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ScanResult, Finding, PillarId } from "@prontiq/ariscan-schema";

const CACHE_DIR = ".ariscan-cache";
const BASELINE_FILE = "baseline.json";

/** Per-pillar delta: score change and new/resolved findings. */
export interface PillarDelta {
  pillar: PillarId;
  scoreBefore: number;
  scoreAfter: number;
  delta: number;
  newFindings: Finding[];
  resolvedFindings: Finding[];
}

/** Overall delta between current scan and baseline. */
export interface DeltaResult {
  compositeBefore: number;
  compositeAfter: number;
  compositeDelta: number;
  pillars: PillarDelta[];
  /** True if any pillar score decreased or new findings appeared. */
  hasRegressions: boolean;
}

/** Load a previously saved baseline from .ariscan-cache/baseline.json. */
export async function loadBaseline(repoPath: string): Promise<ScanResult | null> {
  const filePath = join(repoPath, CACHE_DIR, BASELINE_FILE);
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as ScanResult;
  } catch {
    return null;
  }
}

/** Save the current scan result as the baseline. */
export async function saveBaseline(repoPath: string, result: ScanResult): Promise<void> {
  const dirPath = join(repoPath, CACHE_DIR);
  await mkdir(dirPath, { recursive: true });
  const filePath = join(dirPath, BASELINE_FILE);
  await writeFile(filePath, JSON.stringify(result, null, 2), "utf-8");
}

/** Compute the delta between current scan and a baseline. */
export function computeDelta(current: ScanResult, baseline: ScanResult): DeltaResult {
  const pillarDeltas: PillarDelta[] = [];
  let hasRegressions = false;

  for (const currentPillar of current.pillars) {
    const baselinePillar = baseline.pillars.find((p) => p.pillar === currentPillar.pillar);
    const scoreBefore = baselinePillar?.score ?? 0;
    const scoreAfter = currentPillar.score;
    const delta = scoreAfter - scoreBefore;

    const baselineCodes = new Set(
      (baselinePillar?.findings ?? []).map((f) => `${f.code}:${f.file ?? ""}`),
    );
    const currentCodes = new Set(currentPillar.findings.map((f) => `${f.code}:${f.file ?? ""}`));

    const newFindings = currentPillar.findings.filter(
      (f) => !baselineCodes.has(`${f.code}:${f.file ?? ""}`),
    );
    const resolvedFindings = (baselinePillar?.findings ?? []).filter(
      (f) => !currentCodes.has(`${f.code}:${f.file ?? ""}`),
    );

    if (delta < 0 || newFindings.length > 0) {
      hasRegressions = true;
    }

    pillarDeltas.push({
      pillar: currentPillar.pillar,
      scoreBefore,
      scoreAfter,
      delta,
      newFindings,
      resolvedFindings,
    });
  }

  return {
    compositeBefore: baseline.score,
    compositeAfter: current.score,
    compositeDelta: current.score - baseline.score,
    pillars: pillarDeltas,
    hasRegressions,
  };
}

/** Return the path to the baseline cache directory (for .gitignore documentation). */
export function getBaselineCacheDir(): string {
  return CACHE_DIR;
}
