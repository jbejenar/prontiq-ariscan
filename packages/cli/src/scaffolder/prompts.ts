/**
 * Interactive prompts for `ariscan init`.
 *
 * Uses Node.js built-in readline — no external dependencies.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { ScaffolderPreset } from "./types.js";

function createRl(): ReturnType<typeof createInterface> {
  return createInterface({ input: stdin, output: stdout });
}

const PROJECT_NAME_RE = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;

/** Prompt for a project name, validating npm package name rules. */
export async function promptProjectName(): Promise<string> {
  const rl = createRl();
  try {
    for (;;) {
      const answer = await rl.question("Project name: ");
      const name = answer.trim();
      if (!name) {
        stdout.write("  Name cannot be empty.\n");
        continue;
      }
      if (!PROJECT_NAME_RE.test(name)) {
        stdout.write("  Invalid name. Use lowercase letters, numbers, hyphens, and dots.\n");
        continue;
      }
      return name;
    }
  } finally {
    rl.close();
  }
}

/** Prompt the user to select a preset from a list. */
export async function promptPreset(presets: readonly ScaffolderPreset[]): Promise<string> {
  stdout.write("\nAvailable presets:\n");
  for (const [i, preset] of presets.entries()) {
    stdout.write(`  ${i + 1}. ${preset.manifest.name} — ${preset.manifest.description}\n`);
  }
  stdout.write("\n");

  const rl = createRl();
  try {
    for (;;) {
      const answer = await rl.question(`Select preset (1-${presets.length}) [1]: `);
      const trimmed = answer.trim();
      if (trimmed === "") {
        const first = presets[0];
        if (!first) throw new Error("No presets available");
        return first.manifest.id;
      }
      const idx = parseInt(trimmed, 10);
      if (isNaN(idx) || idx < 1 || idx > presets.length) {
        stdout.write(`  Please enter a number between 1 and ${presets.length}.\n`);
        continue;
      }
      const selected = presets[idx - 1];
      if (!selected) throw new Error("Invalid preset index");
      return selected.manifest.id;
    }
  } finally {
    rl.close();
  }
}

/** Validate a project name (for non-interactive mode). */
export function validateProjectName(name: string): string | null {
  if (!name) return "Name cannot be empty.";
  if (!PROJECT_NAME_RE.test(name)) {
    return "Invalid name. Use lowercase letters, numbers, hyphens, and dots.";
  }
  return null;
}
