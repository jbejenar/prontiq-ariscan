/**
 * Scaffold engine — writes preset files to disk.
 */
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { ScaffoldOptions, ScaffoldResult } from "./types.js";
import { resolvePreset, listPresets } from "./presets/index.js";

/**
 * Scaffold a new project from a preset.
 *
 * Creates the output directory and writes all preset files.
 * Refuses to write into a non-empty directory.
 * Supports both built-in and community presets (S.11).
 */
export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const preset = await resolvePreset(options.preset);
  if (!preset) {
    const available = listPresets()
      .map((p) => p.manifest.id)
      .join(", ");
    throw new Error(
      `Unknown preset: "${options.preset}". Available: ${available}, community/<name>`,
    );
  }

  // Ensure output directory exists
  await mkdir(options.outputDir, { recursive: true });

  // Refuse to overwrite non-empty directory
  const existing = await readdir(options.outputDir);
  if (existing.length > 0) {
    throw new Error(
      `Output directory is not empty: ${options.outputDir}\nUse an empty directory or a new project name.`,
    );
  }

  const entries = preset.generate(options);
  const writtenPaths: string[] = [];

  for (const entry of entries) {
    const fullPath = join(options.outputDir, entry.path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, entry.content, "utf-8");
    writtenPaths.push(entry.path);
  }

  return {
    outputDir: options.outputDir,
    filesWritten: writtenPaths.length,
    files: writtenPaths,
  };
}
