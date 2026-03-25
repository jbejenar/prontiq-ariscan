/**
 * Pre-commit check runner (P3.04).
 *
 * Runs a speed-optimized scan using the selected profile, optionally
 * filtering findings to changed files and computing a delta against baseline.
 */
import type { ScanResult, ScanConfig, CheckProfile } from "@prontiq/ariscan-schema";
import type { OnProgress } from "../scan.js";
import { scan } from "../scan.js";
import { getPillarsByProfile } from "./profiles.js";
import { loadBaseline, saveBaseline, computeDelta } from "./baseline.js";
import type { DeltaResult } from "./baseline.js";

/** Options for runCheck. */
export interface CheckOptions {
  /** Speed profile: fast (<5s), standard (<15s), thorough (full). Default: fast. */
  profile?: CheckProfile;
  /** Only report findings on these files. If empty/undefined, report all. */
  changedFiles?: string[];
  /** Compare against stored baseline and return delta. Default: true. */
  useDelta?: boolean;
  /** Save current result as the new baseline after check. Default: false. */
  updateBaseline?: boolean;
  /** Additional scan config overrides. */
  scanConfig?: Partial<ScanConfig>;
  /** Progress callback. */
  onProgress?: OnProgress;
}

/** Result of a check run. */
export interface CheckResult {
  /** The full scan result (may be partial if profile != thorough). */
  scanResult: ScanResult;
  /** Delta against baseline, if baseline exists and useDelta is true. */
  delta: DeltaResult | null;
  /** Which profile was used. */
  profile: CheckProfile;
  /** Files that were considered changed (empty if not filtered). */
  changedFiles: string[];
}

/**
 * Run a speed-optimized check scan.
 *
 * 1. Selects pillars based on the profile.
 * 2. Runs only those pillars.
 * 3. Optionally filters findings to changed files.
 * 4. Optionally computes delta against baseline.
 */
export async function runCheck(repoPath: string, options: CheckOptions = {}): Promise<CheckResult> {
  const profile = options.profile ?? "fast";
  const useDelta = options.useDelta ?? true;
  const changedFiles = options.changedFiles ?? [];

  // Build scan config that only enables the profile's pillars
  const profilePillars = getPillarsByProfile(profile);
  const pillarConfig: Record<string, { enabled: boolean }> = {};

  // Disable pillars not in the profile
  for (const id of ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]) {
    pillarConfig[id] = {
      enabled: profilePillars.includes(id as "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8"),
    };
  }

  const scanConfig: Partial<ScanConfig> = {
    ...options.scanConfig,
    pillars: pillarConfig,
  };

  // Run the scan
  const scanResult = await scan(repoPath, scanConfig, options.onProgress);

  // Filter findings to changed files if provided
  if (changedFiles.length > 0) {
    const changedSet = new Set(changedFiles);
    for (const pillar of scanResult.pillars) {
      pillar.findings = pillar.findings.filter((f) => !f.file || changedSet.has(f.file));
    }
  }

  // Compute delta against baseline
  let delta: DeltaResult | null = null;
  if (useDelta) {
    const baseline = await loadBaseline(repoPath);
    if (baseline) {
      delta = computeDelta(scanResult, baseline);
    }
  }

  // Optionally update baseline
  if (options.updateBaseline) {
    await saveBaseline(repoPath, scanResult);
  }

  return {
    scanResult,
    delta,
    profile,
    changedFiles,
  };
}
