import { type PillarId, PILLAR_NAMES, PILLAR_WEIGHTS, type Finding } from "@prontiq/ariscan-schema";
import type { Confidence, PillarResult } from "@prontiq/ariscan-schema";
import type { RepoContext } from "./analyzer.interface.js";

/**
 * Clamp a score to the valid [0, 100] range.
 */
export function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

/**
 * Build a PillarResult with score clamping and standard field population.
 */
export function buildPillarResult(
  pillar: PillarId,
  score: number,
  confidence: Confidence,
  findings: Finding[],
  summary: string,
): PillarResult {
  return {
    pillar,
    name: PILLAR_NAMES[pillar],
    score: clampScore(score),
    weight: PILLAR_WEIGHTS[pillar],
    confidence,
    findings,
    summary,
  };
}

/**
 * Check if any of the given file paths exist in the repo context.
 */
export async function anyFileExists(
  context: RepoContext,
  paths: readonly string[],
): Promise<boolean> {
  for (const p of paths) {
    if (await context.fileExists(p)) return true;
  }
  return false;
}

/**
 * Find which of the given file paths exist, returning the first match or null.
 */
export async function findFirstExisting(
  context: RepoContext,
  paths: readonly string[],
): Promise<string | null> {
  for (const p of paths) {
    if (await context.fileExists(p)) return p;
  }
  return null;
}
