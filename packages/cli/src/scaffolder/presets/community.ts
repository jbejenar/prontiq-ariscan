/**
 * Community preset loader (S.11).
 *
 * Discovers and loads community-contributed scaffolder presets from:
 * 1. Local directory: `.ariscan/presets/<name>/`
 * 2. npm packages: `ariscan-preset-<name>`
 *
 * Community presets export a `ScaffolderPreset` (default or named `preset` export)
 * and include a `CommunityPresetManifest` with author/version metadata.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type {
  ScaffolderPreset,
  CommunityPresetManifest,
  FileEntry,
  ScaffoldOptions,
} from "../types.js";

/** Prefix used to route to community presets in `--preset community/<name>`. */
export const COMMUNITY_PREFIX = "community/";

/** Directory within a repo that holds local community presets. */
const LOCAL_PRESET_DIR = ".ariscan/presets";

/** npm package prefix for community presets. */
const NPM_PREFIX = "ariscan-preset-";

/**
 * Parsed community preset name from `community/<name>`.
 * Returns undefined if the preset ID does not use the community prefix.
 */
export function parseCommunityId(presetId: string): string | undefined {
  if (!presetId.startsWith(COMMUNITY_PREFIX)) return undefined;
  const name = presetId.slice(COMMUNITY_PREFIX.length);
  if (!name || name.includes("/") || name.includes("..")) return undefined;
  return name;
}

/**
 * Validate a community preset manifest.
 * Returns an error message if invalid, or undefined if valid.
 */
export function validateManifest(manifest: unknown): string | undefined {
  if (manifest === null || typeof manifest !== "object") {
    return "Manifest must be a non-null object";
  }
  const m = manifest as Record<string, unknown>;
  if (typeof m.id !== "string" || m.id.length === 0)
    return "Manifest must have a non-empty 'id' string";
  if (typeof m.name !== "string" || m.name.length === 0)
    return "Manifest must have a non-empty 'name' string";
  if (typeof m.description !== "string" || m.description.length === 0)
    return "Manifest must have a non-empty 'description' string";
  if (typeof m.version !== "string" || m.version.length === 0)
    return "Manifest must have a non-empty 'version' string";
  if (m.author !== undefined && typeof m.author !== "string")
    return "'author' must be a string if provided";
  if (m.repository !== undefined && typeof m.repository !== "string")
    return "'repository' must be a string if provided";
  return undefined;
}

/**
 * Validate that a loaded module exports a valid preset.
 * Returns an error message if invalid, or undefined if valid.
 */
function validatePresetExport(mod: Record<string, unknown>): string | undefined {
  const preset = (mod.default ?? mod.preset) as Record<string, unknown> | undefined;
  if (!preset || typeof preset !== "object") {
    return "Module must have a default export or a named 'preset' export";
  }
  if (typeof preset.manifest !== "object" || preset.manifest === null) {
    return "Preset must have a 'manifest' object";
  }
  if (typeof preset.generate !== "function") {
    return "Preset must have a 'generate' function";
  }
  return undefined;
}

/**
 * Extract the ScaffolderPreset from a loaded module.
 */
function extractPreset(mod: Record<string, unknown>): ScaffolderPreset {
  return (mod.default ?? mod.preset) as ScaffolderPreset;
}

/**
 * Load a community preset from a local `.ariscan/presets/<name>/` directory.
 *
 * The directory must contain a `manifest.json` and an `index.js` (or `index.mjs`)
 * that default-exports or named-exports a `ScaffolderPreset`.
 */
export async function loadLocalPreset(repoRoot: string, name: string): Promise<ScaffolderPreset> {
  const presetDir = resolve(repoRoot, LOCAL_PRESET_DIR, name);

  // Load and validate manifest
  let manifestRaw: string;
  try {
    manifestRaw = await readFile(join(presetDir, "manifest.json"), "utf-8");
  } catch {
    throw new Error(`Community preset "${name}": missing manifest.json in ${presetDir}`);
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestRaw) as unknown;
  } catch {
    throw new Error(`Community preset "${name}": manifest.json is not valid JSON`);
  }

  const manifestErr = validateManifest(manifest);
  if (manifestErr) {
    throw new Error(`Community preset "${name}": ${manifestErr}`);
  }

  // Load the preset module
  const entryPath = join(presetDir, "index.js");
  let mod: Record<string, unknown>;
  try {
    mod = (await import(entryPath)) as Record<string, unknown>;
  } catch {
    throw new Error(`Community preset "${name}": failed to load ${entryPath}`);
  }

  const exportErr = validatePresetExport(mod);
  if (exportErr) {
    throw new Error(`Community preset "${name}": ${exportErr}`);
  }

  const preset = extractPreset(mod);

  // Override the manifest ID to match the community/<name> convention
  return {
    manifest: {
      ...(manifest as CommunityPresetManifest),
      id: `community/${name}`,
    },
    generate: (options: ScaffoldOptions): FileEntry[] => preset.generate(options),
  };
}

/**
 * Load a community preset from an npm package `ariscan-preset-<name>`.
 */
export async function loadNpmPreset(name: string): Promise<ScaffolderPreset> {
  const packageName = `${NPM_PREFIX}${name}`;

  let mod: Record<string, unknown>;
  try {
    mod = (await import(packageName)) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Community preset "${name}": npm package "${packageName}" not found.\n` +
        `Install it with: npm install -D ${packageName}`,
    );
  }

  const exportErr = validatePresetExport(mod);
  if (exportErr) {
    throw new Error(`Community preset "${name}" (${packageName}): ${exportErr}`);
  }

  const preset = extractPreset(mod);

  const manifestErr = validateManifest(preset.manifest);
  if (manifestErr) {
    throw new Error(`Community preset "${name}" (${packageName}): ${manifestErr}`);
  }

  return {
    manifest: {
      ...preset.manifest,
      id: `community/${name}`,
    },
    generate: (options: ScaffoldOptions): FileEntry[] => preset.generate(options),
  };
}

/**
 * Resolve a community preset by name. Tries local directory first, then npm.
 * Returns undefined if neither source has the preset.
 */
export async function loadCommunityPreset(
  repoRoot: string,
  name: string,
): Promise<ScaffolderPreset | undefined> {
  // Try local directory first
  try {
    return await loadLocalPreset(repoRoot, name);
  } catch {
    // Fall through to npm
  }

  // Try npm package
  try {
    return await loadNpmPreset(name);
  } catch {
    return undefined;
  }
}

/**
 * Discover all locally available community presets.
 * Returns an array of preset directory names (not full ScaffolderPreset objects).
 */
export async function discoverLocalPresets(repoRoot: string): Promise<readonly string[]> {
  const presetsDir = resolve(repoRoot, LOCAL_PRESET_DIR);
  try {
    const entries = await readdir(presetsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
