/**
 * Check mode profiles (P3.04).
 *
 * Each profile selects which pillars to analyze, trading depth for speed.
 */
import type { PillarId, CheckProfile } from "@prontiq/ariscan-schema";

/** Pillar sets per check profile. */
const PROFILE_PILLARS: Record<CheckProfile, readonly PillarId[]> = {
  /** Config-focused: context files, dev environment, security config. <5s target. */
  fast: ["P1", "P4", "P8"],
  /** Adds type safety, test isolation, and navigability. <15s target. */
  standard: ["P1", "P3", "P4", "P6", "P7", "P8"],
  /** Full scan — all 8 pillars. Same as CI. */
  thorough: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"],
};

/** Return the pillar IDs to run for a given check profile. */
export function getPillarsByProfile(profile: CheckProfile): readonly PillarId[] {
  return PROFILE_PILLARS[profile];
}
