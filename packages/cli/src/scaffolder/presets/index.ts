/**
 * Preset registry for `ariscan init`.
 */
import type { ScaffolderPreset } from "../types.js";
import { barePreset } from "./bare.js";
import { nextjsPreset } from "./nextjs.js";
import { parseCommunityId, loadCommunityPreset } from "./community.js";

const PRESETS: readonly ScaffolderPreset[] = [barePreset, nextjsPreset];

/** Get a built-in preset by ID, or undefined if not found. */
export function getPreset(id: string): ScaffolderPreset | undefined {
  return PRESETS.find((p) => p.manifest.id === id);
}

/**
 * Resolve a preset by ID — built-in or community (S.11).
 *
 * Community presets use the `community/<name>` prefix and are loaded
 * from `.ariscan/presets/<name>/` or `ariscan-preset-<name>` npm packages.
 *
 * @param id - Preset ID (e.g. "bare", "community/express")
 * @param repoRoot - Repository root for local preset discovery (defaults to cwd)
 */
export async function resolvePreset(
  id: string,
  repoRoot?: string,
): Promise<ScaffolderPreset | undefined> {
  // Built-in presets take priority
  const builtin = getPreset(id);
  if (builtin) return builtin;

  // Check for community prefix
  const communityName = parseCommunityId(id);
  if (!communityName) return undefined;

  return loadCommunityPreset(repoRoot ?? process.cwd(), communityName);
}

/** List all built-in presets. */
export function listPresets(): readonly ScaffolderPreset[] {
  return PRESETS;
}

/** Check if a preset ID refers to a community preset. */
export function isCommunityPreset(id: string): boolean {
  return parseCommunityId(id) !== undefined;
}

export { parseCommunityId, discoverLocalPresets } from "./community.js";
