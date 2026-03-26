/**
 * Init subcommand (S.01) — Project scaffolder.
 *
 * Interactive: `ariscan init`
 * Non-interactive (S.10): `ariscan init --preset bare --name my-app`
 * Community presets (S.11): `ariscan init --preset community/express --name my-app`
 * Dogfood gate (S.04): scans output and fails if score < L3 (46).
 */
import { defineCommand } from "citty";
import { resolve } from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { scan } from "@prontiq/ariscan-engine";
import { scaffold } from "../scaffolder/engine.js";
import {
  listPresets,
  getPreset,
  resolvePreset,
  isCommunityPreset,
} from "../scaffolder/presets/index.js";
import { promptProjectName, promptPreset, validateProjectName } from "../scaffolder/prompts.js";

/** Minimum ARI score for scaffolded projects (L3 Capable). */
const DOGFOOD_FLOOR = 46;

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: `Scaffold a new agent-ready project

Examples:
  ariscan init                                          # Interactive mode
  ariscan init --preset bare --name my-app              # Non-interactive mode
  ariscan init --preset community/express --name my-app # Community preset
  ariscan init ./my-app                                 # Specify output directory`,
  },
  args: {
    path: {
      type: "positional",
      description: "Output directory (default: ./<project-name>)",
      required: false,
    },
    preset: {
      type: "string",
      description: "Preset to use (e.g., bare, nextjs, community/<name>)",
      required: false,
    },
    "skip-scan": {
      type: "boolean",
      description: "Skip the dogfood scan after scaffolding",
      required: false,
    },
    name: {
      type: "string",
      description: "Project name",
      required: false,
    },
  },
  async run({ args }) {
    const presetArg = args.preset as string | undefined;
    const nameArg = args.name as string | undefined;
    const pathArg = args.path as string | undefined;
    const skipScan = Boolean(args["skip-scan"]);

    const isNonInteractive = Boolean(presetArg && nameArg);
    const isTTY = Boolean(process.stdin.isTTY);

    // Non-TTY without required flags → error with guidance
    if (!isTTY && !isNonInteractive) {
      process.stderr.write(
        "Error: Interactive mode requires a TTY.\n" +
          "Use: ariscan init --preset bare --name my-app\n",
      );
      process.exit(2);
    }

    // Resolve name
    let projectName: string;
    if (nameArg) {
      const err = validateProjectName(nameArg);
      if (err) {
        process.stderr.write(`Error: ${err}\n`);
        process.exit(2);
      }
      projectName = nameArg;
    } else {
      projectName = await promptProjectName();
    }

    // Resolve preset
    let presetId: string;
    if (presetArg) {
      // Community presets are resolved asynchronously (S.11)
      if (isCommunityPreset(presetArg)) {
        const resolved = await resolvePreset(presetArg);
        if (!resolved) {
          process.stderr.write(`Error: Community preset "${presetArg}" not found.\n`);
          process.stderr.write("Community presets are loaded from:\n");
          process.stderr.write("  1. .ariscan/presets/<name>/ (local directory)\n");
          process.stderr.write("  2. ariscan-preset-<name> (npm package)\n");
          process.exit(2);
        }
        presetId = presetArg;
      } else if (!getPreset(presetArg)) {
        const available = listPresets()
          .map((p) => p.manifest.id)
          .join(", ");
        process.stderr.write(
          `Error: Unknown preset "${presetArg}". Available: ${available}, community/<name>\n`,
        );
        process.exit(2);
      } else {
        presetId = presetArg;
      }
    } else {
      presetId = await promptPreset(listPresets());
    }

    // Resolve output directory
    const outputDir = resolve(pathArg ?? `./${projectName}`);

    process.stderr.write(`\nScaffolding ${projectName} with preset "${presetId}"...\n`);

    try {
      const result = await scaffold({
        name: projectName,
        preset: presetId,
        outputDir,
      });

      process.stderr.write(`\nCreated ${result.filesWritten} files in ${result.outputDir}\n`);

      // S.04 — Dogfood gate: scan the scaffolded output
      if (!skipScan) {
        process.stderr.write("Running ARI scan on scaffolded project...\n");

        // Ensure .git directory exists so the scanner recognises it as a repo
        await mkdir(resolve(outputDir, ".git"), { recursive: true });

        const scanResult = await scan(outputDir);

        // Clean up .git stub — it is not a real git repo and confuses tools
        await rm(resolve(outputDir, ".git"), { recursive: true, force: true });

        const score = Math.round(scanResult.score);
        const level = scanResult.level;

        process.stderr.write(`ARI score: ${score}/100 (${level})\n`);

        if (score < DOGFOOD_FLOOR) {
          process.stderr.write(
            `Error: Scaffolded project scored ${score}, below L3 floor (${DOGFOOD_FLOOR}).\n` +
              "This is a bug in the preset — please report it.\n",
          );
          process.exit(2);
        }

        process.stderr.write(`Scaffold dogfood gate passed (${score} >= ${DOGFOOD_FLOOR})\n`);
      } else {
        process.stderr.write("Warning: dogfood scan skipped — scaffold quality not verified.\n");
      }

      process.stderr.write("\nNext steps:\n");
      process.stderr.write(`  cd ${projectName}\n`);
      process.stderr.write("  npm install\n");
      process.stderr.write("  npm test\n\n");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(2);
    }
  },
});
