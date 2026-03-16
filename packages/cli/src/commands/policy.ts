/** Policy subcommand — init and validate policy files. */
import { defineCommand } from "citty";
import { resolve, dirname, relative } from "node:path";
import { access, writeFile } from "node:fs/promises";
import { scan } from "@prontiq/ariscan-engine";
import { formatConfigJsonSchema } from "../output/json.js";
import { PILLAR_NAMES, PILLAR_WEIGHTS } from "@prontiq/ariscan-schema";
import type { PillarId, FileConfig as FileConfigType } from "@prontiq/ariscan-schema";
import {
  loadConfigFile,
  findConfigFile,
  resolveInheritance,
  resolveProfile,
} from "../config-loader.js";

/**
 * Generate a starter `.ariscan.yml` from current scan scores.
 *
 * @param schemaRelPath — relative path from the policy file to the vendored
 *   `config.schema.json` that will be written next to it by `policy init`.
 */
async function generateStarterPolicy(repoPath: string, schemaRelPath: string): Promise<string> {
  const result = await scan(repoPath);

  // Round composite down to nearest 5
  const compositeThreshold = Math.floor(result.score / 5) * 5;

  // Per-pillar thresholds: current score - 10, floored at 0
  const pillarThresholds: Record<string, number> = {};
  for (const pillar of result.pillars) {
    pillarThresholds[pillar.pillar] = Math.max(0, Math.floor((pillar.score - 10) / 5) * 5);
  }

  const pillarLines = Object.entries(pillarThresholds)
    .map(([id, threshold]) => {
      const name = PILLAR_NAMES[id as PillarId] ?? id;
      return `    ${id}: ${threshold}  # ${name}`;
    })
    .join("\n");

  return `# .ariscan.yml — Policy configuration
# Generated from current scan scores. Customize as needed.
# Docs: https://github.com/jbejenar/prontiq-ariscan
# yaml-language-server: $schema=${schemaRelPath}

$schema: "${schemaRelPath}"
version: "1"
enforcement: warn  # warn | fail | block

thresholds:
  composite: ${compositeThreshold}
  pillars:
${pillarLines}

# suppressions:
#   - code: ARI-CTX-001
#     reason: "Accepted risk: legacy module"
#     expiry: "2026-06-30"
#     approver: "team-lead"

# profiles:
#   strict:
#     name: "Strict CI"
#     thresholds:
#       composite: 80
#   lenient:
#     name: "Development"
#     thresholds:
#       composite: 50

# activeProfile: strict
`;
}

/** Validation error with optional context. */
interface PolicyError {
  message: string;
  field?: string;
}

/**
 * Validate a policy file: schema + semantic checks.
 */
async function validatePolicyFile(configPath: string): Promise<PolicyError[]> {
  const errors: PolicyError[] = [];

  // Schema validation
  let config: FileConfigType;
  try {
    config = await loadConfigFile(configPath);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push({ message: `Schema validation failed: ${message}` });
    return errors;
  }

  // Resolve inheritance so we validate the effective policy, not just the leaf file
  try {
    config = await resolveInheritance(config, configPath);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push({ message: `Inheritance resolution failed: ${message}` });
    return errors;
  }

  // Resolve active profile
  try {
    config = resolveProfile(config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push({ message: `Profile resolution failed: ${message}`, field: "activeProfile" });
  }

  // Reject paths rules — not yet enforced at runtime
  if (config.paths && config.paths.length > 0) {
    errors.push({
      message: `'paths' rules are not yet supported. Path-specific thresholds have no effect at runtime. Remove the 'paths' section until this feature is implemented.`,
      field: "paths",
    });
  }

  // Semantic: check weight sum if weights are overridden
  if (config.pillars?.weights) {
    const weights = config.pillars.weights;
    const overriddenIds = Object.keys(weights);
    if (overriddenIds.length === Object.keys(PILLAR_WEIGHTS).length) {
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1.0) > 0.001) {
        errors.push({
          message: `Pillar weights sum to ${sum.toFixed(3)}, expected 1.0`,
          field: "pillars.weights",
        });
      }
    }
  }

  // Semantic: check profile weights sum
  if (config.profiles) {
    for (const [name, profile] of Object.entries(config.profiles)) {
      if (profile.weights) {
        const overriddenIds = Object.keys(profile.weights);
        if (overriddenIds.length === Object.keys(PILLAR_WEIGHTS).length) {
          const sum = Object.values(profile.weights).reduce((a, b) => a + b, 0);
          if (Math.abs(sum - 1.0) > 0.001) {
            errors.push({
              message: `Profile "${name}" weights sum to ${sum.toFixed(3)}, expected 1.0`,
              field: `profiles.${name}.weights`,
            });
          }
        }
      }
    }
  }

  // Semantic: check activeProfile exists
  if (config.activeProfile && config.profiles) {
    if (!config.profiles[config.activeProfile]) {
      errors.push({
        message: `Active profile "${config.activeProfile}" not found in profiles`,
        field: "activeProfile",
      });
    }
  } else if (config.activeProfile && !config.profiles) {
    errors.push({
      message: `Active profile "${config.activeProfile}" set but no profiles defined`,
      field: "activeProfile",
    });
  }

  // Semantic: check suppressions
  if (config.suppressions) {
    const codes = new Set<string>();
    for (const sup of config.suppressions) {
      if (codes.has(sup.code)) {
        errors.push({
          message: `Duplicate suppression code: ${sup.code}`,
          field: "suppressions",
        });
      }
      codes.add(sup.code);

      // Warn on expired suppressions — compare as calendar dates so
      // a date-only expiry stays valid through the entire stated day
      if (sup.expiry !== "no-expiry") {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        if (sup.expiry < todayStr) {
          errors.push({
            message: `Suppression ${sup.code} has expired (${sup.expiry})`,
            field: "suppressions",
          });
        }
      }
    }
  }

  return errors;
}

export const policyInitCommand = defineCommand({
  meta: {
    name: "init",
    description: "Generate a starter .ariscan.yml policy from current scan scores",
  },
  args: {
    path: {
      type: "positional",
      description: "Path to the repository to scan",
      required: false,
      default: ".",
    },
    output: {
      type: "string",
      description: "Output path for the generated policy file",
      default: ".ariscan.yml",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing policy file",
      default: false,
    },
  },
  async run({ args }) {
    const repoPath = resolve(args.path);
    const outputPath = resolve(repoPath, args.output);

    // Check if file already exists
    if (!args.force) {
      try {
        await access(outputPath);
        process.stderr.write(`Error: ${args.output} already exists. Use --force to overwrite.\n`);
        process.exit(2);
      } catch {
        // File doesn't exist, good
      }
    }

    process.stderr.write(`Scanning ${repoPath} to generate policy...\n`);

    try {
      // Vendor the JSON Schema next to the generated policy so editors can
      // resolve it regardless of how ariscan was installed (npx, global, etc.)
      const outputDir = dirname(outputPath);
      const schemaOutputPath = resolve(outputDir, "config.schema.json");
      const schemaRelPath = "./" + relative(outputDir, schemaOutputPath);

      const content = await generateStarterPolicy(repoPath, schemaRelPath);
      await writeFile(outputPath, content, "utf-8");
      await writeFile(schemaOutputPath, formatConfigJsonSchema(), "utf-8");
      process.stderr.write(`Policy written to ${outputPath}\n`);
      process.stderr.write(`Schema written to ${schemaOutputPath}\n`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: Failed to generate policy: ${message}\n`);
      process.exit(2);
    }
  },
});

export const policyValidateCommand = defineCommand({
  meta: {
    name: "validate",
    description: "Validate an .ariscan.yml policy file",
  },
  args: {
    config: {
      type: "string",
      description: "Path to the policy file to validate",
      required: false,
    },
  },
  async run({ args }) {
    const configPath = args.config ? resolve(args.config) : await findConfigFile(process.cwd());

    if (!configPath) {
      process.stderr.write(
        "Error: No .ariscan.yml found. Run `ariscan policy init` to create one.\n",
      );
      process.exit(2);
    }

    process.stderr.write(`Validating ${configPath}...\n`);

    const errors = await validatePolicyFile(configPath);

    if (errors.length === 0) {
      process.stderr.write("Policy is valid.\n");
    } else {
      for (const err of errors) {
        const prefix = err.field ? `[${err.field}] ` : "";
        process.stderr.write(`  Error: ${prefix}${err.message}\n`);
      }
      process.exit(1);
    }
  },
});

export const policyCommand = defineCommand({
  meta: {
    name: "policy",
    description: "Manage .ariscan.yml policy files",
  },
  subCommands: {
    init: policyInitCommand,
    validate: policyValidateCommand,
  },
});

// Export for testing
export { generateStarterPolicy, validatePolicyFile };
