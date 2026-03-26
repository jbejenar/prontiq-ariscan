/**
 * Preset registry for `ariscan init`.
 */
import type { ScaffolderPreset } from "../types.js";
import { barePreset } from "./bare.js";

const PRESETS: readonly ScaffolderPreset[] = [barePreset];

/** Get a preset by ID, or undefined if not found. */
export function getPreset(id: string): ScaffolderPreset | undefined {
  return PRESETS.find((p) => p.manifest.id === id);
}

/** List all available presets. */
export function listPresets(): readonly ScaffolderPreset[] {
  return PRESETS;
}
